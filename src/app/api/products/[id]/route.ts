import { type NextRequest } from "next/server";

import { requireManager } from "@/lib/auth";
import { isForeignKeyViolation } from "@/lib/feature-crud";
import { query } from "@/lib/db";
import { ok, problem, serverError } from "@/lib/http";
import { product, type ProductRow } from "@/lib/serializers";
import {
  asInteger,
  asNumber,
  asOptionalString,
  asString,
  ValidationError,
} from "@/lib/validation";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const auth = await requireManager(request);
    if (auth.error) return problem(auth.error.message, auth.error.status);

    const { id } = await params;
    const productId = asInteger(id, "id", 1);
    const body = (await request.json()) as Record<string, unknown>;

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
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, nama_produk, sku, harga, stok, supplier_id, category_id, barcode, harga_beli, keterangan`,
      [
        productId,
        asString(body.nama_produk, "nama_produk"),
        asString(body.sku, "sku"),
        asNumber(body.harga, "harga"),
        asInteger(body.stok, "stok"),
        asNumber(body.harga_beli ?? 0, "harga_beli"),
        body.supplier_id == null
          ? null
          : asInteger(body.supplier_id, "supplier_id", 1),
        body.category_id == null
          ? null
          : asInteger(body.category_id, "category_id", 1),
        asOptionalString(body.barcode),
        asOptionalString(body.keterangan) ?? "",
      ],
    );

    if (!result.rows[0]) return problem("Produk tidak ditemukan.", 404);
    return ok(product(result.rows[0]));
  } catch (error) {
    if (error instanceof ValidationError) return problem(error.message, 400);
    return serverError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const auth = await requireManager(request);
    if (auth.error) return problem(auth.error.message, auth.error.status);

    const { id } = await params;
    const productId = asInteger(id, "id", 1);
    const result = await query(
      `UPDATE products
       SET deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1
       RETURNING id`,
      [productId],
    );
    if (!result.rows[0]) return problem("Produk tidak ditemukan.", 404);
    return ok({ id: productId });
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      return problem("Produk masih digunakan dan tidak dapat dihapus.", 409);
    }
    return serverError(error);
  }
}
