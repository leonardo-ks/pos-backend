import { Pool } from "pg";

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    "postgres://postgres:postgres@localhost:5432/pos_kasir",
});

for (const view of [
  "report_daily_sales",
  "report_daily_purchases",
  "report_daily_returns",
  "report_daily_cash",
]) {
  try {
    await pool.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${view}`);
    console.log(`Refreshed ${view}`);
  } catch (error) {
    if (error?.code === "42P01") {
      console.warn(`Skipped missing materialized view ${view}`);
      continue;
    }
    throw error;
  }
}

await pool.end();
