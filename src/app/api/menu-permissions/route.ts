import { type NextRequest } from "next/server";

import { requireAdministrator } from "@/lib/auth";
import { query } from "@/lib/db";
import { normalizeRow } from "@/lib/feature-crud";
import { created, ok, problem, serverError } from "@/lib/http";
import { asInteger, asString } from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdministrator(request);
    if (auth.error) return problem(auth.error.message, auth.error.status);

    const userId = request.nextUrl.searchParams.get("user_id");
    const result = await query(
      `SELECT * FROM menu_permissions
       WHERE ($1::INTEGER IS NULL OR user_id = $1::INTEGER)
       ORDER BY user_id, section`,
      [userId ? Number(userId) : null],
    );
    return ok(result.rows.map(normalizeRow));
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdministrator(request);
    if (auth.error) return problem(auth.error.message, auth.error.status);

    const body = (await request.json()) as Record<string, unknown>;
    const result = await query(
      `INSERT INTO menu_permissions (user_id, section, can_access)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, section) DO UPDATE
       SET can_access = EXCLUDED.can_access
       RETURNING *`,
      [
        asInteger(body.user_id, "user_id", 1),
        asString(body.section, "section"),
        body.can_access !== false,
      ],
    );
    return created(normalizeRow(result.rows[0]));
  } catch (error) {
    return serverError(error);
  }
}
