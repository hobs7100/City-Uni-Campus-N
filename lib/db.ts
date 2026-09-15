import { Pool } from "pg";

declare global {
  var __pgPool: Pool | undefined;
}

function createPool() {
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    throw new Error("SUPABASE_DB_URL is not set");
  }
  const databaseUrl = new URL(connectionString);
  // Supabase's session pooler (5432) has a small persistent-session quota.
  // Next.js server contexts should use the transaction pooler (6543), which
  // multiplexes short-lived queries instead of reserving one backend session
  // per application connection.
  if (
    databaseUrl.hostname.endsWith(".pooler.supabase.com") &&
    (databaseUrl.port === "" || databaseUrl.port === "5432")
  ) {
    databaseUrl.port = "6543";
  }
  return new Pool({
    connectionString: databaseUrl.toString(),
    ssl: { rejectUnauthorized: false },
    // Next.js may instantiate this module in multiple server contexts. Keep
    // each context to one session so Supabase's session-pool limit is not
    // exhausted; pg queues concurrent work until the connection is available.
    max: 1,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 5_000,
  });
}

export const pool = global.__pgPool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  global.__pgPool = pool;
}

export async function query<T = unknown>(text: string, params?: unknown[]) {
  const result = await pool.query(text, params);
  return result.rows as T[];
}

export async function queryOne<T = unknown>(text: string, params?: unknown[]) {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export async function getClient() {
  return pool.connect();
}
