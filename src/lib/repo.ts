import type { PoolClient } from "pg";
import { pool, withTx } from "./db";
import type {
	EventType,
	Item,
	ItemState,
	Manifest,
	VaultEvent,
	Verdict,
} from "./domain";

// deno-fmt-ignore
type ItemRow = {
	id: string; sku: string; title: string; category: string;
	manifest: Manifest; state: ItemState; received_at: string;
	scanned_at: string | null; live_at: string | null;
	last_verdict: Verdict | null; scan_path: string | null; updated_at: string;
};

function toItem(r: ItemRow): Item {
	return {
		id: r.id,
		sku: r.sku,
		title: r.title,
		category: r.category,
		manifest: r.manifest,
		state: r.state,
		receivedAt: r.received_at,
		scannedAt: r.scanned_at,
		liveAt: r.live_at,
		lastVerdict: r.last_verdict,
		scanPath: r.scan_path,
		updatedAt: r.updated_at,
	};
}

async function append(
	c: PoolClient,
	itemId: string,
	type: EventType,
	data: Record<string, unknown>,
	actor = "system",
): Promise<void> {
	await c.query(
		`insert into events (item_id, type, data, actor) values ($1, $2, $3, $4)`,
		[itemId, type, JSON.stringify(data), actor],
	);
}

/** Intake: create the item and emit `received`. */
export async function receiveItem(input: {
	sku: string;
	title: string;
	category: string;
	manifest: Manifest;
}): Promise<Item> {
	return withTx(async (c) => {
		const { rows } = await c.query<ItemRow>(
			`insert into items (sku, title, category, manifest)
			 values ($1, $2, $3, $4) returning *`,
			[input.sku, input.title, input.category, JSON.stringify(input.manifest)],
		);
		const item = rows[0];
		await append(c, item.id, "received", {
			sku: input.sku,
			title: input.title,
			category: input.category,
		});
		return toItem(item);
	});
}

/**
 * Record a scan + its ScanGate verdict. Emits `scanned`, then `qc_passed` or
 * `qc_failed`, and on a pass `went_live`. Updates the item projection.
 * Returns the refreshed item.
 */
export async function recordScan(
	itemId: string,
	scanPath: string,
	verdict: Verdict,
	actor = "scangate",
): Promise<Item> {
	return withTx(async (c) => {
		await append(c, itemId, "scanned", { scanPath }, actor);
		await c.query(
			`update items set scanned_at = now(), scan_path = $2,
			 last_verdict = $3, state = 'scanned', updated_at = now()
			 where id = $1`,
			[itemId, scanPath, JSON.stringify(verdict)],
		);

		if (verdict.pass) {
			await append(c, itemId, "qc_passed", { verdict }, actor);
			await append(c, itemId, "went_live", {}, actor);
			await c.query(
				`update items set state = 'live', live_at = now(), updated_at = now()
				 where id = $1`,
				[itemId],
			);
		} else {
			await append(c, itemId, "qc_failed", { verdict }, actor);
			await c.query(
				`update items set state = 'exception', updated_at = now() where id = $1`,
				[itemId],
			);
		}

		const { rows } = await c.query<ItemRow>(
			`select * from items where id = $1`,
			[itemId],
		);
		return toItem(rows[0]);
	});
}

/** Human/agent override: force a previously-failed item live. */
export async function overrideLive(
	itemId: string,
	reason: string,
	actor = "operator",
): Promise<Item> {
	return withTx(async (c) => {
		await append(c, itemId, "qc_override", { reason }, actor);
		await append(c, itemId, "went_live", { via: "override" }, actor);
		const { rows } = await c.query<ItemRow>(
			`update items set state = 'live', live_at = coalesce(live_at, now()),
			 updated_at = now() where id = $1 returning *`,
			[itemId],
		);
		return toItem(rows[0]);
	});
}

export async function getItem(itemId: string): Promise<Item | null> {
	const { rows } = await pool.query<ItemRow>(
		`select * from items where id = $1`,
		[itemId],
	);
	return rows[0] ? toItem(rows[0]) : null;
}

/** Resolve an item by exact id, exact SKU, or a case-insensitive title match. */
export async function findItem(needle: string): Promise<Item | null> {
	const { rows } = await pool.query<ItemRow>(
		`select * from items
		 where id::text = $1 or sku ilike $1 or title ilike '%' || $1 || '%'
		 order by (sku ilike $1) desc, received_at desc
		 limit 1`,
		[needle],
	);
	return rows[0] ? toItem(rows[0]) : null;
}

export async function listItems(state?: ItemState): Promise<Item[]> {
	const { rows } = state
		? await pool.query<ItemRow>(
				`select * from items where state = $1 order by received_at desc`,
				[state],
			)
		: await pool.query<ItemRow>(`select * from items order by received_at desc`);
	return rows.map(toItem);
}

export async function getEvents(itemId: string): Promise<VaultEvent[]> {
	const { rows } = await pool.query(
		`select seq, item_id, type, data, actor, created_at
		 from events where item_id = $1 order by seq asc`,
		[itemId],
	);
	return rows.map((r) => ({
		seq: Number(r.seq),
		itemId: r.item_id,
		type: r.type as EventType,
		data: r.data,
		actor: r.actor,
		createdAt: r.created_at,
	}));
}

export interface VaultMetrics {
	total: number;
	live: number;
	exception: number;
	inFlight: number;
	avgTimeToLiveMin: number | null;
	medianTimeToLiveMin: number | null;
	p90TimeToLiveMin: number | null;
	passRate: number | null; // qc_passed / (qc_passed + qc_failed)
}

export async function getMetrics(): Promise<VaultMetrics> {
	const counts = await pool.query<{ state: ItemState; n: string }>(
		`select state, count(*)::text n from items group by state`,
	);
	const byState: Record<string, number> = {};
	for (const r of counts.rows) byState[r.state] = Number(r.n);

	const ttl = await pool.query<{ mins: string }>(
		`select extract(epoch from (live_at - received_at)) / 60 as mins
		 from items where live_at is not null order by mins asc`,
	);
	const mins = ttl.rows.map((r) => Number(r.mins));
	const pct = (p: number) =>
		mins.length ? mins[Math.min(mins.length - 1, Math.floor(p * mins.length))] : null;

	const qc = await pool.query<{ passed: string; failed: string }>(
		`select
		   count(*) filter (where type = 'qc_passed')::text passed,
		   count(*) filter (where type = 'qc_failed')::text failed
		 from events`,
	);
	const passed = Number(qc.rows[0].passed);
	const failed = Number(qc.rows[0].failed);

	const live = byState.live ?? 0;
	const exception = byState.exception ?? 0;
	const received = byState.received ?? 0;
	const scanned = byState.scanned ?? 0;

	return {
		total: live + exception + received + scanned,
		live,
		exception,
		inFlight: received + scanned,
		avgTimeToLiveMin: mins.length
			? mins.reduce((a, b) => a + b, 0) / mins.length
			: null,
		medianTimeToLiveMin: pct(0.5),
		p90TimeToLiveMin: pct(0.9),
		passRate: passed + failed ? passed / (passed + failed) : null,
	};
}
