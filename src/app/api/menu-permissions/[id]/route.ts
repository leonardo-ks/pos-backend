import { type NextRequest } from "next/server";

import { requireAdministrator } from "@/lib/auth";
import { query } from "@/lib/db";
import { normalizeRow } from "@/lib/feature-crud";
import { ok, problem, serverError } from "@/lib/http";
import { asInteger, asString } from "@/lib/validation";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const auth = await requireAdministrator(request);
    if (auth.error) return problem(auth.error.message, auth.error.status);

    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const result = await query(
      `UPDATE menu_permissions
       SET user_id = $2,
           section = $3,
           can_access = $4
       WHERE id = $1
       RETURNING *`,
      [
        asInteger(id, "id", 1),
        asInteger(body.user_id, "user_id", 1),
        asString(body.section, "section"),
        body.can_access !== false,
      ],
    );

    if (!result.rows[0]) return problem("Hak akses tidak ditemukan.", 404);
    return ok(normalizeRow(result.rows[0]));
  } catch (error) {
    return serverError(error);
  }
}
