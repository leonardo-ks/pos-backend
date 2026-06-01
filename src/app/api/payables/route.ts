import { type NextRequest } from "next/server";

import { requireManager } from "@/lib/auth";
import { query } from "@/lib/db";
import { normalizeRow } from "@/lib/feature-crud";
import { ok, problem, serverError } from "@/lib/http";
import { dateCursorClause, pageLimit, paginated } from "@/lib/pagination";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireManager(request);
    if (auth.error) return problem(auth.error.message, auth.error.status);

    const limit = pageLimit(request);
    const values: unknown[] = [];
    const cursorWhere = dateCursorClause(request, values, "p", "created_at");
    const result = await query(
      `SELECT p.*, s.nama supplier_name
       FROM payables p
       LEFT JOIN suppliers s ON s.id = p.supplier_id
       ${cursorWhere ? `WHERE ${cursorWhere}` : ""}
       ORDER BY p.created_at DESC, p.id DESC
       LIMIT ${limit + 1}`,
      values,
    );
    const rows = result.rows.map(normalizeRow);
    return paginated(rows, limit, (row) => ({
      created_at: row.created_at,
      id: row.id,
    }));
  } catch (error) {
    return serverError(error);
  }
}
