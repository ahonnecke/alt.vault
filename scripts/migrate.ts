import { config } from "dotenv";
config({ path: ".env.local" });

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pool } from "../src/lib/db";

async function main(): Promise<void> {
	const sql = await readFile(join(process.cwd(), "db", "schema.sql"), "utf8");
	await pool.query(sql);
	console.log("Schema applied.");
	await pool.end();
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
