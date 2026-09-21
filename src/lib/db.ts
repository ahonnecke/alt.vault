import { Pool, type PoolClient } from "pg";

// Single shared pool. Next.js hot-reload re-imports modules, so stash the pool
// on globalThis to avoid leaking connections across reloads.
const globalForPg = globalThis as unknown as { __vaultPool?: Pool };

const connectionString =
	process.env.DATABASE_URL ?? "postgres://vault:vault@localhost:5434/vault";

// Managed hosts (Neon, etc.) require TLS. Local docker Postgres does not.
const needsSsl =
	/sslmode=require/.test(connectionString) ||
	(!/localhost|127\.0\.0\.1/.test(connectionString) &&
		process.env.PGSSL !== "disable");

export const pool: Pool =
	globalForPg.__vaultPool ??
	new Pool({
		connectionString,
		max: 8,
		ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
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
