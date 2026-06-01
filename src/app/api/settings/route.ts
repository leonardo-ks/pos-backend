import { type NextRequest } from "next/server";

import { requireManager, requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { ok, problem, serverError } from "@/lib/http";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (auth.error) return problem(auth.error.message, auth.error.status);

    const result = await query(
      "SELECT key, value FROM app_settings ORDER BY key",
    );
    return ok([
      Object.fromEntries(result.rows.map((row) => [row.key, row.value])),
    ]);
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireManager(request);
    if (auth.error) return problem(auth.error.message, auth.error.status);

    const body = (await request.json()) as Record<string, unknown>;
    for (const [key, value] of Object.entries(body)) {
      await query(
        `INSERT INTO app_settings (key, value)
         VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [key, String(value ?? "")],
      );
    }
    const result = await query(
      "SELECT key, value FROM app_settings ORDER BY key",
    );
    return ok(
      Object.fromEntries(result.rows.map((row) => [row.key, row.value])),
    );
  } catch (error) {
    return serverError(error);
  }
}
