import { type NextRequest } from "next/server";

import { requireManager, requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { created, ok, problem, serverError } from "@/lib/http";
import { pageLimit, paginated, textCursorClause } from "@/lib/pagination";
import { product, type ProductRow } from "@/lib/serializers";
import {
  asInteger,
  asNumber,
  asOptionalString,
  asString,
  ValidationError,
} from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (auth.error) return problem(auth.error.message, auth.error.status);

    const search = request.nextUrl.searchParams.get("q")?.trim();
    const categoryId = request.nextUrl.searchParams.get("category_id");
    const locationId = request.nextUrl.searchParams.get("location_id");
    const stockFilter = request.nextUrl.searchParams.get("stock_filter");
    const limit = pageLimit(request);
    const values: unknown[] = [];
    const clauses = ["p.deleted_at IS NULL"];
    if (search) {
      values.push(`%${search}%`);
      clauses.push(
        `(p.nama_produk ILIKE $${values.length} OR p.sku ILIKE $${values.length} OR p.barcode ILIKE $${values.length})`,
      );
    }
    if (categoryId) {
      values.push(Number(categoryId));
      clauses.push(`p.category_id = $${values.length}`);
    }
    if (locationId) {
      values.push(Number(locationId));
      clauses.push(`pls.location_id = $${values.length}`);
    }
    const stockExpression = locationId ? "COALESCE(pls.stock, 0)" : "p.stok";
    if (stockFilter === "empty") clauses.push(`${stockExpression} = 0`);
    if (stockFilter === "low") {
      clauses.push(`${stockExpression} > 0 AND ${stockExpression} <= 10`);
    }
    if (stockFilter === "available") clauses.push(`${stockExpression} > 10`);
    const cursorClause = textCursorClause(
      request,
      values,
      "p.nama_produk",
      "p.id",
    );
    if (cursorClause) clauses.push(cursorClause);
    const result = await query<ProductRow>(
      `SELECT p.id, p.nama_produk, p.sku, p.harga,
              ${stockExpression} AS stok,
              p.supplier_id, p.category_id, p.barcode, p.harga_beli,
              p.keterangan,
              s.nama supplier_name, c.nama category_name
       FROM products p
       ${locationId ? "LEFT JOIN product_location_stocks pls ON pls.product_id = p.id" : ""}
       LEFT JOIN suppliers s ON s.id = p.supplier_id
       LEFT JOIN product_categories c ON c.id = p.category_id
       WHERE ${clauses.join(" AND ")}
       ORDER BY LOWER(p.nama_produk), p.id
       LIMIT ${limit + 1}`,
      values,
    );

    return paginated(result.rows.map(product), limit, (row) => ({
      sort: row.nama_produk,
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
    const namaProduk = asString(body.nama_produk, "nama_produk");
    const sku = asString(body.sku, "sku");
    const harga = asNumber(body.harga, "harga");
    const stok = asInteger(body.stok, "stok");
    const hargaBeli = asNumber(body.harga_beli ?? 0, "harga_beli");
    const supplierId =
      body.supplier_id == null
        ? null
        : asInteger(body.supplier_id, "supplier_id", 1);
    const categoryId =
      body.category_id == null
        ? null
        : asInteger(body.category_id, "category_id", 1);
    const barcode = asOptionalString(body.barcode);
    const keterangan = asOptionalString(body.keterangan) ?? "";

    const deletedMatch = await query<ProductRow>(
      `SELECT id FROM products
       WHERE deleted_at IS NOT NULL
         AND LOWER(nama_produk) = LOWER($1)
       LIMIT 1`,
      [namaProduk],
    );
    if (deletedMatch.rows[0]) {
      const result = await query<ProductRow>(
        `UPDATE products
         SET nama_produk = $2,
             sku = $3,
             harga = $4,
             stok = $5,
             harga_beli = $6,
             supplier_id = $7,
             category_id = $8,
             barcode = $9,
             keterangan = $10,
             deleted_at = NULL,
             updated_at = NOW()
         WHERE id = $1
         RETURNING id, nama_produk, sku, harga, stok, supplier_id, category_id, barcode, harga_beli, keterangan`,
        [
          deletedMatch.rows[0].id,
          namaProduk,
          sku,
          harga,
          stok,
          hargaBeli,
          supplierId,
          categoryId,
          barcode,
          keterangan,
        ],
      );
      return created(product(result.rows[0]));
    }

    const result = await query<ProductRow>(
      `INSERT INTO products
         (nama_produk, sku, harga, stok, harga_beli, supplier_id, category_id, barcode, keterangan)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (sku) DO UPDATE
       SET nama_produk = EXCLUDED.nama_produk,
           harga = EXCLUDED.harga,
           stok = EXCLUDED.stok,
           harga_beli = EXCLUDED.harga_beli,
           supplier_id = EXCLUDED.supplier_id,
           category_id = EXCLUDED.category_id,
           barcode = EXCLUDED.barcode,
           keterangan = EXCLUDED.keterangan,
           deleted_at = NULL,
           updated_at = NOW()
       RETURNING id, nama_produk, sku, harga, stok, supplier_id, category_id, barcode, harga_beli, keterangan`,
      [
        namaProduk,
        sku,
        harga,
        stok,
        hargaBeli,
        supplierId,
        categoryId,
        barcode,
        keterangan,
      ],
    );

    return created(product(result.rows[0]));
  } catch (error) {
    if (error instanceof ValidationError) return problem(error.message, 400);
    return serverError(error);
  }
}
