import { type NextRequest } from "next/server";

import { requirePermission, requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { normalizeRow } from "@/lib/feature-crud";
import { created, ok, problem, serverError } from "@/lib/http";
import { pageLimit, paginated, readCursor } from "@/lib/pagination";
import { parsePermissionBody } from "@/lib/role-permissions";
import { ValidationError } from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (auth.error) return problem(auth.error.message, auth.error.status);

    const role = request.nextUrl.searchParams.get("role");
    const limit = pageLimit(request);
    const cursorData = readCursor(request);
    const cursor = Number(cursorData?.offset ?? 0);
    const result = await query(
      `SELECT *
       FROM role_permissions
       WHERE ($1::TEXT IS NULL OR role = $1::TEXT)
       ORDER BY
         CASE role
           WHEN 'kasir' THEN 1
           WHEN 'manajer' THEN 2
           WHEN 'administrator' THEN 3
           ELSE 4
         END,
         CASE section
           WHEN 'pos' THEN 1
           WHEN 'purchases' THEN 2
           WHEN 'purchase-returns' THEN 3
           WHEN 'sales-returns' THEN 4
           WHEN 'reports' THEN 5
           WHEN 'inventory' THEN 6
           WHEN 'customers' THEN 7
           WHEN 'suppliers' THEN 8
           WHEN 'users' THEN 9
           WHEN 'roles' THEN 10
           WHEN 'authorization' THEN 11
           ELSE 11
         END,
         section
       OFFSET $2
       LIMIT ${limit + 1}`,
      [role || null, cursor],
    );
    const rows = result.rows.map(normalizeRow);
    return paginated(rows, limit, (_row) => ({ offset: cursor + limit }));
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, "authorization", "can_create");
    if (auth.error) return problem(auth.error.message, auth.error.status);

    const body = (await request.json()) as Record<string, unknown>;
    const parsed = parsePermissionBody(body);
    const result = await query(
      `INSERT INTO role_permissions
         (role, section, can_view, can_create, can_update, can_delete)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (role, section) DO UPDATE
       SET can_view = EXCLUDED.can_view,
           can_create = EXCLUDED.can_create,
           can_update = EXCLUDED.can_update,
           can_delete = EXCLUDED.can_delete,
           updated_at = NOW()
       RETURNING *`,
      [
        parsed.role,
        parsed.section,
        parsed.can_view,
        parsed.can_create,
        parsed.can_update,
        parsed.can_delete,
      ],
    );
    return created(normalizeRow(result.rows[0]));
  } catch (error) {
    if (error instanceof ValidationError) return problem(error.message, 400);
    return serverError(error);
  }
}
