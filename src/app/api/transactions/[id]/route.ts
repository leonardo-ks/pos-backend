import { type NextRequest } from "next/server";

import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { ok, problem, serverError } from "@/lib/http";
import { transaction, type TransactionRow } from "@/lib/serializers";
import { asInteger, ValidationError } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await requireUser(request);
    if (auth.error) return problem(auth.error.message, auth.error.status);

    const { id } = await params;
    const transactionId = asInteger(id, "id", 1);
    const result = await query<TransactionRow & { customer_name?: string }>(
      `SELECT t.id, t.created_at, t.customer_id, c.nama customer_name,
              t.user_id, t.subtotal, t.discount_amount, t.total_akhir,
              t.paid_amount, t.cash_received, t.change_amount, t.payment_method,
              COALESCE(
                json_agg(
                  json_build_object(
                    'product_id', ti.product_id,
                    'nama_produk', p.nama_produk,
                    'jumlah_beli', ti.jumlah_beli,
                    'harga_satuan', ti.harga_satuan,
                    'subtotal', ti.subtotal
                  )
                  ORDER BY ti.id
                ) FILTER (WHERE ti.id IS NOT NULL),
                '[]'::json
              ) AS items
       FROM transactions t
       LEFT JOIN customers c ON c.id = t.customer_id
       LEFT JOIN transaction_items ti ON ti.transaction_id = t.id
       LEFT JOIN products p ON p.id = ti.product_id
       WHERE t.id = $1
       GROUP BY t.id, t.created_at, t.customer_id, c.nama, t.user_id, t.subtotal,
                t.discount_amount, t.total_akhir, t.paid_amount,
                t.cash_received, t.change_amount, t.payment_method`,
      [transactionId],
    );
    const row = result.rows[0];
    if (!row) return problem("Transaksi tidak ditemukan.", 404);
    return ok({
      ...transaction(row),
      customer_name: row.customer_name ?? null,
      items: row.items ?? [],
    });
  } catch (error) {
    if (error instanceof ValidationError) return problem(error.message, 400);
    return serverError(error);
  }
}

