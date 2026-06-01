import { type NextRequest } from "next/server";

import { requireManager, requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { created, ok, problem, serverError } from "@/lib/http";
import { pageLimit, paginated, textCursorClause } from "@/lib/pagination";
import { customer, type CustomerRow } from "@/lib/serializers";
import { asString, ValidationError } from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (auth.error) return problem(auth.error.message, auth.error.status);

    const search = request.nextUrl.searchParams.get("q")?.trim();
    const limit = pageLimit(request);
    const values: unknown[] = [];
    const clauses = ["deleted_at IS NULL"];
    if (search) {
      values.push(`%${search}%`);
      clauses.push(`(nama ILIKE $${values.length} OR phone ILIKE $${values.length})`);
    }
    const cursorClause = textCursorClause(request, values, "nama", "id");
    if (cursorClause) clauses.push(cursorClause);
    const result = await query<CustomerRow>(
      `SELECT id, nama, phone, kategori_diskon
       FROM customers
       WHERE ${clauses.join(" AND ")}
       ORDER BY LOWER(nama), id
       LIMIT ${limit + 1}`,
      values,
    );

    return paginated(result.rows.map(customer), limit, (row) => ({
      sort: row.nama,
      id: row.id,
    }));
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireManager(request);
    if (auth.error) return problem(auth.error.message, auth.error.status);

    const body = (await request.json()) as Record<string, unknown>;
    const nama = asString(body.nama, "nama");
    const phone = asString(body.phone, "phone");
    const kategoriDiskon = asString(body.kategori_diskon, "kategori_diskon");
    const deletedMatch = await query<CustomerRow>(
      `SELECT id FROM customers
       WHERE deleted_at IS NOT NULL
         AND LOWER(nama) = LOWER($1)
       LIMIT 1`,
      [nama],
    );
    if (deletedMatch.rows[0]) {
      const result = await query<CustomerRow>(
        `UPDATE customers
         SET nama = $2,
             phone = $3,
             kategori_diskon = $4,
             deleted_at = NULL,
             updated_at = NOW()
         WHERE id = $1
         RETURNING id, nama, phone, kategori_diskon`,
        [deletedMatch.rows[0].id, nama, phone, kategoriDiskon],
      );
      return created(customer(result.rows[0]));
    }
    const result = await query<CustomerRow>(
      `INSERT INTO customers (nama, phone, kategori_diskon)
       VALUES ($1, $2, $3)
       ON CONFLICT (phone) DO UPDATE
       SET nama = EXCLUDED.nama,
           kategori_diskon = EXCLUDED.kategori_diskon,
           deleted_at = NULL,
           updated_at = NOW()
       RETURNING id, nama, phone, kategori_diskon`,
      [nama, phone, kategoriDiskon],
    );

    return created(customer(result.rows[0]));
  } catch (error) {
    if (error instanceof ValidationError) return problem(error.message, 400);
    return serverError(error);
  }
}
