CREATE TABLE IF NOT EXISTS customer_group_discounts (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES product_categories(id) ON DELETE CASCADE,
  rate NUMERIC(5, 4) NOT NULL DEFAULT 0 CHECK (rate >= 0 AND rate <= 1),
  keterangan TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (customer_id, category_id)
);

INSERT INTO customer_group_discounts (customer_id, category_id, rate, keterangan)
SELECT c.id, pc.id, dc.rate, 'Migrasi kategori diskon pelanggan'
FROM customers c
JOIN discount_categories dc ON LOWER(dc.kode) = LOWER(c.kategori_diskon)
CROSS JOIN product_categories pc
WHERE dc.rate > 0
ON CONFLICT (customer_id, category_id) DO NOTHING;
