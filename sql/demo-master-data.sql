INSERT INTO users (id, nama, email, username, role)
VALUES
  (1, 'Dewi Kasir', 'kasir@pos.local', 'kasir', 'kasir'),
  (2, 'Bima Manajer', 'manajer@pos.local', 'manajer', 'manajer')
ON CONFLICT (id) DO UPDATE
SET nama = EXCLUDED.nama,
    email = EXCLUDED.email,
    username = EXCLUDED.username,
    role = EXCLUDED.role;

SELECT setval('users_id_seq', GREATEST((SELECT MAX(id) FROM users), 1), true);

INSERT INTO customers (id, nama, phone, kategori_diskon)
VALUES
  (1, 'Rani Wijaya', '081210002000', 'VIP'),
  (2, 'Agus Santoso', '081344441111', 'Reguler'),
  (3, 'Maya Pratama', '081922223333', 'Gold')
ON CONFLICT (id) DO UPDATE
SET nama = EXCLUDED.nama,
    phone = EXCLUDED.phone,
    kategori_diskon = EXCLUDED.kategori_diskon,
    updated_at = NOW();

SELECT setval('customers_id_seq', GREATEST((SELECT MAX(id) FROM customers), 1), true);

INSERT INTO products (id, nama_produk, sku, harga, stok)
VALUES
  (1, 'Kopi Susu Botol', 'DRK-001', 18000, 34),
  (2, 'Roti Cokelat', 'BKR-014', 12000, 18),
  (3, 'Beras Premium 5kg', 'GRC-500', 72000, 12),
  (4, 'Minyak Goreng 1L', 'GRC-110', 21000, 24),
  (5, 'Sabun Cair', 'HHC-020', 16500, 9),
  (6, 'Teh Melati Dus', 'DRK-044', 32000, 16)
ON CONFLICT (id) DO UPDATE
SET nama_produk = EXCLUDED.nama_produk,
    sku = EXCLUDED.sku,
    harga = EXCLUDED.harga,
    stok = EXCLUDED.stok,
    updated_at = NOW();

SELECT setval('products_id_seq', GREATEST((SELECT MAX(id) FROM products), 1), true);
