BEGIN;

DELETE FROM stock_movements WHERE id BETWEEN 1001 AND 1999;
DELETE FROM payable_payments WHERE id BETWEEN 1001 AND 1999;
DELETE FROM receivable_payments WHERE id BETWEEN 1001 AND 1999;
DELETE FROM payables WHERE id BETWEEN 1001 AND 1999 OR purchase_id BETWEEN 1001 AND 1999;
DELETE FROM receivables WHERE id BETWEEN 1001 AND 1999 OR transaction_id BETWEEN 1001 AND 1999;
DELETE FROM purchase_return_items WHERE purchase_return_id BETWEEN 1001 AND 1999;
DELETE FROM purchase_returns WHERE id BETWEEN 1001 AND 1999;
DELETE FROM sales_return_items WHERE sales_return_id BETWEEN 1001 AND 1999;
DELETE FROM sales_returns WHERE id BETWEEN 1001 AND 1999;
DELETE FROM purchase_items WHERE purchase_id BETWEEN 1001 AND 1999;
DELETE FROM purchases WHERE id BETWEEN 1001 AND 1999;
DELETE FROM transaction_items WHERE transaction_id BETWEEN 1001 AND 1999;
DELETE FROM transactions WHERE id BETWEEN 1001 AND 1999;
DELETE FROM cash_entries WHERE id BETWEEN 1001 AND 1999;

INSERT INTO suppliers (id, kode, nama, alamat, telepon, keterangan)
VALUES
  (1, 'SUP-001', 'PT Sumber Pangan Nusantara', 'Jl. Raya Pasar Induk No. 12, Jakarta', '02177881200', 'Suplier sembako utama'),
  (2, 'SUP-002', 'CV Roti Makmur', 'Jl. Melati No. 8, Bandung', '02255663344', 'Produk roti dan bakery'),
  (3, 'SUP-003', 'UD Sejuk Minuman', 'Jl. Kenanga No. 21, Tangerang', '02188994411', 'Minuman botol dan dus'),
  (4, 'SUP-004', 'PT Bersih Rumah Tangga', 'Jl. Industri Selatan No. 5, Bekasi', '02166559080', 'Produk rumah tangga')
ON CONFLICT (id) DO UPDATE
SET kode = EXCLUDED.kode,
    nama = EXCLUDED.nama,
    alamat = EXCLUDED.alamat,
    telepon = EXCLUDED.telepon,
    keterangan = EXCLUDED.keterangan,
    updated_at = NOW();

INSERT INTO locations (id, kode, nama, keterangan)
VALUES
  (1, 'UTM', 'Gudang Utama', 'Penyimpanan stok grosir dan karton'),
  (2, 'TOKO', 'Area Toko', 'Stok siap jual di rak toko'),
  (3, 'ETL', 'Etalase Depan', 'Display produk cepat laku')
ON CONFLICT (id) DO UPDATE
SET kode = EXCLUDED.kode,
    nama = EXCLUDED.nama,
    keterangan = EXCLUDED.keterangan,
    updated_at = NOW();

INSERT INTO product_categories (id, kode, nama, keterangan)
VALUES
  (1, 'DRK', 'Minuman', 'Produk minuman botol, dus, dan siap konsumsi'),
  (2, 'BKR', 'Roti dan Bakery', 'Roti, kue, dan makanan ringan bakery'),
  (3, 'GRC', 'Sembako', 'Kebutuhan pokok harian'),
  (4, 'HHC', 'Rumah Tangga', 'Produk kebersihan dan rumah tangga')
ON CONFLICT (id) DO UPDATE
SET kode = EXCLUDED.kode,
    nama = EXCLUDED.nama,
    keterangan = EXCLUDED.keterangan,
    updated_at = NOW();

INSERT INTO customers (id, nama, phone, kategori_diskon)
VALUES
  (1, 'Rani Wijaya', '081210002000', 'VIP'),
  (2, 'Agus Santoso', '081344441111', 'Reguler'),
  (3, 'Maya Pratama', '081922223333', 'Gold'),
  (4, 'Toko Bu Sari', '081270004455', 'VIP'),
  (5, 'Warung Pak Anton', '082190001188', 'Gold')
ON CONFLICT (id) DO UPDATE
SET nama = EXCLUDED.nama,
    phone = EXCLUDED.phone,
    kategori_diskon = EXCLUDED.kategori_diskon,
    updated_at = NOW();

INSERT INTO products
  (id, nama_produk, sku, harga, stok, supplier_id, category_id, barcode, harga_beli)
VALUES
  (1, 'Kopi Susu Botol', 'DRK-001', 18000, 76, 3, 1, '8997001000011', 10500),
  (2, 'Roti Cokelat', 'BKR-014', 12000, 33, 2, 2, '8997001000012', 7200),
  (3, 'Beras Premium 5kg', 'GRC-500', 72000, 33, 1, 3, '8997001000013', 62000),
  (4, 'Minyak Goreng 1L', 'GRC-110', 21000, 44, 1, 3, '8997001000014', 19000),
  (5, 'Sabun Cair', 'HHC-020', 16500, 28, 4, 4, '8997001000015', 11200),
  (6, 'Teh Melati Dus', 'DRK-044', 32000, 43, 3, 1, '8997001000016', 24000),
  (7, 'Gula Pasir 1kg', 'GRC-120', 24000, 55, 1, 3, '8997001000017', 15200),
  (8, 'Telur Ayam Pack', 'GRC-210', 32000, 36, 1, 3, '8997001000018', 26500),
  (9, 'Air Mineral 600ml', 'DRK-200', 4000, 168, 3, 1, '8997001000019', 2500),
  (10, 'Mi Instan Goreng', 'GRC-330', 3800, 150, 1, 3, '8997001000020', 2850)
ON CONFLICT (id) DO UPDATE
SET nama_produk = EXCLUDED.nama_produk,
    sku = EXCLUDED.sku,
    harga = EXCLUDED.harga,
    stok = EXCLUDED.stok,
    supplier_id = EXCLUDED.supplier_id,
    category_id = EXCLUDED.category_id,
    barcode = EXCLUDED.barcode,
    harga_beli = EXCLUDED.harga_beli,
    updated_at = NOW();

INSERT INTO product_location_stocks (product_id, location_id, stock)
VALUES
  (1, 1, 40), (1, 2, 24), (1, 3, 12),
  (2, 1, 18), (2, 2, 10), (2, 3, 5),
  (3, 1, 25), (3, 2, 8), (3, 3, 0),
  (4, 1, 32), (4, 2, 12), (4, 3, 0),
  (5, 1, 18), (5, 2, 6), (5, 3, 4),
  (6, 1, 20), (6, 2, 15), (6, 3, 8),
  (7, 1, 35), (7, 2, 20), (7, 3, 0),
  (8, 1, 24), (8, 2, 12), (8, 3, 0),
  (9, 1, 96), (9, 2, 48), (9, 3, 24),
  (10, 1, 80), (10, 2, 40), (10, 3, 30)
ON CONFLICT (product_id, location_id) DO UPDATE
SET stock = EXCLUDED.stock,
    updated_at = NOW();

INSERT INTO purchases (id, created_at, supplier_id, user_id, total, paid_amount, remaining_amount, keterangan)
VALUES
  (1001, NOW() - INTERVAL '12 days', 1, 2, 2190000, 1500000, 690000, 'Restok sembako bulanan'),
  (1002, NOW() - INTERVAL '5 days', 3, 2, 1248000, 1248000, 0, 'Restok minuman terlaris'),
  (1003, NOW() - INTERVAL '2 days', 3, 2, 1150000, 0, 1150000, 'Pembelian stok akhir pekan')
ON CONFLICT (id) DO UPDATE
SET created_at = EXCLUDED.created_at,
    supplier_id = EXCLUDED.supplier_id,
    user_id = EXCLUDED.user_id,
    total = EXCLUDED.total,
    paid_amount = EXCLUDED.paid_amount,
    remaining_amount = EXCLUDED.remaining_amount,
    keterangan = EXCLUDED.keterangan;

INSERT INTO purchase_items (purchase_id, product_id, location_id, quantity, unit_price, subtotal)
VALUES
  (1001, 3, 1, 20, 62000, 1240000),
  (1001, 4, 1, 30, 19000, 570000),
  (1001, 7, 1, 25, 15200, 380000),
  (1002, 6, 1, 26, 24000, 624000),
  (1002, 9, 1, 250, 2496, 624000),
  (1003, 1, 1, 50, 10500, 525000),
  (1003, 9, 1, 250, 2500, 625000);

INSERT INTO payables (id, purchase_id, supplier_id, total, paid_amount, remaining_amount, status, created_at)
VALUES
  (1001, 1001, 1, 2190000, 1700000, 490000, 'open', NOW() - INTERVAL '12 days'),
  (1003, 1003, 3, 1150000, 0, 1150000, 'open', NOW() - INTERVAL '2 days')
ON CONFLICT (id) DO UPDATE
SET purchase_id = EXCLUDED.purchase_id,
    supplier_id = EXCLUDED.supplier_id,
    total = EXCLUDED.total,
    paid_amount = EXCLUDED.paid_amount,
    remaining_amount = EXCLUDED.remaining_amount,
    status = EXCLUDED.status,
    created_at = EXCLUDED.created_at;

INSERT INTO payable_payments (id, created_at, payable_id, user_id, amount, keterangan)
VALUES
  (1001, NOW() - INTERVAL '1 day', 1001, 2, 200000, 'Pembayaran sebagian hutang SUP-001')
ON CONFLICT (id) DO UPDATE
SET created_at = EXCLUDED.created_at,
    payable_id = EXCLUDED.payable_id,
    user_id = EXCLUDED.user_id,
    amount = EXCLUDED.amount,
    keterangan = EXCLUDED.keterangan;

INSERT INTO transactions
  (id, created_at, customer_id, user_id, subtotal, discount_amount, total_akhir, paid_amount, remaining_amount, payment_status)
VALUES
  (1001, NOW() - INTERVAL '1 day', 1, 1, 126000, 12600, 113400, 113400, 0, 'paid'),
  (1002, NOW() - INTERVAL '8 hours', 2, 1, 210000, 0, 210000, 150000, 60000, 'partial'),
  (1003, NOW() - INTERVAL '3 days', 3, 1, 338000, 16900, 321100, 321100, 0, 'paid'),
  (1004, NOW() - INTERVAL '10 days', 4, 1, 253500, 25350, 228150, 100000, 128150, 'partial')
ON CONFLICT (id) DO UPDATE
SET created_at = EXCLUDED.created_at,
    customer_id = EXCLUDED.customer_id,
    user_id = EXCLUDED.user_id,
    subtotal = EXCLUDED.subtotal,
    discount_amount = EXCLUDED.discount_amount,
    total_akhir = EXCLUDED.total_akhir,
    paid_amount = EXCLUDED.paid_amount,
    remaining_amount = EXCLUDED.remaining_amount,
    payment_status = EXCLUDED.payment_status;

INSERT INTO transaction_items (transaction_id, product_id, jumlah_beli, harga_satuan, subtotal)
VALUES
  (1001, 1, 3, 18000, 54000),
  (1001, 2, 2, 12000, 24000),
  (1001, 9, 12, 4000, 48000),
  (1002, 3, 2, 72000, 144000),
  (1002, 4, 2, 21000, 42000),
  (1002, 7, 1, 24000, 24000),
  (1003, 10, 30, 3800, 114000),
  (1003, 8, 3, 32000, 96000),
  (1003, 6, 4, 32000, 128000),
  (1004, 5, 5, 16500, 82500),
  (1004, 9, 20, 4000, 80000),
  (1004, 1, 5, 18000, 90000),
  (1004, 10, 1, 1000, 1000);

INSERT INTO receivables (id, transaction_id, customer_id, total, paid_amount, remaining_amount, status, created_at)
VALUES
  (1002, 1002, 2, 210000, 150000, 60000, 'open', NOW() - INTERVAL '8 hours'),
  (1004, 1004, 4, 228150, 150000, 78150, 'open', NOW() - INTERVAL '10 days')
ON CONFLICT (id) DO UPDATE
SET transaction_id = EXCLUDED.transaction_id,
    customer_id = EXCLUDED.customer_id,
    total = EXCLUDED.total,
    paid_amount = EXCLUDED.paid_amount,
    remaining_amount = EXCLUDED.remaining_amount,
    status = EXCLUDED.status,
    created_at = EXCLUDED.created_at;

INSERT INTO receivable_payments (id, created_at, receivable_id, user_id, amount, keterangan)
VALUES
  (1001, NOW() - INTERVAL '1 day', 1004, 2, 50000, 'Setoran piutang Toko Bu Sari')
ON CONFLICT (id) DO UPDATE
SET created_at = EXCLUDED.created_at,
    receivable_id = EXCLUDED.receivable_id,
    user_id = EXCLUDED.user_id,
    amount = EXCLUDED.amount,
    keterangan = EXCLUDED.keterangan;

INSERT INTO purchase_returns (id, created_at, purchase_id, supplier_id, user_id, total, keterangan)
VALUES
  (1001, NOW() - INTERVAL '4 days', 1001, 1, 2, 57000, 'Retur minyak kemasan penyok')
ON CONFLICT (id) DO UPDATE
SET created_at = EXCLUDED.created_at,
    purchase_id = EXCLUDED.purchase_id,
    supplier_id = EXCLUDED.supplier_id,
    user_id = EXCLUDED.user_id,
    total = EXCLUDED.total,
    keterangan = EXCLUDED.keterangan;

INSERT INTO purchase_return_items (purchase_return_id, product_id, location_id, quantity, unit_price, subtotal)
VALUES
  (1001, 4, 1, 3, 19000, 57000);

INSERT INTO sales_returns (id, created_at, transaction_id, customer_id, user_id, total, keterangan)
VALUES
  (1001, NOW() - INTERVAL '18 hours', 1001, 1, 2, 12000, 'Retur roti cokelat rusak')
ON CONFLICT (id) DO UPDATE
SET created_at = EXCLUDED.created_at,
    transaction_id = EXCLUDED.transaction_id,
    customer_id = EXCLUDED.customer_id,
    user_id = EXCLUDED.user_id,
    total = EXCLUDED.total,
    keterangan = EXCLUDED.keterangan;

INSERT INTO sales_return_items (sales_return_id, product_id, location_id, quantity, unit_price, subtotal)
VALUES
  (1001, 2, 2, 1, 12000, 12000);

INSERT INTO cash_entries (id, created_at, type, amount, category, description, user_id)
VALUES
  (1001, NOW(), 'in', 500000, 'Modal Tambahan', 'Tambahan kas kecil toko', 2),
  (1002, NOW(), 'out', 150000, 'Operasional', 'Belanja perlengkapan kasir', 2),
  (1003, NOW() - INTERVAL '1 day', 'out', 80000, 'Transport', 'Biaya kurir pembelian stok', 2),
  (1004, NOW() - INTERVAL '1 day', 'in', 50000, 'Setoran Piutang', 'Pembayaran piutang Toko Bu Sari', 2)
ON CONFLICT (id) DO UPDATE
SET created_at = EXCLUDED.created_at,
    type = EXCLUDED.type,
    amount = EXCLUDED.amount,
    category = EXCLUDED.category,
    description = EXCLUDED.description,
    user_id = EXCLUDED.user_id;

INSERT INTO stock_movements (id, created_at, product_id, location_id, qty_in, qty_out, source_type, source_id, keterangan)
VALUES
  (1001, NOW() - INTERVAL '12 days', 3, 1, 20, 0, 'purchase', 1001, 'Pembelian 1001'),
  (1002, NOW() - INTERVAL '12 days', 4, 1, 30, 0, 'purchase', 1001, 'Pembelian 1001'),
  (1003, NOW() - INTERVAL '12 days', 7, 1, 25, 0, 'purchase', 1001, 'Pembelian 1001'),
  (1004, NOW() - INTERVAL '5 days', 6, 1, 26, 0, 'purchase', 1002, 'Pembelian 1002'),
  (1005, NOW() - INTERVAL '5 days', 9, 1, 250, 0, 'purchase', 1002, 'Pembelian 1002'),
  (1006, NOW() - INTERVAL '2 days', 1, 1, 50, 0, 'purchase', 1003, 'Pembelian 1003'),
  (1007, NOW() - INTERVAL '2 days', 9, 1, 250, 0, 'purchase', 1003, 'Pembelian 1003'),
  (1010, NOW() - INTERVAL '1 day', 1, 2, 0, 3, 'sale', 1001, 'Penjualan 1001'),
  (1011, NOW() - INTERVAL '1 day', 2, 2, 0, 2, 'sale', 1001, 'Penjualan 1001'),
  (1012, NOW() - INTERVAL '1 day', 9, 2, 0, 12, 'sale', 1001, 'Penjualan 1001'),
  (1013, NOW() - INTERVAL '8 hours', 3, 2, 0, 2, 'sale', 1002, 'Penjualan 1002'),
  (1014, NOW() - INTERVAL '8 hours', 4, 2, 0, 2, 'sale', 1002, 'Penjualan 1002'),
  (1015, NOW() - INTERVAL '8 hours', 7, 2, 0, 1, 'sale', 1002, 'Penjualan 1002'),
  (1016, NOW() - INTERVAL '3 days', 10, 2, 0, 30, 'sale', 1003, 'Penjualan 1003'),
  (1017, NOW() - INTERVAL '3 days', 8, 2, 0, 3, 'sale', 1003, 'Penjualan 1003'),
  (1018, NOW() - INTERVAL '3 days', 6, 2, 0, 4, 'sale', 1003, 'Penjualan 1003'),
  (1019, NOW() - INTERVAL '4 days', 4, 1, 0, 3, 'purchase_return', 1001, 'Retur pembelian 1001'),
  (1020, NOW() - INTERVAL '18 hours', 2, 2, 1, 0, 'sales_return', 1001, 'Retur penjualan 1001')
ON CONFLICT (id) DO UPDATE
SET created_at = EXCLUDED.created_at,
    product_id = EXCLUDED.product_id,
    location_id = EXCLUDED.location_id,
    qty_in = EXCLUDED.qty_in,
    qty_out = EXCLUDED.qty_out,
    source_type = EXCLUDED.source_type,
    source_id = EXCLUDED.source_id,
    keterangan = EXCLUDED.keterangan;

INSERT INTO menu_permissions (user_id, section, can_access)
VALUES
  (1, 'pos', TRUE),
  (1, 'inventory', TRUE),
  (1, 'customers', TRUE),
  (1, 'reports', FALSE),
  (1, 'settings', FALSE),
  (1, 'users', FALSE),
  (2, 'pos', TRUE),
  (2, 'inventory', TRUE),
  (2, 'customers', TRUE),
  (2, 'suppliers', TRUE),
  (2, 'locations', TRUE),
  (2, 'categories', TRUE),
  (2, 'purchases', TRUE),
  (2, 'purchaseReturns', TRUE),
  (2, 'payables', TRUE),
  (2, 'salesReturns', TRUE),
  (2, 'receivables', TRUE),
  (2, 'cashIn', TRUE),
  (2, 'cashOut', TRUE),
  (2, 'warehouseStock', TRUE),
  (2, 'reports', TRUE),
  (2, 'users', TRUE),
  (2, 'settings', TRUE)
ON CONFLICT (user_id, section) DO UPDATE
SET can_access = EXCLUDED.can_access;

INSERT INTO app_settings (key, value)
VALUES
  ('nama_usaha', 'POS Kasir Gaplek Mart'),
  ('alamat_usaha', 'Jl. Merdeka No. 88, Jakarta'),
  ('receipt_footer', 'Barang yang sudah dibeli dapat diretur sesuai kebijakan toko.'),
  ('low_stock_threshold', '12')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value;

SELECT setval('suppliers_id_seq', GREATEST((SELECT MAX(id) FROM suppliers), 1), true);
SELECT setval('locations_id_seq', GREATEST((SELECT MAX(id) FROM locations), 1), true);
SELECT setval('product_categories_id_seq', GREATEST((SELECT MAX(id) FROM product_categories), 1), true);
SELECT setval('customers_id_seq', GREATEST((SELECT MAX(id) FROM customers), 1), true);
SELECT setval('products_id_seq', GREATEST((SELECT MAX(id) FROM products), 1), true);
SELECT setval('transactions_id_seq', GREATEST((SELECT MAX(id) FROM transactions), 1), true);
SELECT setval('transaction_items_id_seq', GREATEST((SELECT MAX(id) FROM transaction_items), 1), true);
SELECT setval('purchases_id_seq', GREATEST((SELECT MAX(id) FROM purchases), 1), true);
SELECT setval('purchase_items_id_seq', GREATEST((SELECT MAX(id) FROM purchase_items), 1), true);
SELECT setval('purchase_returns_id_seq', GREATEST((SELECT MAX(id) FROM purchase_returns), 1), true);
SELECT setval('purchase_return_items_id_seq', GREATEST((SELECT MAX(id) FROM purchase_return_items), 1), true);
SELECT setval('sales_returns_id_seq', GREATEST((SELECT MAX(id) FROM sales_returns), 1), true);
SELECT setval('sales_return_items_id_seq', GREATEST((SELECT MAX(id) FROM sales_return_items), 1), true);
SELECT setval('payables_id_seq', GREATEST((SELECT MAX(id) FROM payables), 1), true);
SELECT setval('payable_payments_id_seq', GREATEST((SELECT MAX(id) FROM payable_payments), 1), true);
SELECT setval('receivables_id_seq', GREATEST((SELECT MAX(id) FROM receivables), 1), true);
SELECT setval('receivable_payments_id_seq', GREATEST((SELECT MAX(id) FROM receivable_payments), 1), true);
SELECT setval('cash_entries_id_seq', GREATEST((SELECT MAX(id) FROM cash_entries), 1), true);
SELECT setval('stock_movements_id_seq', GREATEST((SELECT MAX(id) FROM stock_movements), 1), true);
SELECT setval('menu_permissions_id_seq', GREATEST((SELECT MAX(id) FROM menu_permissions), 1), true);

COMMIT;
