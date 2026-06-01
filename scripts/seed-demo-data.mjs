import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Pool } from "pg";

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    "postgres://postgres:postgres@localhost:5432/pos_kasir",
});

const files = [
  "demo-master-data.sql",
  "demo-business-data.sql",
  "customer-group-discounts.sql",
];

for (const file of files) {
  const sql = await readFile(join("sql", file), "utf8");
  await pool.query(sql);
  console.log(`Applied ${file}`);
}

await pool.end();
