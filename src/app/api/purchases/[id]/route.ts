import { type NextRequest } from "next/server";

import { requirePermission } from "@/lib/auth";
import { query } from "@/lib/db";
import {
  deleteBusinessTransaction,
  transactionConfigs,
  updateBusinessTransaction,
} from "@/lib/feature-transactions";
import { normalizeRow } from "@/lib/feature-crud";
import { ok, problem, serverError } from "@/lib/http";
import { asInteger, ValidationError } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, "purchases", "can_view");
    if (auth.error) return problem(auth.error.message, auth.error.status);

    const { id } = await params;
    const purchaseId = asInteger(id, "id", 1);
    const result = await query(
      `SELECT p.id, p.created_at, p.supplier_id, s.nama supplier_name,
              p.total, p.paid_amount, p.remaining_amount, p.keterangan,
              COALESCE(string_agg(pr.nama_produk || ' x' || pi.quantity, ', ' ORDER BY pi.id), '') bought_products,
              COALESCE(
                json_agg(
                  json_build_object(
                    'product_id', pi.product_id,
                    'location_id', pi.location_id,
                    'nama_produk', pr.nama_produk,
                    'quantity', pi.quantity,
                    'unit_price', pi.unit_price,
                    'subtotal', pi.subtotal
                  )
                  ORDER BY pi.id
                ) FILTER (WHERE pi.id IS NOT NULL),
                '[]'::json
              ) items
       FROM purchases p
       LEFT JOIN suppliers s ON s.id = p.supplier_id
       LEFT JOIN purchase_items pi ON pi.purchase_id = p.id
       LEFT JOIN products pr ON pr.id = pi.product_id
       WHERE p.id = $1
       GROUP BY p.id, p.created_at, p.supplier_id, s.nama, p.total,
                p.paid_amount, p.remaining_amount, p.keterangan`,
      [purchaseId],
    );
    if (!result.rows[0]) return problem("Pembelian tidak ditemukan.", 404);
    return ok(normalizeRow(result.rows[0]));
  } catch (error) {
    if (error instanceof ValidationError) return problem(error.message, 400);
    return serverError(error);
  }
}

export const PATCH = updateBusinessTransaction(transactionConfigs.purchases);
export const DELETE = deleteBusinessTransaction(transactionConfigs.purchases);
