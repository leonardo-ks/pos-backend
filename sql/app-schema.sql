CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  auth_user_id TEXT UNIQUE,
  nama TEXT NOT NULL,
  email TEXT UNIQUE,
  username TEXT UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('kasir', 'manajer', 'administrator')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS auth_user_id TEXT,
  ADD COLUMN IF NOT EXISTS nama TEXT NOT NULL DEFAULT 'User',
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'kasir',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_auth_user_id_unique
  ON users(auth_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique
  ON users(email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_unique
  ON users(username);

CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  nama TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  kategori_diskon TEXT NOT NULL DEFAULT 'Reguler',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  nama_produk TEXT NOT NULL,
  sku TEXT NOT NULL UNIQUE,
  harga NUMERIC(12, 2) NOT NULL CHECK (harga >= 0),
  stok INTEGER NOT NULL DEFAULT 0 CHECK (stok >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  user_id INTEGER NOT NULL REFERENCES users(id),
  subtotal NUMERIC(12, 2) NOT NULL CHECK (subtotal >= 0),
  discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  total_akhir NUMERIC(12, 2) NOT NULL CHECK (total_akhir >= 0)
);

CREATE TABLE IF NOT EXISTS transaction_items (
  id SERIAL PRIMARY KEY,
  transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  jumlah_beli INTEGER NOT NULL CHECK (jumlah_beli > 0),
  harga_satuan NUMERIC(12, 2) NOT NULL CHECK (harga_satuan >= 0),
  subtotal NUMERIC(12, 2) NOT NULL CHECK (subtotal >= 0)
);

CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transaction_items_transaction_id
  ON transaction_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_items_product_id
  ON transaction_items(product_id);
