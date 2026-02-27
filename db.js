/* ═══════════════════════════════════════════════════
   TWWDA — Database Helper
   withDb: acquires a client, runs a callback that
   returns a query result, releases the client, and
   returns the rows array directly.
   ═══════════════════════════════════════════════════ */

import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Log pool errors without crashing — let the pool recover
pool.on("error", (err) => {
  console.error("Unexpected error on idle PostgreSQL client:", err.message);
});

/**
 * Acquires a client from the pool, runs `fn(client)`,
 * releases the client, and returns the query rows.
 *
 * Usage:
 *   const rows = await withDb(client => client.query(sql, params));
 */
export async function withDb(fn) {
  const client = await pool.connect();
  try {
    const result = await fn(client);
    return result.rows;
  } finally {
    client.release();
  }
}
