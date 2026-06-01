import { type NextRequest } from "next/server";

import { requireManager, requireUser } from "@/lib/auth";
import { parseCustomerGroupDiscountBody } from "@/lib/customer-group-discounts";
import { query, withTransaction } from "@/lib/db";
import { normalizeRow } from "@/lib/feature-crud";
import { created, ok, problem, serverError } from "@/lib/http";
import { pageLimit, paginated, textCursorClause } from "@/lib/pagination";
import { ValidationError } from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (auth.error) return problem(auth.error.message, auth.error.status);

    const search = request.nextUrl.searchParams.get("q")?.trim();
    const limit = pageLimit(request);
    const values: unknown[] = [];
    if (search) values.push(`%${search}%`);
    const cursorWhere = textCursorClause(request, values, "c.nama", "cgd.id");
    const result = await query(
      `SELECT cgd.id, cgd.customer_id, cgd.category_id, cgd.rate,
              cgd.keterangan, c.nama customer_name, pc.nama category_name
       FROM customer_group_discounts cgd
       JOIN customers c ON c.id = cgd.customer_id
       JOIN product_categories pc ON pc.id = cgd.category_id
       WHERE cgd.deleted_at IS NULL
         AND c.deleted_at IS NULL
         AND pc.deleted_at IS NULL
         ${
           search
             ? "AND (c.nama ILIKE $1 OR pc.nama ILIKE $1 OR cgd.keterangan ILIKE $1)"
             : ""
         }
         ${cursorWhere ? `AND ${cursorWhere}` : ""}
       ORDER BY LOWER(c.nama), cgd.id
       LIMIT ${limit + 1}`,
      values,
    );
    const rows = result.rows.map(normalizeRow);
    return paginated(rows, limit, (row) => ({
      sort: row.customer_name?.toString() ?? "",
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
    const items = body.items;
    if (Array.isArray(items)) {
      const rows = await withTransaction(async (client) => {
        const saved: Record<string, unknown>[] = [];
        if (Array.isArray(body.delete_ids)) {
          for (const deleteId of body.delete_ids) {
            await client.query(
              `UPDATE customer_group_discounts
               SET deleted_at = NOW(), updated_at = NOW()
               WHERE id = $1`,
              [Number(deleteId)],
            );
          }
        }
        for (const item of items) {
          if (typeof item !== "object" || item == null) {
            throw new ValidationError("Format item diskon tidak valid.");
          }
          const parsed = parseCustomerGroupDiscountBody(
            item as Record<string, unknown>,
          );
          const result = await client.query(
            `INSERT INTO customer_group_discounts
               (customer_id, category_id, rate, keterangan)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (customer_id, category_id) DO UPDATE
             SET rate = EXCLUDED.rate,
                 keterangan = EXCLUDED.keterangan,
                 deleted_at = NULL,
                 updated_at = NOW()
             RETURNING *`,
            [
              parsed.customerId,
              parsed.categoryId,
              parsed.rate,
              parsed.keterangan,
            ],
          );
          saved.push(result.rows[0] as Record<string, unknown>);
        }
        return saved;
      });
      return created(rows.map(normalizeRow));
    }
    const parsed = parseCustomerGroupDiscountBody(body);
    const result = await query(
      `INSERT INTO customer_group_discounts
         (customer_id, category_id, rate, keterangan)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (customer_id, category_id) DO UPDATE
       SET rate = EXCLUDED.rate,
           keterangan = EXCLUDED.keterangan,
           deleted_at = NULL,
           updated_at = NOW()
       RETURNING *`,
      [parsed.customerId, parsed.categoryId, parsed.rate, parsed.keterangan],
    );
    return created(normalizeRow(result.rows[0]));
  } catch (error) {
    if (error instanceof ValidationError) return problem(error.message, 400);
    return serverError(error);
  }
}
