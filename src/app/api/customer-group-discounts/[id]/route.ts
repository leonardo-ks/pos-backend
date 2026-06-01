import { type NextRequest } from "next/server";

import { requireManager } from "@/lib/auth";
import { parseCustomerGroupDiscountBody } from "@/lib/customer-group-discounts";
import { query } from "@/lib/db";
import { normalizeRow } from "@/lib/feature-crud";
import { ok, problem, serverError } from "@/lib/http";
import { asInteger, ValidationError } from "@/lib/validation";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const auth = await requireManager(request);
    if (auth.error) return problem(auth.error.message, auth.error.status);

    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const parsed = parseCustomerGroupDiscountBody(body);
    const result = await query(
      `UPDATE customer_group_discounts
       SET customer_id = $2,
           category_id = $3,
           rate = $4,
           keterangan = $5,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        asInteger(id, "id", 1),
        parsed.customerId,
        parsed.categoryId,
        parsed.rate,
        parsed.keterangan,
      ],
    );
    if (!result.rows[0])
      return problem("Diskon pelanggan tidak ditemukan.", 404);
    return ok(normalizeRow(result.rows[0]));
  } catch (error) {
    if (error instanceof ValidationError) return problem(error.message, 400);
    return serverError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const auth = await requireManager(request);
    if (auth.error) return problem(auth.error.message, auth.error.status);

    const { id } = await params;
    const result = await query(
      `UPDATE customer_group_discounts
       SET deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1
       RETURNING id`,
      [asInteger(id, "id", 1)],
    );
    if (!result.rows[0])
      return problem("Diskon pelanggan tidak ditemukan.", 404);
    return ok({ id: Number(id) });
  } catch (error) {
    return serverError(error);
  }
}
