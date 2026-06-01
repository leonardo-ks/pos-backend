import { type NextRequest } from "next/server";

import { requireManager } from "@/lib/auth";
import { query } from "@/lib/db";
import { ok, problem, serverError } from "@/lib/http";
import { buildDateFilter } from "@/lib/report-filter";

type SummaryRow = {
  revenue: string;
  transaction_count: string;
  item_count: string;
};

type TopProductRow = {
  product_id: number;
  nama_produk: string;
  quantity_sold: string;
  revenue: string;
};

type RecentTransactionRow = {
  id: number;
  created_at: Date;
  customer_name: string | null;
  cashier_name: string;
  total_akhir: string;
};

export async function GET(request: NextRequest) {
  try {
    const auth = await requireManager(request);
    if (auth.error) return problem(auth.error.message, auth.error.status);

    const filter = buildDateFilter(request);
    const productId = request.nextUrl.searchParams.get("product_id");
    const categoryId = request.nextUrl.searchParams.get("category_id");
    const customerId = request.nextUrl.searchParams.get("customer_id");
    const values = [...filter.values];
    const itemClauses: string[] = [];
    const transactionClauses: string[] = [];
    if (productId) {
      values.push(productId);
      itemClauses.push(`ti.product_id = $${values.length}`);
    }
    if (categoryId) {
      values.push(categoryId);
      itemClauses.push(`p.category_id = $${values.length}`);
    }
    if (customerId) {
      values.push(customerId);
      transactionClauses.push(`t.customer_id = $${values.length}`);
    }
    const itemWhereSql = combineWhere(filter.whereSql, [
      ...itemClauses,
      ...transactionClauses,
    ]);
    const transactionWhereSql = combineWhere(filter.whereSql, [
      ...transactionClauses,
      ...(itemClauses.length > 0
        ? [
            `EXISTS (
              SELECT 1
              FROM transaction_items ti
              JOIN products p ON p.id = ti.product_id
              WHERE ti.transaction_id = t.id
                AND ${itemClauses.join(" AND ")}
            )`,
          ]
        : []),
    ]);
    const summaryResult = await query<SummaryRow>(
      `SELECT
         COALESCE(SUM(t.total_akhir), 0) AS revenue,
         COUNT(DISTINCT t.id) AS transaction_count,
         COALESCE(SUM(ti.jumlah_beli), 0) AS item_count
       FROM transactions t
       LEFT JOIN transaction_items ti ON ti.transaction_id = t.id
       LEFT JOIN products p ON p.id = ti.product_id
       ${itemWhereSql}`,
      values,
    );

    const topProductsResult = await query<TopProductRow>(
      `SELECT
         p.id AS product_id,
         p.nama_produk,
         SUM(ti.jumlah_beli) AS quantity_sold,
         SUM(ti.subtotal) AS revenue
       FROM transaction_items ti
       JOIN transactions t ON t.id = ti.transaction_id
       JOIN products p ON p.id = ti.product_id
       ${itemWhereSql}
       GROUP BY p.id, p.nama_produk
       ORDER BY quantity_sold DESC, revenue DESC
       LIMIT 5`,
      values,
    );

    const recentTransactionsResult = await query<RecentTransactionRow>(
      `SELECT
         t.id,
         t.created_at,
         c.nama AS customer_name,
         u.nama AS cashier_name,
         t.total_akhir
       FROM transactions t
       LEFT JOIN customers c ON c.id = t.customer_id
       JOIN users u ON u.id = t.user_id
       ${transactionWhereSql}
       ORDER BY t.created_at DESC
       LIMIT 20`,
      values,
    );

    const summary = summaryResult.rows[0];

    return ok({
      summary: {
        revenue: Number(summary.revenue),
        transaction_count: Number(summary.transaction_count),
        item_count: Number(summary.item_count),
      },
      top_products: topProductsResult.rows.map((row) => ({
        product_id: row.product_id,
        nama_produk: row.nama_produk,
        quantity_sold: Number(row.quantity_sold),
        revenue: Number(row.revenue),
      })),
      recent_transactions: recentTransactionsResult.rows.map((row) => ({
        id: row.id,
        created_at: row.created_at.toISOString(),
        customer_name: row.customer_name,
        cashier_name: row.cashier_name,
        total_akhir: Number(row.total_akhir),
      })),
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
