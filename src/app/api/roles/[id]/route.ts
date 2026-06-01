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
    const auth = await requirePermission(request, "roles", "can_update");
    if (auth.error) return problem(auth.error.message, auth.error.status);

    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const result = await query(
      `UPDATE roles
       SET kode = CASE WHEN system_role THEN kode ELSE $2 END,
           nama = $3,
           keterangan = $4,
           updated_at = NOW()
       WHERE id = $1
         AND deleted_at IS NULL
       RETURNING id, kode, nama, keterangan, system_role, created_at, updated_at`,
      [
        asInteger(id, "id", 1),
        asString(body.kode, "kode").toLowerCase(),
        asString(body.nama, "nama"),
        asOptionalString(body.keterangan),
      ],
    );
    if (!result.rows[0]) return problem("Role tidak ditemukan.", 404);
    return ok(normalizeRow(result.rows[0]));
  } catch (error) {
    if (error instanceof ValidationError) return problem(error.message, 400);
    return serverError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, "roles", "can_delete");
    if (auth.error) return problem(auth.error.message, auth.error.status);

    const { id } = await params;
    const role = await query(
      `SELECT kode, system_role FROM roles WHERE id = $1 AND deleted_at IS NULL`,
      [asInteger(id, "id", 1)],
    );
    const row = role.rows[0];
    if (!row) return problem("Role tidak ditemukan.", 404);
    if (row.system_role) return problem("Role sistem tidak bisa dihapus.", 400);

    const used = await query(
      `SELECT 1 FROM users WHERE role = $1 AND deleted_at IS NULL LIMIT 1`,
      [row.kode],
    );
    if (used.rows[0]) {
      return problem("Role masih digunakan oleh pengguna aktif.", 400);
    }

    const result = await query(
      `UPDATE roles
       SET deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1
       RETURNING id`,
      [asInteger(id, "id", 1)],
    );
    await query(`DELETE FROM role_permissions WHERE role = $1`, [row.kode]);
    return ok({ id: result.rows[0].id });
  } catch (error) {
    if (error instanceof ValidationError) return problem(error.message, 400);
    return serverError(error);
  }
}
