import { config } from "dotenv";
config({ path: ".env.local" });

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { findItem, getEvents, getMetrics, listItems } from "../src/lib/repo";
import { describeEvent, resolveTrace } from "../src/lib/trace";

// VaultTrace — the MCP (agent-facing) door onto the vault-trace service in
// src/lib/trace.ts. The web box on the dashboard is the other door onto the
// same functions. Everything here is read-only.

const server = new McpServer({ name: "vaulttrace", version: "0.1.0" });

server.registerTool(
	"where_is_item",
	{
		title: "Where is an item",
		description:
			"Locate a vaulted item and give its current state in one sentence. " +
			"Accepts an item id, SKU (e.g. MTG-0001), or part of the title.",
		inputSchema: { query: z.string().describe("id, SKU, or title fragment") },
	},
	async ({ query }) => {
		const r = await resolveTrace(query);
		return {
			content: [
				{ type: "text", text: r.found ? (r.where as string) : `No vault item matches "${query}".` },
			],
		};
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
			const reasons = i.lastVerdict?.issues.map((x) => x.type).join(", ") || "unknown";
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
			"Summarize the vault pipeline: counts by state and the ScanGate pass rate.",
		inputSchema: {},
	},
	async () => {
		const m = await getMetrics();
		const text = [
			`Vault pipeline — ${m.total} items total.`,
			`Live: ${m.live} · Exceptions: ${m.exception} · In-flight: ${m.inFlight}.`,
			`ScanGate pass rate: ${m.passRate == null ? "n/a" : `${(m.passRate * 100).toFixed(0)}%`}.`,
		].join("\n");
		return { content: [{ type: "text", text }] };
	},
);

async function main(): Promise<void> {
	const transport = new StdioServerTransport();
	await server.connect(transport);
	console.error("VaultTrace MCP server ready (stdio).");
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
