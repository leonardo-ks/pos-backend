ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'cash';

CREATE TABLE IF NOT EXISTS discount_categories (
  id SERIAL PRIMARY KEY,
  kode TEXT NOT NULL UNIQUE,
  nama TEXT NOT NULL,
  rate NUMERIC(5, 4) NOT NULL DEFAULT 0 CHECK (rate >= 0 AND rate <= 1),
  keterangan TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO discount_categories (id, kode, nama, rate, keterangan)
VALUES
  (1, 'Reguler', 'Reguler', 0, 'Pelanggan tanpa diskon khusus'),
  (2, 'VIP', 'VIP', 0.10, 'Diskon pelanggan VIP'),
  (3, 'Gold', 'Gold', 0.15, 'Diskon pelanggan Gold')
ON CONFLICT (id) DO UPDATE
SET kode = EXCLUDED.kode,
    nama = EXCLUDED.nama,
    rate = EXCLUDED.rate,
    keterangan = EXCLUDED.keterangan,
    updated_at = NOW();

SELECT setval('discount_categories_id_seq', GREATEST((SELECT MAX(id) FROM discount_categories), 1), true);
