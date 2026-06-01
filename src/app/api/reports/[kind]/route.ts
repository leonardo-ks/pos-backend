import { type NextRequest } from "next/server";

import { requireManager } from "@/lib/auth";
import { query } from "@/lib/db";
import { normalizeRow } from "@/lib/feature-crud";
import { ok, problem, serverError } from "@/lib/http";
import { dateCursorClause, pageLimit, paginated } from "@/lib/pagination";
import { buildDateFilter } from "@/lib/report-filter";

type Params = {
  params: Promise<{ kind: string }>;
};

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await requireManager(request);
    if (auth.error) return problem(auth.error.message, auth.error.status);

    const { kind } = await params;
    const filter = buildDateFilter(request);
    const where = filter.whereSql.replaceAll("t.created_at", "created_at");
    const values = [...filter.values];
    const limit = pageLimit(request);

    const sql = reportSql(kind, where, request, values, limit);
    if (!sql) return problem("Jenis laporan tidak dikenal.", 404);

    const result = await query(sql, values);
    const rows = result.rows.map(normalizeRow);
    return paginated(rows, limit, (row) =>
      row.created_at
        ? { created_at: row.created_at, id: row.id }
        : {
            sort:
              row.nama_produk ?? row.supplier_name ?? row.customer_name ?? "",
            id: row.id ?? 0,
          },
    );
  } catch (error) {
    return serverError(error);
  }
}

function reportSql(
  kind: string,
  where: string,
  request: NextRequest,
  values: string[],
  limit: number,
) {
  switch (kind) {
    case "all-transactions": {
      const type = request.nextUrl.searchParams.get("type");
      const customerWhere =
        type === "penjualan" ? customerFilter(request, values, "t") : "";
      const supplierWhere =
        type === "pembelian" ? supplierFilter(request, values, "p") : "";
      const salesItemWhere =
        type === "pembelian" ? "" : itemFilter(request, values, "sti", "sp");
      const salesSearchWhere =
        type === "pembelian"
          ? ""
          : searchFilter(request, values, {
              headerAlias: "t",
              partnerAlias: "c",
              partnerColumn: "nama",
              itemTable: "transaction_items",
              itemForeignKey: "transaction_id",
              headerIdColumn: "id",
            });
      const salesWhere = combineWhere(
        where.replaceAll("created_at", "t.created_at"),
        [
          dateCursorClause(request, values, "t"),
          customerWhere,
          salesSearchWhere,
          salesItemWhere
            ? `EXISTS (
                SELECT 1
                FROM transaction_items sti
                JOIN products sp ON sp.id = sti.product_id
                WHERE sti.transaction_id = t.id
                  AND ${salesItemWhere}
              )`
            : "",
        ].filter(Boolean),
      );
      const purchaseItemWhere =
        type === "penjualan" ? "" : itemFilter(request, values, "fpi", "fp");
      const purchaseSearchWhere =
        type === "penjualan"
          ? ""
          : searchFilter(request, values, {
              headerAlias: "p",
              partnerAlias: "s",
              partnerColumn: "nama",
              itemTable: "purchase_items",
              itemForeignKey: "purchase_id",
              headerIdColumn: "id",
            });
      const purchaseWhere = combineWhere(
        where.replaceAll("created_at", "p.created_at"),
        [
          dateCursorClause(request, values, "p"),
          supplierWhere,
          purchaseSearchWhere,
          purchaseItemWhere
            ? `EXISTS (
                SELECT 1
                FROM purchase_items fpi
                JOIN products fp ON fp.id = fpi.product_id
                WHERE fpi.purchase_id = p.id
                  AND ${purchaseItemWhere}
              )`
            : "",
        ].filter(Boolean),
      );
      const salesSelect = `
        SELECT 'penjualan' type, t.id, t.created_at, c.nama partner_name,
               t.total_akhir total,
               COALESCE(string_agg(ps.nama_produk || ' x' || ti.jumlah_beli, ', ' ORDER BY ti.id), '') products,
               COALESCE(
                 json_agg(
                   json_build_object(
                     'nama_produk', ps.nama_produk,
                     'jumlah_beli', ti.jumlah_beli,
                     'harga_satuan', ti.harga_satuan,
                     'subtotal', ti.subtotal
                   )
                   ORDER BY ti.id
                 ) FILTER (WHERE ti.id IS NOT NULL),
                 '[]'::json
               ) items
        FROM transactions t
        LEFT JOIN customers c ON c.id = t.customer_id
        LEFT JOIN transaction_items ti ON ti.transaction_id = t.id
        LEFT JOIN products ps ON ps.id = ti.product_id
        ${salesWhere}
        GROUP BY t.id, t.created_at, c.nama, t.total_akhir`;
      const purchaseSelect = `
        SELECT 'pembelian' type, p.id, p.created_at, s.nama partner_name,
               p.total,
               COALESCE(string_agg(pp.nama_produk || ' x' || pi.quantity, ', ' ORDER BY pi.id), '') products,
               COALESCE(
                 json_agg(
                   json_build_object(
                     'product_name', pp.nama_produk,
                     'quantity', pi.quantity,
                     'unit_price', pi.unit_price,
                     'subtotal', pi.subtotal
                   )
                   ORDER BY pi.id
                 ) FILTER (WHERE pi.id IS NOT NULL),
                 '[]'::json
               ) items
        FROM purchases p
        LEFT JOIN suppliers s ON s.id = p.supplier_id
        LEFT JOIN purchase_items pi ON pi.purchase_id = p.id
        LEFT JOIN products pp ON pp.id = pi.product_id
        ${purchaseWhere}
        GROUP BY p.id, p.created_at, s.nama, p.total`;
      const selects =
        type === "penjualan"
          ? [salesSelect]
          : type === "pembelian"
            ? [purchaseSelect]
            : [salesSelect, purchaseSelect];
      return `${selects.join("\nUNION ALL\n")} ORDER BY created_at DESC, id DESC LIMIT ${limit + 1}`;
    }
    case "purchases":
      const purchaseItemWhere = purchaseItemFilter(request, values);
      const purchaseWhere = combineWhere(
        where.replaceAll("created_at", "p.created_at"),
        [
          dateCursorClause(request, values, "p"),
          ...(purchaseItemWhere
            ? [
                `EXISTS (
                SELECT 1
                FROM purchase_items pi
                JOIN products pr ON pr.id = pi.product_id
                WHERE pi.purchase_id = p.id
                  AND ${purchaseItemWhere}
              )`,
              ]
            : []),
        ].filter(Boolean),
      );
      return `
        SELECT p.id, p.created_at, s.nama supplier_name, p.total,
               p.paid_amount, p.remaining_amount,
               COALESCE(string_agg(pr.nama_produk || ' x' || pi.quantity, ', ' ORDER BY pi.id), '') bought_products,
               COALESCE(
                 json_agg(
                   json_build_object(
                     'product_name', pr.nama_produk,
                     'quantity', pi.quantity,
                     'unit_price', pi.unit_price,
                     'subtotal', pi.subtotal
                   )
                   ORDER BY pi.id
                 ) FILTER (WHERE pi.id IS NOT NULL),
                 '[]'::json
               ) items
        FROM purchases p
        LEFT JOIN suppliers s ON s.id = p.supplier_id
        LEFT JOIN purchase_items pi ON pi.purchase_id = p.id
        LEFT JOIN products pr ON pr.id = pi.product_id
        ${purchaseWhere}
        GROUP BY p.id, p.created_at, s.nama, p.total, p.paid_amount, p.remaining_amount
        ORDER BY p.created_at DESC, p.id DESC
        LIMIT ${limit + 1}`;
    case "returns": {
      const type = request.nextUrl.searchParams.get("type");
      const customerWhere =
        type === "retur penjualan" ? customerFilter(request, values, "sr") : "";
      const supplierWhere =
        type === "retur pembelian" ? supplierFilter(request, values, "pr") : "";
      const purchaseReturnItemWhere =
        type === "retur penjualan"
          ? ""
          : itemFilter(request, values, "pri", "p");
      const purchaseReturnSearchWhere =
        type === "retur penjualan"
          ? ""
          : searchFilter(request, values, {
              headerAlias: "pr",
              partnerAlias: "s",
              partnerColumn: "nama",
              itemTable: "purchase_return_items",
              itemForeignKey: "purchase_return_id",
              headerIdColumn: "id",
            });
      const purchaseReturnWhere = combineWhere(
        where.replaceAll("created_at", "pr.created_at"),
        [
          dateCursorClause(request, values, "pr"),
          supplierWhere,
          purchaseReturnSearchWhere,
          purchaseReturnItemWhere
            ? `EXISTS (
                SELECT 1
                FROM purchase_return_items pri
                JOIN products p ON p.id = pri.product_id
                WHERE pri.purchase_return_id = pr.id
                  AND ${purchaseReturnItemWhere}
              )`
            : "",
        ].filter(Boolean),
      );
      const salesReturnItemWhere =
        type === "retur pembelian"
          ? ""
          : itemFilter(request, values, "sri", "p");
      const salesReturnSearchWhere =
        type === "retur pembelian"
          ? ""
          : searchFilter(request, values, {
              headerAlias: "sr",
              partnerAlias: "c",
              partnerColumn: "nama",
              itemTable: "sales_return_items",
              itemForeignKey: "sales_return_id",
              headerIdColumn: "id",
            });
      const salesReturnWhere = combineWhere(
        where.replaceAll("created_at", "sr.created_at"),
        [
          dateCursorClause(request, values, "sr"),
          customerWhere,
          salesReturnSearchWhere,
          salesReturnItemWhere
            ? `EXISTS (
                SELECT 1
                FROM sales_return_items sri
                JOIN products p ON p.id = sri.product_id
                WHERE sri.sales_return_id = sr.id
                  AND ${salesReturnItemWhere}
              )`
            : "",
        ].filter(Boolean),
      );
      const purchaseReturnSelect = `
        SELECT 'retur pembelian' type, pr.id, pr.created_at,
               s.nama partner_name, pr.total,
               COALESCE(string_agg(p.nama_produk || ' x' || pri.quantity, ', ' ORDER BY pri.id), '') products,
               COALESCE(
                 json_agg(
                   json_build_object(
                     'nama_produk', p.nama_produk,
                     'quantity', pri.quantity,
                     'unit_price', pri.unit_price,
                     'subtotal', pri.subtotal
                   )
                   ORDER BY pri.id
                 ) FILTER (WHERE pri.id IS NOT NULL),
                 '[]'::json
               ) items
        FROM purchase_returns pr
        LEFT JOIN suppliers s ON s.id = pr.supplier_id
        LEFT JOIN purchase_return_items pri ON pri.purchase_return_id = pr.id
        LEFT JOIN products p ON p.id = pri.product_id
        ${purchaseReturnWhere}
        GROUP BY pr.id, pr.created_at, s.nama, pr.total`;
      const salesReturnSelect = `
        SELECT 'retur penjualan' type, sr.id, sr.created_at,
               c.nama partner_name, sr.total,
               COALESCE(string_agg(p.nama_produk || ' x' || sri.quantity, ', ' ORDER BY sri.id), '') products,
               COALESCE(
                 json_agg(
                   json_build_object(
                     'nama_produk', p.nama_produk,
                     'quantity', sri.quantity,
                     'unit_price', sri.unit_price,
                     'subtotal', sri.subtotal
                   )
                   ORDER BY sri.id
                 ) FILTER (WHERE sri.id IS NOT NULL),
                 '[]'::json
               ) items
        FROM sales_returns sr
        LEFT JOIN customers c ON c.id = sr.customer_id
        LEFT JOIN sales_return_items sri ON sri.sales_return_id = sr.id
        LEFT JOIN products p ON p.id = sri.product_id
        ${salesReturnWhere}
        GROUP BY sr.id, sr.created_at, c.nama, sr.total`;
      const selects =
        type === "retur penjualan"
          ? [salesReturnSelect]
          : type === "retur pembelian"
            ? [purchaseReturnSelect]
            : [purchaseReturnSelect, salesReturnSelect];
      return `${selects.join("\nUNION ALL\n")} ORDER BY created_at DESC, id DESC LIMIT ${limit + 1}`;
    }
    case "stock-list":
      return `
        SELECT p.nama_produk, p.sku, l.nama location_name, pls.stock
        FROM product_location_stocks pls
        JOIN products p ON p.id = pls.product_id
        JOIN locations l ON l.id = pls.location_id
        ORDER BY p.nama_produk, l.nama
        LIMIT ${limit + 1}`;
    case "stock-card":
      return `
        SELECT sm.created_at, p.nama_produk, l.nama location_name,
               sm.qty_in, sm.qty_out, sm.source_type, sm.keterangan
        FROM stock_movements sm
        JOIN products p ON p.id = sm.product_id
        LEFT JOIN locations l ON l.id = sm.location_id
        ${where.replaceAll("created_at", "sm.created_at")}
        ORDER BY sm.created_at DESC
        LIMIT ${limit + 1}`;
    case "payables":
      return `
        SELECT p.id, s.nama supplier_name, p.total, p.paid_amount,
               p.remaining_amount, p.status, p.created_at
        FROM payables p
        LEFT JOIN suppliers s ON s.id = p.supplier_id
        ORDER BY p.created_at DESC
        LIMIT ${limit + 1}`;
    case "receivables":
      return `
        SELECT r.id, c.nama customer_name, r.total, r.paid_amount,
               r.remaining_amount, r.status, r.created_at
        FROM receivables r
        LEFT JOIN customers c ON c.id = r.customer_id
        ORDER BY r.created_at DESC
        LIMIT ${limit + 1}`;
    case "cash-daily":
      return `
        SELECT DATE(created_at) tanggal,
               SUM(CASE WHEN type = 'in' THEN amount ELSE 0 END) kas_masuk,
               SUM(CASE WHEN type = 'out' THEN amount ELSE 0 END) kas_keluar,
               SUM(CASE WHEN type = 'in' THEN amount ELSE -amount END) saldo
        FROM cash_entries
        ${where}
        GROUP BY DATE(created_at)
        ORDER BY tanggal DESC
        LIMIT ${limit + 1}`;
    default:
      return null;
  }
}

function customerFilter(
  request: NextRequest,
  values: string[],
  transactionAlias: string,
) {
  const customerId = request.nextUrl.searchParams.get("customer_id");
  if (!customerId) return "";
  values.push(customerId);
  return `${transactionAlias}.customer_id = $${values.length}`;
}

function supplierFilter(
  request: NextRequest,
  values: string[],
  transactionAlias: string,
) {
  const supplierId = request.nextUrl.searchParams.get("supplier_id");
  if (!supplierId) return "";
  values.push(supplierId);
  return `${transactionAlias}.supplier_id = $${values.length}`;
}

function purchaseItemFilter(request: NextRequest, values: string[]) {
  return itemFilter(request, values, "pi", "pr");
}

function itemFilter(
  request: NextRequest,
  values: string[],
  itemAlias: string,
  productAlias: string,
) {
  const clauses: string[] = [];
  const productId = request.nextUrl.searchParams.get("product_id");
  const categoryId = request.nextUrl.searchParams.get("category_id");
  if (productId) {
    values.push(productId);
    clauses.push(`${itemAlias}.product_id = $${values.length}`);
  }
  if (categoryId) {
    values.push(categoryId);
    clauses.push(`${productAlias}.category_id = $${values.length}`);
  }
  return clauses.join(" AND ");
}

function searchFilter(
  request: NextRequest,
  values: string[],
  config: {
    headerAlias: string;
    partnerAlias: string;
    partnerColumn: string;
    itemTable: string;
    itemForeignKey: string;
    headerIdColumn: string;
  },
) {
  const search = request.nextUrl.searchParams.get("search")?.trim();
  if (!search) return "";
  values.push(`%${search}%`);
  const parameter = `$${values.length}`;
  return `(
    ${config.headerAlias}.id::text ILIKE ${parameter}
    OR ${config.partnerAlias}.${config.partnerColumn} ILIKE ${parameter}
    OR EXISTS (
      SELECT 1
      FROM ${config.itemTable} si
      JOIN products search_product ON search_product.id = si.product_id
      WHERE si.${config.itemForeignKey} = ${config.headerAlias}.${config.headerIdColumn}
        AND (search_product.nama_produk ILIKE ${parameter}
             OR search_product.sku ILIKE ${parameter})
    )
  )`;
}

function combineWhere(baseWhere: string, extraClauses: string[]) {
  if (extraClauses.length === 0) return baseWhere;
  const extra = extraClauses.join(" AND ");
  return baseWhere ? `${baseWhere} AND ${extra}` : `WHERE ${extra}`;
}
