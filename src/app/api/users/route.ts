import { type NextRequest } from "next/server";

import { requirePermission } from "@/lib/auth";
import { query } from "@/lib/db";
import { normalizeRow } from "@/lib/feature-crud";
import { created, ok, problem, serverError } from "@/lib/http";
import { pageLimit, paginated, textCursorClause } from "@/lib/pagination";
import { asOptionalString, asString, ValidationError } from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, "users", "can_view");
    if (auth.error) return problem(auth.error.message, auth.error.status);

    const search = request.nextUrl.searchParams.get("q")?.trim();
    const limit = pageLimit(request);
    const values: unknown[] = [];
    const clauses = ["deleted_at IS NULL"];
    if (search) {
      values.push(`%${search}%`);
      clauses.push(`(nama ILIKE $${values.length} OR username ILIKE $${values.length} OR role ILIKE $${values.length})`);
    }
    const cursorWhere = textCursorClause(request, values, "nama", "id");
    if (cursorWhere) clauses.push(cursorWhere);
    const result = await query(
      `SELECT id, nama, email, username, role, created_at, updated_at
       FROM users
       WHERE ${clauses.join(" AND ")}
       ORDER BY LOWER(nama), id
       LIMIT ${limit + 1}`,
      values,
    );
    const rows = result.rows.map(normalizeRow);
    return paginated(rows, limit, (row) => ({
      sort: row.nama?.toString() ?? "",
      id: row.id,
    }));
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, "users", "can_create");
    if (auth.error) return problem(auth.error.message, auth.error.status);

    const body = (await request.json()) as Record<string, unknown>;
    const role = asString(body.role, "role");
    await ensureRoleExists(role);
    const username = asString(body.username, "username");
    const email = asOptionalString(body.email) ?? `${username}@pos.local`;
    const result = await query(
      `INSERT INTO users (nama, email, username, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (username) DO UPDATE
       SET nama = EXCLUDED.nama,
           email = EXCLUDED.email,
           role = EXCLUDED.role,
           deleted_at = NULL,
           updated_at = NOW()
       RETURNING id, nama, email, username, role, created_at, updated_at`,
      [asString(body.nama, "nama"), email, username, role],
    );
    return created(normalizeRow(result.rows[0]));
  } catch (error) {
    if (error instanceof ValidationError) return problem(error.message, 400);
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
