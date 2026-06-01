import { Pool } from "pg";

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    "postgres://postgres:postgres@localhost:5432/pos_kasir",
});

const productCount = Number(process.env.LARGE_PRODUCT_COUNT ?? 10_000);
const customerCount = Number(process.env.LARGE_CUSTOMER_COUNT ?? 10_000);
const transactionCount = Number(process.env.LARGE_TRANSACTION_COUNT ?? 100_000);

await pool.query("BEGIN");
try {
  await pool.query(`
    INSERT INTO customers (nama, phone, kategori_diskon)
    SELECT 'Pelanggan Load ' || gs,
           '0899' || lpad(gs::text, 8, '0'),
           'Reguler'
    FROM generate_series(1, $1::INTEGER) gs
    ON CONFLICT (phone) DO NOTHING
  `, [customerCount]);

  await pool.query(`
    INSERT INTO products (nama_produk, sku, harga, stok, harga_beli, category_id)
    SELECT 'Produk Load ' || gs,
           'LOAD-' || lpad(gs::text, 8, '0'),
           1000 + (gs % 50000),
           100000,
           800 + (gs % 30000),
           (SELECT id FROM product_categories ORDER BY id LIMIT 1)
    FROM generate_series(1, $1::INTEGER) gs
    ON CONFLICT (sku) DO NOTHING
  `, [productCount]);

  await pool.query(`
    INSERT INTO transactions
      (created_at, customer_id, user_id, subtotal, discount_amount, total_akhir,
       paid_amount, remaining_amount, payment_status, payment_method,
       cash_received, change_amount)
    SELECT NOW() - ((gs % 365) || ' days')::INTERVAL,
           (SELECT id FROM customers ORDER BY random() LIMIT 1),
           (SELECT id FROM users ORDER BY id LIMIT 1),
           10000,
           0,
           10000,
           10000,
           0,
           'paid',
           'cash',
           10000,
           0
    FROM generate_series(1, $1::INTEGER) gs
  `, [transactionCount]);

  await pool.query(`
    INSERT INTO transaction_items
      (transaction_id, product_id, jumlah_beli, harga_satuan, subtotal)
    SELECT t.id,
           (SELECT id FROM products ORDER BY random() LIMIT 1),
           1 + (t.id % 5),
           10000,
           (1 + (t.id % 5)) * 10000
    FROM transactions t
    WHERE NOT EXISTS (
      SELECT 1 FROM transaction_items ti WHERE ti.transaction_id = t.id
    )
  `);

  await pool.query("COMMIT");
  console.log(
    `Seeded large data: products=${productCount}, customers=${customerCount}, transactions=${transactionCount}`,
  );
} catch (error) {
  await pool.query("ROLLBACK");
  throw error;
} finally {
  await pool.end();
}

