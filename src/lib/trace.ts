import type { Item, VaultEvent } from "./domain";
import { findItem, getEvents } from "./repo";

// The vault-trace service: "where is this item and what happened to it."
// One implementation, two front doors — the web box (REST) and VaultTrace (MCP)
// both call these functions.

export const LOCATION: Record<Item["state"], string> = {
	received: "at intake, awaiting imaging",
	scanned: "on the imaging line",
	exception: "held in the QC exception queue (not live)",
	live: "live on the platform, in the vault and sellable",
};

export function whereText(item: Item): string {
	const num =
		item.manifest.cardNumber && item.manifest.cardNumber !== "n/a"
			? ` #${item.manifest.cardNumber}`
			: "";
	const lines = [
		`${item.title} (${item.sku}) is ${LOCATION[item.state]}.`,
		`Manifest: ${item.manifest.set}${num}, ${item.manifest.year}${item.manifest.grade ? `, ${item.manifest.grade}` : ""}.`,
	];
	const v = item.lastVerdict;
	if (v) lines.push(`Last ScanGate verdict: ${v.pass ? "PASS" : "FAIL"} — ${v.summary}`);
	return lines.join("\n");
}

export function describeEvent(e: VaultEvent): string {
	const t = new Date(e.createdAt).toISOString().replace("T", " ").slice(0, 19);
	switch (e.type) {
		case "received":
			return `${t}  received into intake`;
		case "scanned":
			return `${t}  scanned on the imaging line`;
		case "qc_passed":
			return `${t}  ScanGate PASSED`;
		case "qc_failed": {
			const v = e.data.verdict as { issues?: { type: string }[] } | undefined;
			const reasons = v?.issues?.map((i) => i.type).join(", ") || "unspecified";
			return `${t}  ScanGate FAILED — ${reasons}`;
		}
		case "went_live":
			return `${t}  went live on the platform`;
		case "qc_override":
			return `${t}  QC override by ${e.actor} (${String(e.data.reason ?? "")})`;
		default:
			return `${t}  ${e.type}`;
	}
}

export interface TraceResult {
	found: boolean;
	query: string;
	where?: string;
	state?: Item["state"];
	events?: string[];
}

/** Resolve "where is X" by id / SKU / title fragment, with its full history. */
export async function resolveTrace(query: string): Promise<TraceResult> {
	const item = await findItem(query);
	if (!item) return { found: false, query };
	const events = await getEvents(item.id);
	return {
		found: true,
		query,
		where: whereText(item),
		state: item.state,
		events: events.map(describeEvent),
	};
}
