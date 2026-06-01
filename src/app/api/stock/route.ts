import { type NextRequest } from "next/server";

import { requireManager, requireUser } from "@/lib/auth";
import { query, withTransaction } from "@/lib/db";
import { normalizeRow } from "@/lib/feature-crud";
import { ok, problem, serverError } from "@/lib/http";
import { dateCursorClause, pageLimit, paginated, textCursorClause } from "@/lib/pagination";
import { asInteger, ValidationError } from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (auth.error) return problem(auth.error.message, auth.error.status);

    const productId = request.nextUrl.searchParams.get("product_id");
    const movements = request.nextUrl.searchParams.get("movements") === "true";
    const limit = pageLimit(request);
    if (movements) {
      const values: unknown[] = [productId ? Number(productId) : null];
      const cursorWhere = dateCursorClause(request, values, "sm");
      const result = await query(
        `SELECT sm.*, p.nama_produk, l.nama location_name
         FROM stock_movements sm
         JOIN products p ON p.id = sm.product_id
         LEFT JOIN locations l ON l.id = sm.location_id
         WHERE ($1::INTEGER IS NULL OR sm.product_id = $1::INTEGER)
           ${cursorWhere ? `AND ${cursorWhere}` : ""}
         ORDER BY sm.created_at DESC, sm.id DESC
         LIMIT ${limit + 1}`,
        values,
      );
      const rows = result.rows.map(normalizeRow);
      return paginated(rows, limit, (row) => ({ created_at: row.created_at, id: row.id }));
    }

    const values: unknown[] = [];
    const cursorWhere = textCursorClause(request, values, "p.nama_produk", "p.id");
    const result = await query(
      `SELECT p.id product_id, p.nama_produk, p.sku, l.id location_id,
              l.nama location_name, pls.stock
       FROM product_location_stocks pls
       JOIN products p ON p.id = pls.product_id
       JOIN locations l ON l.id = pls.location_id
       ${cursorWhere ? `WHERE ${cursorWhere}` : ""}
       ORDER BY LOWER(p.nama_produk), p.id, l.nama
       LIMIT ${limit + 1}`,
      values,
    );
    const rows = result.rows.map(normalizeRow);
    return paginated(rows, limit, (row) => ({
      sort: row.nama_produk?.toString() ?? "",
      id: row.product_id,
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
    const productId = asInteger(body.product_id, "product_id", 1);
    const locationId = asInteger(body.location_id, "location_id", 1);
    const stock = asInteger(body.stock, "stock", 0);

    const saved = await withTransaction(async (client) => {
      const existing = await client.query<{ stock: number }>(
        `SELECT stock
         FROM product_location_stocks
         WHERE product_id = $1
           AND location_id = $2
         FOR UPDATE`,
        [productId, locationId],
      );
      const oldStock = existing.rows[0]?.stock ?? 0;
      const result = await client.query(
        `INSERT INTO product_location_stocks (product_id, location_id, stock)
         VALUES ($1, $2, $3)
         ON CONFLICT (product_id, location_id)
         DO UPDATE SET stock = EXCLUDED.stock, updated_at = NOW()
         RETURNING product_id, location_id, stock`,
        [productId, locationId, stock],
      );
      await client.query(
        `UPDATE products
         SET stok = GREATEST(stok + $2, 0),
             updated_at = NOW()
         WHERE id = $1`,
        [productId, stock - oldStock],
      );
      const hydrated = await client.query(
        `SELECT s.product_id, p.nama_produk, p.sku, s.location_id,
                l.nama location_name, s.stock
         FROM product_location_stocks s
         JOIN products p ON p.id = s.product_id
         JOIN locations l ON l.id = s.location_id
         WHERE s.product_id = $1
           AND s.location_id = $2`,
        [result.rows[0].product_id, result.rows[0].location_id],
      );
      return hydrated.rows[0] as Record<string, unknown>;
    });
    return ok(normalizeRow(saved));
  } catch (error) {
    if (error instanceof ValidationError) return problem(error.message, 400);
    return serverError(error);
  }
}
