import { Pool } from "pg";

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    "postgres://postgres:postgres@localhost:5432/pos_kasir",
});

const checks = {
  "POS product search": `
    EXPLAIN (ANALYZE, BUFFERS)
    SELECT id, nama_produk, sku
    FROM products
    WHERE deleted_at IS NULL
      AND (nama_produk ILIKE '%Load%' OR sku ILIKE '%Load%')
    ORDER BY LOWER(nama_produk), id
    LIMIT 50
  `,
  "Recent sales report": `
    EXPLAIN (ANALYZE, BUFFERS)
    SELECT t.id, t.created_at, t.total_akhir
    FROM transactions t
    WHERE t.created_at >= date_trunc('month', now())
    ORDER BY t.created_at DESC, t.id DESC
    LIMIT 50
  `,
  "Stock movement lookup": `
    EXPLAIN (ANALYZE, BUFFERS)
    SELECT sm.id, sm.created_at, sm.product_id
    FROM stock_movements sm
    ORDER BY sm.created_at DESC, sm.id DESC
    LIMIT 50
  `,
};

for (const [name, sql] of Object.entries(checks)) {
  console.log(`\n=== ${name} ===`);
  const result = await pool.query(sql);
  console.log(result.rows.map((row) => row["QUERY PLAN"]).join("\n"));
}

await pool.end();

