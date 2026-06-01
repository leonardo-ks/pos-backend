import { type NextRequest } from "next/server";

import { requireManager } from "@/lib/auth";
import { query } from "@/lib/db";
import { isForeignKeyViolation } from "@/lib/feature-crud";
import { ok, problem, serverError } from "@/lib/http";
import { customer, type CustomerRow } from "@/lib/serializers";
import { asInteger, asString, ValidationError } from "@/lib/validation";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const auth = await requireManager(request);
    if (auth.error) return problem(auth.error.message, auth.error.status);

    const { id } = await params;
    const customerId = asInteger(id, "id", 1);
    const body = (await request.json()) as Record<string, unknown>;

    const result = await query<CustomerRow>(
      `UPDATE customers
       SET nama = $2,
           phone = $3,
           kategori_diskon = $4,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, nama, phone, kategori_diskon`,
      [
        customerId,
        asString(body.nama, "nama"),
        asString(body.phone, "phone"),
        asString(body.kategori_diskon, "kategori_diskon"),
      ],
    );

    if (!result.rows[0]) return problem("Pelanggan tidak ditemukan.", 404);
    return ok(customer(result.rows[0]));
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
    const customerId = asInteger(id, "id", 1);
    const result = await query(
      `UPDATE customers
       SET deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1
       RETURNING id`,
      [customerId],
    );
    if (!result.rows[0]) return problem("Pelanggan tidak ditemukan.", 404);
    return ok({ id: customerId });
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      return problem("Pelanggan masih digunakan dan tidak dapat dihapus.", 409);
    }
    return serverError(error);
  }
}
