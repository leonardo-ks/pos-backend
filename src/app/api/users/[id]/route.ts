import { type NextRequest } from "next/server";

import { requirePermission } from "@/lib/auth";
import { query } from "@/lib/db";
import { normalizeRow } from "@/lib/feature-crud";
import { ok, problem, serverError } from "@/lib/http";
import {
  asInteger,
  asOptionalString,
  asString,
  ValidationError,
} from "@/lib/validation";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, "users", "can_update");
    if (auth.error) return problem(auth.error.message, auth.error.status);

    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const role = asString(body.role, "role");
    await ensureRoleExists(role);
    const result = await query(
      `UPDATE users
       SET nama = $2,
           email = $3,
           username = $4,
           role = $5,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, nama, email, username, role, created_at, updated_at`,
      [
        asInteger(id, "id", 1),
        asString(body.nama, "nama"),
        asOptionalString(body.email),
        asString(body.username, "username"),
        role,
      ],
    );
    if (!result.rows[0]) return problem("User tidak ditemukan.", 404);
    return ok(normalizeRow(result.rows[0]));
  } catch (error) {
    if (error instanceof ValidationError) return problem(error.message, 400);
    return serverError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, "users", "can_delete");
    if (auth.error) return problem(auth.error.message, auth.error.status);

    const { id } = await params;
    const result = await query(
      `UPDATE users
       SET deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1
       RETURNING id`,
      [asInteger(id, "id", 1)],
    );
    if (!result.rows[0]) return problem("User tidak ditemukan.", 404);
    return ok({ id: Number(id) });
  } catch (error) {
    return serverError(error);
  }
}

async function ensureRoleExists(role: string) {
  const result = await query(
    `SELECT 1 FROM roles WHERE kode = $1 AND deleted_at IS NULL LIMIT 1`,
    [role],
  );
  if (!result.rows[0]) throw new ValidationError("Role tidak valid.");
}
