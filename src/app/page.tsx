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
						className="h-28 w-[84px] shrink-0 rounded-md border border-white/10 object-cover"
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
						manifest: {item.manifest.set}
						{item.manifest.cardNumber && item.manifest.cardNumber !== "n/a" ? ` · #${item.manifest.cardNumber}` : ""} · {item.manifest.year}
						{item.manifest.grade ? ` · ${item.manifest.grade}` : ""}
					</div>
					{v && (
						<div className={`mt-1 text-xs ${v.pass ? "text-emerald-400/90" : "text-rose-400/90"}`}>
							{v.pass ? "PASS" : "FAIL"} · {Math.round(v.confidence * 100)}% · {v.summary}
						</div>
					)}
					{v && v.issues.length > 0 && (
						<ul className="mt-1 list-disc pl-4 text-[11px] text-white/50">
							{v.issues.map((iss, k) => (
								<li key={k}>
									{iss.type} ({iss.severity}) — {iss.detail}
								</li>
							))}
						</ul>
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

function TraceBox() {
	const [q, setQ] = useState("");
	const [res, setRes] = useState<{ found: boolean; query?: string; where?: string; events?: string[] } | null>(null);
	const [loading, setLoading] = useState(false);

	const ask = async (query: string) => {
		setQ(query);
		setLoading(true);
		const r = await fetch(`/api/trace?q=${encodeURIComponent(query)}`).then((x) => x.json());
		setRes(r);
		setLoading(false);
	};

	const suggestions = ["MTG-0003", "MTG-0009", "Crystal Rod", "Wings of Hope"];
	return (
		<div>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					if (q.trim()) ask(q.trim());
				}}
				className="flex gap-2"
			>
				<input
					value={q}
					onChange={(e) => setQ(e.target.value)}
					placeholder="a SKU, card name, or id…"
					className="flex-1 rounded-lg border border-white/15 bg-black/30 px-3 py-1.5 text-sm outline-none focus:border-sky-400/50"
				/>
				<button type="submit" className="rounded-lg border border-sky-400/40 bg-sky-400/10 px-3 py-1.5 text-sm text-sky-200 hover:bg-sky-400/20">
					ask
				</button>
			</form>
			<div className="mt-2 flex flex-wrap gap-2">
				{suggestions.map((s) => (
					<button
						key={s}
						type="button"
						onClick={() => ask(s)}
						className="rounded-full border border-white/15 bg-white/[0.03] px-2.5 py-0.5 text-xs text-white/60 hover:bg-white/10"
					>
						{s}
					</button>
				))}
			</div>
			{loading && <div className="mt-3 text-xs text-white/40">querying…</div>}
			{res && !loading && (
				res.found ? (
					<div className="mt-3 space-y-2">
						<pre className="whitespace-pre-wrap rounded-lg border border-white/10 bg-black/40 p-3 text-xs leading-relaxed text-white/80">{res.where}</pre>
						<pre className="overflow-x-auto rounded-lg border border-white/10 bg-black/40 p-3 text-[11px] leading-relaxed text-white/50">{res.events?.join("\n")}</pre>
					</div>
				) : (
					<div className="mt-3 text-sm text-white/50">No item matches “{res.query}”.</div>
				)
			)}
		</div>
	);
}

export default function Home() {
	const [items, setItems] = useState<Item[]>([]);
	const [metrics, setMetrics] = useState<Metrics | null>(null);

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
					photographed, and either goes live for sale or is held for a bad scan. The metric a
					real vault drives down: time from item received to live.
				</p>
			</header>

			<section className="mb-6 rounded-xl border border-sky-500/20 bg-sky-500/[0.04] p-4 text-sm text-white/70">
				<div className="mb-1 font-semibold text-sky-300/90">This inventory is real</div>
				Every card below is an actual image — real phone photos of Magic: The Gathering cards,
				plus two catalog scans — run through <span className="text-white/90">Claude vision
				(claude-sonnet-5)</span>, which compares each image to its manifest and writes the verdict
				you see. <span className="text-emerald-400">Green</span> passed QC and went live;{" "}
				<span className="text-rose-400">red</span> was held. Claude fails a blurry scan it can&rsquo;t
				verify and a card whose label doesn&rsquo;t match its record, and passes
				marginal-but-legible ones — its own call, shown per card. Click{" "}
				<span className="text-white/90">chain of custody</span> for the event log, or{" "}
				<span className="text-amber-300">override → live</span> to release a held item.
			</section>

			{metrics && (
				<section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
					<Stat label="ScanGate pass rate" value={metrics.passRate == null ? "—" : `${Math.round(metrics.passRate * 100)}%`} />
					<Stat label="Live" value={String(metrics.live)} />
					<Stat label="Exceptions held" value={String(metrics.exception)} />
					<Stat label="Total items" value={String(metrics.total)} />
				</section>
			)}

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
				<div className="mb-1 text-sm font-semibold text-sky-400/90">VaultTrace · ask where an item is</div>
				<p className="mb-3 text-xs text-white/50">
					&ldquo;Where is this item and what happened to it&rdquo; — one query over the event log,
					not a one-off. This box is the <span className="text-white/70">REST door</span>; the same
					functions are exposed to agents as a <span className="text-white/70">Model Context Protocol
					server</span> (tools <code className="text-white/70">where_is_item</code>,{" "}
					<code className="text-white/70">item_history</code>, <code className="text-white/70">list_exceptions</code>,{" "}
					<code className="text-white/70">vault_stats</code>) so Claude Code can ask it in plain English.
					One service, two front doors.
				</p>
				<TraceBox />
			</section>

			<footer className="mt-8 border-t border-white/10 pt-4 text-xs text-white/40">
				Portfolio demo for Alt&rsquo;s Vault founding-engineer role · full source, incl. the
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
