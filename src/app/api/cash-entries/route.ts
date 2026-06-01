import { type NextRequest } from "next/server";

import { requireManager } from "@/lib/auth";
import { query } from "@/lib/db";
import { normalizeRow } from "@/lib/feature-crud";
import { created, ok, problem, serverError } from "@/lib/http";
import { dateCursorClause, pageLimit, paginated } from "@/lib/pagination";
import {
  asNumber,
  asOptionalString,
  asString,
  ValidationError,
} from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireManager(request);
    if (auth.error) return problem(auth.error.message, auth.error.status);

    const limit = pageLimit(request);
    const values: unknown[] = [];
    const cursorWhere = dateCursorClause(request, values, "cash_entries");
    const result = await query(
      `SELECT * FROM cash_entries
       ${cursorWhere ? `WHERE ${cursorWhere}` : ""}
       ORDER BY created_at DESC, id DESC
       LIMIT ${limit + 1}`,
      values,
    );
    const rows = result.rows.map(normalizeRow);
    return paginated(rows, limit, (row) => ({ created_at: row.created_at, id: row.id }));
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireManager(request);
    if (auth.error || !auth.user) {
      return problem(
        auth.error?.message ?? "Login diperlukan.",
        auth.error?.status ?? 401,
      );
    }
    const body = (await request.json()) as Record<string, unknown>;
    const type = asString(body.type, "type");
    if (type !== "in" && type !== "out") {
      throw new ValidationError("type harus in atau out.");
    }
    const result = await query(
      `INSERT INTO cash_entries (type, amount, category, description, user_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        type,
        asNumber(body.amount, "amount", 1),
        asString(body.category, "category"),
        asOptionalString(body.description) ?? "",
        auth.user.id,
      ],
    );
    return created(normalizeRow(result.rows[0]));
  } catch (error) {
    if (error instanceof ValidationError) return problem(error.message, 400);
    return serverError(error);
  }
}
