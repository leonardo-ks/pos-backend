export type ProductRow = {
  id: number;
  nama_produk: string;
  sku: string;
  harga: string;
  stok: number;
  supplier_id?: number | null;
  category_id?: number | null;
  barcode?: string | null;
  harga_beli?: string | null;
  supplier_name?: string | null;
  category_name?: string | null;
  keterangan?: string | null;
};

export type CustomerRow = {
  id: number;
  nama: string;
  phone: string;
  kategori_diskon: string;
};

export type TransactionRow = {
  id: number;
  created_at: Date;
  customer_id: number | null;
  user_id: number;
  subtotal: string;
  discount_amount: string;
  total_akhir: string;
  paid_amount?: string | null;
  cash_received?: string | null;
  change_amount?: string | null;
  payment_method?: string | null;
  items?: unknown;
};

export function product(row: ProductRow) {
  return {
    id: row.id,
    nama_produk: row.nama_produk,
    sku: row.sku,
    harga: Number(row.harga),
    stok: row.stok,
    supplier_id: row.supplier_id ?? null,
    category_id: row.category_id ?? null,
    barcode: row.barcode ?? null,
    harga_beli: Number(row.harga_beli ?? 0),
    supplier_name: row.supplier_name ?? null,
    category_name: row.category_name ?? null,
    keterangan: row.keterangan ?? "",
  };
}

export function customer(row: CustomerRow) {
  return {
    id: row.id,
    nama: row.nama,
    phone: row.phone,
    kategori_diskon: row.kategori_diskon,
  };
}

export function transaction(row: TransactionRow) {
  return {
    id: row.id,
    created_at: row.created_at.toISOString(),
    customer_id: row.customer_id,
    user_id: row.user_id,
    subtotal: Number(row.subtotal),
    discount_amount: Number(row.discount_amount),
    total_akhir: Number(row.total_akhir),
    paid_amount: Number(row.paid_amount ?? row.total_akhir),
    cash_received: Number(
      row.cash_received ?? row.paid_amount ?? row.total_akhir,
    ),
    change_amount: Number(row.change_amount ?? 0),
    payment_method: row.payment_method ?? "cash",
  };
}
