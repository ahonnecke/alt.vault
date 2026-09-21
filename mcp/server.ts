import { config } from "dotenv";
config({ path: ".env.local" });

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import type { Item, VaultEvent } from "../src/lib/domain";
import { timeToLiveMinutes } from "../src/lib/domain";
import {
	findItem,
	getEvents,
	getMetrics,
	listItems,
} from "../src/lib/repo";

// VaultTrace — an MCP server over the vault's inventory + event log, so
// "where is this item and what happened to it" is one sentence, not a query.
// Everything below is read-only.

const LOCATION: Record<Item["state"], string> = {
	received: "at intake, awaiting imaging",
	scanned: "on the imaging line",
	exception: "held in the QC exception queue (not live)",
	live: "live on the platform, in the vault and sellable",
};

function describeEvent(e: VaultEvent): string {
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

function whereText(item: Item): string {
	const ttl = timeToLiveMinutes(item);
	const v = item.lastVerdict;
	const lines = [
		`${item.title} (${item.sku}) is ${LOCATION[item.state]}.`,
		`Category: ${item.category}. Manifest: ${item.manifest.set} #${item.manifest.cardNumber}, ${item.manifest.year}${item.manifest.grade ? `, ${item.manifest.grade}` : ""}.`,
	];
	if (v) lines.push(`Last ScanGate verdict: ${v.pass ? "PASS" : "FAIL"} — ${v.summary}`);
	if (ttl != null) lines.push(`Time from received to live: ${ttl.toFixed(1)} min.`);
	else lines.push("Not yet live.");
	return lines.join("\n");
}

const server = new McpServer({ name: "vaulttrace", version: "0.1.0" });

server.registerTool(
	"where_is_item",
	{
		title: "Where is an item",
		description:
			"Locate a vaulted item and give its current state in one sentence. " +
			"Accepts an item id, SKU (e.g. TC-0001), or part of the title.",
		inputSchema: { query: z.string().describe("id, SKU, or title fragment") },
	},
	async ({ query }) => {
		const item = await findItem(query);
		if (!item)
			return { content: [{ type: "text", text: `No vault item matches "${query}".` }] };
		return { content: [{ type: "text", text: whereText(item) }] };
	},
);

server.registerTool(
	"item_history",
	{
		title: "Item history",
		description:
			"Return the full chain of custody (every logged event) for one item, " +
			"newest last. Accepts an item id, SKU, or title fragment.",
		inputSchema: { query: z.string().describe("id, SKU, or title fragment") },
	},
	async ({ query }) => {
		const item = await findItem(query);
		if (!item)
			return { content: [{ type: "text", text: `No vault item matches "${query}".` }] };
		const events = await getEvents(item.id);
		const body = events.map(describeEvent).join("\n");
		return {
			content: [
				{ type: "text", text: `${item.title} (${item.sku}) — chain of custody:\n${body}` },
			],
		};
	},
);

server.registerTool(
	"list_exceptions",
	{
		title: "List QC exceptions",
		description:
			"List every item currently held in the QC exception queue, with the " +
			"defect ScanGate flagged. These are items NOT live because of a scan problem.",
		inputSchema: {},
	},
	async () => {
		const items = await listItems("exception");
		if (!items.length)
			return { content: [{ type: "text", text: "Exception queue is empty." }] };
		const rows = items.map((i) => {
			const reasons =
				i.lastVerdict?.issues.map((x) => x.type).join(", ") || "unknown";
			return `${i.sku}  ${i.title}  —  ${reasons}  (${i.lastVerdict?.summary ?? ""})`;
		});
		return {
			content: [
				{ type: "text", text: `${items.length} item(s) in the exception queue:\n${rows.join("\n")}` },
			],
		};
	},
);

server.registerTool(
	"vault_stats",
	{
		title: "Vault stats",
		description:
			"Summarize the vault pipeline: counts by state, ScanGate pass rate, and " +
			"the time-from-received-to-live metric (avg / median / p90).",
		inputSchema: {},
	},
	async () => {
		const m = await getMetrics();
		const min = (n: number | null) => (n == null ? "n/a" : `${n.toFixed(1)} min`);
		const text = [
			`Vault pipeline — ${m.total} items total.`,
			`Live: ${m.live} · Exceptions: ${m.exception} · In-flight: ${m.inFlight}.`,
			`ScanGate pass rate: ${m.passRate == null ? "n/a" : `${(m.passRate * 100).toFixed(0)}%`}.`,
			`Time to live — avg ${min(m.avgTimeToLiveMin)}, median ${min(m.medianTimeToLiveMin)}, p90 ${min(m.p90TimeToLiveMin)}.`,
		].join("\n");
		return { content: [{ type: "text", text }] };
	},
);

async function main(): Promise<void> {
	const transport = new StdioServerTransport();
	await server.connect(transport);
	// Never write to stdout — it's the protocol channel. Logs go to stderr.
	console.error("VaultTrace MCP server ready (stdio).");
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
