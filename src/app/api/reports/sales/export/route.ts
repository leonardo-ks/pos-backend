import ExcelJS from "exceljs";
import { type NextRequest, NextResponse } from "next/server";

import { requireManager } from "@/lib/auth";
import { query } from "@/lib/db";
import { problem, serverError } from "@/lib/http";
import { buildDateFilter } from "@/lib/report-filter";

type ExportRow = {
  id: number;
  created_at: Date;
  customer_name: string | null;
  cashier_name: string;
  product_name: string;
  jumlah_beli: number;
  harga_satuan: string;
  subtotal_item: string;
  discount_amount: string;
  total_akhir: string;
};

export async function GET(request: NextRequest) {
  try {
    const auth = await requireManager(request);
    if (auth.error) return problem(auth.error.message, auth.error.status);

    const filter = buildDateFilter(request);
    const values = [...filter.values];
    const clauses: string[] = [];
    const productId = request.nextUrl.searchParams.get("product_id");
    const categoryId = request.nextUrl.searchParams.get("category_id");
    if (productId) {
      values.push(productId);
      clauses.push(`ti.product_id = $${values.length}`);
    }
    if (categoryId) {
      values.push(categoryId);
      clauses.push(`p.category_id = $${values.length}`);
    }
    const whereSql = combineWhere(filter.whereSql, clauses);
    const result = await query<ExportRow>(
      `SELECT
         t.id,
         t.created_at,
         c.nama AS customer_name,
         u.nama AS cashier_name,
         p.nama_produk AS product_name,
         ti.jumlah_beli,
         ti.harga_satuan,
         ti.subtotal AS subtotal_item,
         t.discount_amount,
         t.total_akhir
       FROM transactions t
       JOIN transaction_items ti ON ti.transaction_id = t.id
       JOIN products p ON p.id = ti.product_id
       JOIN users u ON u.id = t.user_id
       LEFT JOIN customers c ON c.id = t.customer_id
       ${whereSql}
       ORDER BY t.created_at DESC, t.id DESC`,
      values,
    );

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "POS Kasir";
    const sheet = workbook.addWorksheet("Laporan Penjualan");
    sheet.columns = [
      { header: "Invoice", key: "invoice", width: 12 },
      { header: "Dibuat", key: "created_at", width: 22 },
      { header: "Pelanggan", key: "pelanggan", width: 24 },
      { header: "Kasir", key: "kasir", width: 20 },
      { header: "Produk", key: "produk", width: 28 },
      { header: "Jumlah", key: "jumlah", width: 10 },
      { header: "Harga Satuan", key: "harga", width: 16 },
      { header: "Subtotal Item", key: "subtotal", width: 16 },
      { header: "Diskon Transaksi", key: "diskon", width: 18 },
      { header: "Total Akhir", key: "total", width: 16 },
    ];

    for (const row of result.rows) {
      sheet.addRow({
        invoice: row.id,
        created_at: row.created_at.toISOString(),
        pelanggan: row.customer_name ?? "Umum",
        kasir: row.cashier_name,
        produk: row.product_name,
        jumlah: row.jumlah_beli,
        harga: Number(row.harga_satuan),
        subtotal: Number(row.subtotal_item),
        diskon: Number(row.discount_amount),
        total: Number(row.total_akhir),
      });
    }

    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: "frozen", ySplit: 1 }];

    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(buffer, {
      headers: {
        "content-type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": 'attachment; filename="laporan-penjualan.xlsx"',
      },
    });
  } catch (error) {
    return serverError(error);
  }
}

function combineWhere(baseWhere: string, extraClauses: string[]) {
  if (extraClauses.length === 0) return baseWhere;
  const extra = extraClauses.join(" AND ");
  return baseWhere ? `${baseWhere} AND ${extra}` : `WHERE ${extra}`;
}
