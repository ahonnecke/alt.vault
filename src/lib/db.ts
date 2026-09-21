import { Pool, type PoolClient } from "pg";

// Single shared pool. Next.js hot-reload re-imports modules, so stash the pool
// on globalThis to avoid leaking connections across reloads.
const globalForPg = globalThis as unknown as { __vaultPool?: Pool };

export const pool: Pool =
	globalForPg.__vaultPool ??
	new Pool({
		connectionString:
			process.env.DATABASE_URL ??
			"postgres://vault:vault@localhost:5434/vault",
		max: 8,
	});

if (process.env.NODE_ENV !== "production") globalForPg.__vaultPool = pool;

/** Run `fn` inside a transaction, rolling back on any throw. */
export async function withTx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
	const client = await pool.connect();
	try {
		await client.query("begin");
		const out = await fn(client);
		await client.query("commit");
		return out;
	} catch (err) {
		await client.query("rollback");
		throw err;
	} finally {
		client.release();
	}
}
