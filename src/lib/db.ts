import { Pool, type PoolClient, type QueryResultRow } from "pg";

const globalForPg = globalThis as unknown as { pgPool?: Pool };

function getPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required.");
  }

  if (!globalForPg.pgPool) {
    globalForPg.pgPool = new Pool({
      connectionString,
      max: 10,
    });
  }

  return globalForPg.pgPool;
}

export async function query<T extends QueryResultRow>(
  text: string,
  values: unknown[] = [],
) {
  const startedAt = Date.now();
  try {
    return await getPool().query<T>(text, values);
  } finally {
    const durationMs = Date.now() - startedAt;
    if (durationMs >= Number(process.env.SLOW_QUERY_MS ?? 500)) {
      console.warn("Slow SQL query", {
        durationMs,
        values: values.length,
        sql: text.replace(/\s+/g, " ").trim().slice(0, 500),
      });
    }
  }
}

export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>,
) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
