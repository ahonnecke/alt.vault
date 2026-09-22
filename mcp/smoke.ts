// Smoke test: spawn the VaultTrace MCP server over stdio and call each tool.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function main(): Promise<void> {
	const transport = new StdioClientTransport({
		command: "npx",
		args: ["tsx", "mcp/server.ts"],
	});
	const client = new Client({ name: "smoke", version: "0.1.0" });
	await client.connect(transport);

	const tools = await client.listTools();
	console.log("TOOLS:", tools.tools.map((t) => t.name).join(", "));

	const call = async (name: string, args: Record<string, unknown> = {}) => {
		const r = await client.callTool({ name, arguments: args });
		const text = (r.content as { type: string; text: string }[])
			.filter((c) => c.type === "text")
			.map((c) => c.text)
			.join("\n");
		console.log(`\n=== ${name}(${JSON.stringify(args)}) ===\n${text}`);
	};

	await call("vault_stats");
	await call("list_exceptions");
	await call("where_is_item", { query: "MTG-0001" });
	await call("item_history", { query: "MTG-0009" });
	await call("where_is_item", { query: "Crystal Rod" });

	await client.close();
	process.exit(0);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
