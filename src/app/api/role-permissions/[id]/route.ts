import { type NextRequest } from "next/server";

import { requirePermission } from "@/lib/auth";
import { query } from "@/lib/db";
import { normalizeRow } from "@/lib/feature-crud";
import { ok, problem, serverError } from "@/lib/http";
import { parsePermissionBody } from "@/lib/role-permissions";
import { asInteger, ValidationError } from "@/lib/validation";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(
      request,
      "authorization",
      "can_update",
    );
    if (auth.error) return problem(auth.error.message, auth.error.status);

    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const parsed = parsePermissionBody(body);
    const result = await query(
      `UPDATE role_permissions
       SET role = $2,
           section = $3,
           can_view = $4,
           can_create = $5,
           can_update = $6,
           can_delete = $7,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        asInteger(id, "id", 1),
        parsed.role,
        parsed.section,
        parsed.can_view,
        parsed.can_create,
        parsed.can_update,
        parsed.can_delete,
      ],
    );

    if (!result.rows[0]) return problem("Hak akses role tidak ditemukan.", 404);
    return ok(normalizeRow(result.rows[0]));
  } catch (error) {
    if (error instanceof ValidationError) return problem(error.message, 400);
    return serverError(error);
  }
}
