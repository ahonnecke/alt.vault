"use client";

import { useCallback, useEffect, useState } from "react";
import type { Item, VaultEvent } from "@/lib/domain";

type Metrics = {
	total: number;
	live: number;
	exception: number;
	inFlight: number;
	avgTimeToLiveMin: number | null;
	medianTimeToLiveMin: number | null;
	p90TimeToLiveMin: number | null;
	passRate: number | null;
};

const VARIANTS = ["random", "clean", "glare", "blur", "rotate", "mismatch"] as const;
type Variant = (typeof VARIANTS)[number];

const fmtMin = (n: number | null) => (n == null ? "—" : `${n.toFixed(1)}m`);

const STATE_STYLE: Record<string, string> = {
	live: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10",
	exception: "text-rose-400 border-rose-500/40 bg-rose-500/10",
	received: "text-sky-400 border-sky-500/40 bg-sky-500/10",
	scanned: "text-amber-400 border-amber-500/40 bg-amber-500/10",
};

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
	return (
		<div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
			<div className="text-xs uppercase tracking-wide text-white/40">{label}</div>
			<div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
			{sub && <div className="text-xs text-white/40">{sub}</div>}
		</div>
	);
}

function Timeline({ id }: { id: string }) {
	const [events, setEvents] = useState<VaultEvent[] | null>(null);
	useEffect(() => {
		fetch(`/api/items/${id}`)
			.then((r) => r.json())
			.then((d) => setEvents(d.events));
	}, [id]);
	if (!events) return <div className="p-3 text-xs text-white/40">loading…</div>;
	const label: Record<string, string> = {
		received: "Received into intake",
		scanned: "Scanned on imaging line",
		qc_passed: "ScanGate passed",
		qc_failed: "ScanGate failed",
		went_live: "Went live",
		qc_override: "QC override",
	};
	return (
		<ol className="space-y-2 p-3">
			{events.map((e) => (
				<li key={e.seq} className="flex items-center gap-3 text-xs">
					<span className="w-36 shrink-0 font-mono text-white/40">
						{new Date(e.createdAt).toLocaleString()}
					</span>
					<span className="text-white/80">{label[e.type] ?? e.type}</span>
					<span className="text-white/30">{e.actor}</span>
				</li>
			))}
		</ol>
	);
}

function ItemCard({ item, onOverride }: { item: Item; onOverride: (id: string) => void }) {
	const [open, setOpen] = useState(false);
	const v = item.lastVerdict;
	return (
		<div className="rounded-xl border border-white/10 bg-white/[0.02]">
			<div className="flex gap-3 p-3">
				{item.scanPath && (
					// eslint-disable-next-line @next/next/no-img-element
					<img
						src={`/api/items/${item.id}/scan-image`}
						alt={item.title}
						className="h-24 w-[72px] shrink-0 rounded-md border border-white/10 object-cover"
					/>
				)}
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						<span className="font-mono text-xs text-white/40">{item.sku}</span>
						<span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase ${STATE_STYLE[item.state]}`}>
							{item.state}
						</span>
					</div>
					<div className="truncate font-medium">{item.title}</div>
					<div className="text-xs text-white/40">
						{item.manifest.set} · #{item.manifest.cardNumber} · {item.manifest.year}
						{item.manifest.grade ? ` · ${item.manifest.grade}` : ""}
					</div>
					{v && (
						<div className={`mt-1 text-xs ${v.pass ? "text-emerald-400/80" : "text-rose-400/90"}`}>
							{v.pass ? "PASS" : "FAIL"} · {v.summary}
						</div>
					)}
					<div className="mt-2 flex gap-3 text-xs">
						<button type="button" onClick={() => setOpen((o) => !o)} className="text-white/50 hover:text-white">
							{open ? "hide history" : "chain of custody"}
						</button>
						{item.state === "exception" && (
							<button type="button" onClick={() => onOverride(item.id)} className="text-amber-400 hover:text-amber-300">
								override → live
							</button>
						)}
					</div>
				</div>
			</div>
			{open && <div className="border-t border-white/10"><Timeline id={item.id} /></div>}
		</div>
	);
}

export default function Home() {
	const [items, setItems] = useState<Item[]>([]);
	const [metrics, setMetrics] = useState<Metrics | null>(null);
	const [busy, setBusy] = useState(false);
	const [flash, setFlash] = useState<string | null>(null);

	const refresh = useCallback(async () => {
		const [i, m] = await Promise.all([
			fetch("/api/items").then((r) => r.json()),
			fetch("/api/metrics").then((r) => r.json()),
		]);
		setItems(i);
		setMetrics(m);
	}, []);

	useEffect(() => {
		refresh();
		const t = setInterval(refresh, 5000);
		return () => clearInterval(t);
	}, [refresh]);

	const intake = async (variant: Variant) => {
		setBusy(true);
		setFlash(null);
		try {
			const res = await fetch("/api/intake", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(variant === "random" ? {} : { variant }),
			});
			const d = await res.json();
			if (d.verdict) setFlash(`${d.item.sku}: ScanGate ${d.verdict.pass ? "PASSED → live" : "FAILED → exception"} — ${d.verdict.summary}`);
			else setFlash(d.error ?? "intake failed");
			await refresh();
		} finally {
			setBusy(false);
		}
	};

	const override = async (id: string) => {
		await fetch(`/api/items/${id}/override`, { method: "POST" });
		await refresh();
	};

	const live = items.filter((i) => i.state === "live");
	const exceptions = items.filter((i) => i.state === "exception");

	return (
		<main className="mx-auto max-w-6xl px-4 py-8">
			<header className="mb-4">
				<h1 className="text-2xl font-semibold">Alt Vault — intake spine</h1>
				<p className="mt-1 text-sm text-white/50">
					A working demo of a physical-asset vault pipeline: a collectible arrives, gets
					photographed, and either goes live for sale or gets held for a bad scan. The whole
					thing is driven by one number — time from received to live.
				</p>
			</header>

			<section className="mb-6 rounded-xl border border-sky-500/20 bg-sky-500/[0.04] p-4 text-sm text-white/70">
				<div className="mb-1 font-semibold text-sky-300/90">Try it in 10 seconds</div>
				Hit a <span className="text-white/90">Simulate intake</span> button below. It renders a
				card scan and runs it through <span className="text-white/90">ScanGate</span> — a Claude
				vision check against the item&rsquo;s manifest. A clean scan passes QC and moves to{" "}
				<span className="text-emerald-400">Live inventory</span>; a scan with glare, blur, skew, or
				a wrong label fails and lands in the{" "}
				<span className="text-rose-400">Exception queue</span> instead of reaching a customer.
				Click <span className="text-white/90">chain of custody</span> on any item to see its event
				log. The metrics up top recompute from that log in real time.
			</section>

			{metrics && (
				<section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
					<Stat label="Median time-to-live" value={fmtMin(metrics.medianTimeToLiveMin)} sub={`p90 ${fmtMin(metrics.p90TimeToLiveMin)}`} />
					<Stat label="Avg time-to-live" value={fmtMin(metrics.avgTimeToLiveMin)} />
					<Stat label="ScanGate pass rate" value={metrics.passRate == null ? "—" : `${Math.round(metrics.passRate * 100)}%`} />
					<Stat label="Live" value={String(metrics.live)} />
					<Stat label="Exceptions" value={String(metrics.exception)} />
					<Stat label="In-flight" value={String(metrics.inFlight)} />
				</section>
			)}

			<section className="mb-6 rounded-xl border border-white/10 bg-white/[0.02] p-4">
				<div className="mb-2 text-xs uppercase tracking-wide text-white/40">Simulate intake — runs a scan through ScanGate live</div>
				<div className="flex flex-wrap gap-2">
					{VARIANTS.map((v) => (
						<button
							key={v}
							type="button"
							disabled={busy}
							onClick={() => intake(v)}
							className="rounded-lg border border-white/15 bg-white/[0.03] px-3 py-1.5 text-sm capitalize hover:bg-white/10 disabled:opacity-40"
						>
							{v}
						</button>
					))}
				</div>
				{flash && <div className="mt-3 text-sm text-white/70">{flash}</div>}
			</section>

			<div className="grid gap-6 lg:grid-cols-2">
				<section>
					<h2 className="mb-3 text-sm font-semibold text-emerald-400/90">Live inventory · {live.length}</h2>
					<div className="space-y-2">
						{live.map((i) => <ItemCard key={i.id} item={i} onOverride={override} />)}
						{!live.length && <div className="text-sm text-white/30">nothing live yet</div>}
					</div>
				</section>
				<section>
					<h2 className="mb-3 text-sm font-semibold text-rose-400/90">Exception queue · {exceptions.length}</h2>
					<div className="space-y-2">
						{exceptions.map((i) => <ItemCard key={i.id} item={i} onOverride={override} />)}
						{!exceptions.length && <div className="text-sm text-white/30">queue clear</div>}
					</div>
				</section>
			</div>

			<section className="mt-8 rounded-xl border border-white/10 bg-white/[0.02] p-4">
				<div className="mb-1 text-sm font-semibold text-sky-400/90">VaultTrace · MCP server</div>
				<p className="mb-3 text-xs text-white/50">
					The same event log is exposed as a Model Context Protocol server, so an agent
					(or you, in Claude Code) can ask where any item is and what happened to it — in
					plain English, not SQL. Four read-only tools: <code className="text-white/70">where_is_item</code>,{" "}
					<code className="text-white/70">item_history</code>, <code className="text-white/70">list_exceptions</code>,{" "}
					<code className="text-white/70">vault_stats</code>.
				</p>
				<pre className="overflow-x-auto rounded-lg border border-white/10 bg-black/40 p-3 text-xs leading-relaxed text-white/70">
{`> where_is_item("Bennett")
  Bennett Crowe (TC-0009) is held in the QC exception queue (not live).
  Last ScanGate verdict: FAIL — Card is rotated and off-center in the frame.

> item_history("TC-0005")
  received → scanned → ScanGate FAILED — label_mismatch`}
				</pre>
			</section>

			<footer className="mt-8 border-t border-white/10 pt-4 text-xs text-white/40">
				Portfolio demo for Alt's Vault founding-engineer role · full source, incl. the
				ScanGate gate and VaultTrace MCP server, at{" "}
				<a
					href="https://github.com/ahonnecke/alt.vault"
					className="text-white/70 underline hover:text-white"
					target="_blank"
					rel="noopener noreferrer"
				>
					github.com/ahonnecke/alt.vault
				</a>
			</footer>
		</main>
	);
}
