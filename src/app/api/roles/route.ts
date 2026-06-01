import { type NextRequest } from "next/server";

import { requirePermission } from "@/lib/auth";
import { query } from "@/lib/db";
import { normalizeRow } from "@/lib/feature-crud";
import { created, ok, problem, serverError } from "@/lib/http";
import { pageLimit, paginated, textCursorClause } from "@/lib/pagination";
import { asOptionalString, asString, ValidationError } from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAnyPermission(request, [
      ["roles", "can_view"],
      ["users", "can_view"],
      ["authorization", "can_view"],
    ]);
    if (auth.error) return problem(auth.error.message, auth.error.status);

    const search = request.nextUrl.searchParams.get("q")?.trim();
    const limit = pageLimit(request);
    const values: unknown[] = [];
    const clauses = ["deleted_at IS NULL"];
    if (search) {
      values.push(`%${search}%`);
      clauses.push(`(kode ILIKE $${values.length} OR nama ILIKE $${values.length})`);
    }
    const cursorWhere = textCursorClause(request, values, "nama", "id");
    if (cursorWhere) clauses.push(cursorWhere);
    const result = await query(
      `SELECT id, kode, nama, keterangan, system_role, created_at, updated_at
       FROM roles
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

async function requireAnyPermission(
  request: NextRequest,
  permissions: Array<["roles" | "users" | "authorization", "can_view"]>,
) {
  let lastAuth: Awaited<ReturnType<typeof requirePermission>> | null = null;
  for (const [section, action] of permissions) {
    const auth = await requirePermission(request, section, action);
    if (!auth.error) return auth;
    lastAuth = auth;
  }
  return lastAuth!;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, "roles", "can_create");
    if (auth.error) return problem(auth.error.message, auth.error.status);

    const body = (await request.json()) as Record<string, unknown>;
    const kode = asString(body.kode, "kode").toLowerCase();
    const result = await query(
      `INSERT INTO roles (kode, nama, keterangan)
       VALUES ($1, $2, $3)
       ON CONFLICT (kode) DO UPDATE
       SET nama = EXCLUDED.nama,
           keterangan = EXCLUDED.keterangan,
           deleted_at = NULL,
           updated_at = NOW()
       RETURNING id, kode, nama, keterangan, system_role, created_at, updated_at`,
      [
        kode,
        asString(body.nama, "nama"),
        asOptionalString(body.keterangan),
      ],
    );
    return created(normalizeRow(result.rows[0]));
  } catch (error) {
    if (error instanceof ValidationError) return problem(error.message, 400);
    return serverError(error);
  }
}
