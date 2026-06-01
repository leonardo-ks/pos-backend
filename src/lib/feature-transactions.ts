import { type NextRequest } from "next/server";
import { type PoolClient } from "pg";

import { requirePermission } from "./auth";
import { query, withTransaction } from "./db";
import { created, ok, problem, serverError } from "./http";
import { normalizeRow } from "./feature-crud";
import { dateCursorClause, pageLimit, paginated } from "./pagination";
import {
  asInteger,
  asNumber,
  asOptionalString,
  ValidationError,
} from "./validation";

type ItemInput = {
  product_id: number;
  location_id: number | null;
  quantity: number;
  unit_price: number;
};

type TransactionKind = "purchase" | "purchaseReturn" | "salesReturn";

type TransactionConfig = {
  kind: TransactionKind;
  headerTable: string;
  itemTable: string;
  itemFk: string;
  stockDirection: "in" | "out";
  sourceType: string;
};

export const transactionConfigs = {
  purchases: {
    kind: "purchase",
    headerTable: "purchases",
    itemTable: "purchase_items",
    itemFk: "purchase_id",
    stockDirection: "in",
    sourceType: "purchase",
  },
  purchaseReturns: {
    kind: "purchaseReturn",
    headerTable: "purchase_returns",
    itemTable: "purchase_return_items",
    itemFk: "purchase_return_id",
    stockDirection: "out",
    sourceType: "purchase_return",
  },
  salesReturns: {
    kind: "salesReturn",
    headerTable: "sales_returns",
    itemTable: "sales_return_items",
    itemFk: "sales_return_id",
    stockDirection: "in",
    sourceType: "sales_return",
  },
} satisfies Record<string, TransactionConfig>;

export function listBusinessTransactions(config: TransactionConfig) {
  return async function GET(request: NextRequest) {
    try {
      const mode = request.nextUrl.searchParams.get("mode");
      const auth = await requirePermission(
        request,
        config.kind === "purchase" && mode === "return-picker"
          ? "purchase-returns"
          : permissionSection(config),
        "can_view",
      );
      if (auth.error) return problem(auth.error.message, auth.error.status);

      if (config.kind === "purchase") {
        const search = request.nextUrl.searchParams.get("search")?.trim() ?? "";
        const supplierId = request.nextUrl.searchParams.get("supplier_id");
        const categoryId = request.nextUrl.searchParams.get("category_id");
        const productId = request.nextUrl.searchParams.get("product_id");
        const from = request.nextUrl.searchParams.get("from");
        const to = request.nextUrl.searchParams.get("to");
        const limit = pageLimit(request, mode === "return-picker" ? 25 : 50);
        const where: string[] = [];
        const values: unknown[] = [];
        if (mode === "return-picker" && !search) {
          where.push(
            "p.created_at >= CURRENT_DATE AND p.created_at < CURRENT_DATE + INTERVAL '1 day'",
          );
        }
        if (search) {
          values.push(`%${search}%`);
          const parameter = `$${values.length}`;
          where.push(
            `(p.id::text ILIKE ${parameter}
              OR s.nama ILIKE ${parameter}
              OR EXISTS (
                SELECT 1
                FROM purchase_items spi
                JOIN products spr ON spr.id = spi.product_id
                WHERE spi.purchase_id = p.id
                  AND spr.nama_produk ILIKE ${parameter}
            ))`,
          );
        }
        if (supplierId) {
          values.push(Number(supplierId));
          where.push(`p.supplier_id = $${values.length}`);
        }
        if (from) {
          values.push(from);
          where.push(`p.created_at >= $${values.length}`);
        }
        if (to) {
          values.push(to);
          where.push(`p.created_at < $${values.length}`);
        }
        if (categoryId) {
          values.push(Number(categoryId));
          where.push(
            `EXISTS (
              SELECT 1
              FROM purchase_items cpi
              JOIN products cp ON cp.id = cpi.product_id
              WHERE cpi.purchase_id = p.id
                AND cp.category_id = $${values.length}
            )`,
          );
        }
        if (productId) {
          values.push(Number(productId));
          where.push(
            `EXISTS (
              SELECT 1
              FROM purchase_items ppi
              WHERE ppi.purchase_id = p.id
                AND ppi.product_id = $${values.length}
            )`,
          );
        }
        const cursorWhere = dateCursorClause(request, values, "p");
        if (cursorWhere) where.push(cursorWhere);
        const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
        const result = await query(
          `SELECT p.id, p.created_at, p.supplier_id, s.nama supplier_name,
                  p.total, p.paid_amount, p.remaining_amount, p.keterangan,
                  COALESCE(
                    string_agg(pr.nama_produk || ' x' || pi.quantity, ', ' ORDER BY pi.id),
                    ''
                  ) bought_products,
                  COALESCE(
                    json_agg(
                      json_build_object(
                        'product_id', pi.product_id,
                        'location_id', pi.location_id,
                        'nama_produk', pr.nama_produk,
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
           ${whereSql}
           GROUP BY p.id, p.created_at, p.supplier_id, s.nama, p.total,
                    p.paid_amount, p.remaining_amount, p.keterangan
           ORDER BY p.created_at DESC, p.id DESC
           LIMIT ${limit + 1}`,
          values,
        );
        const rows = result.rows.map(normalizeRow);
        return paginated(rows, limit, (row) => ({
          created_at: row.created_at,
          id: row.id,
        }));
      }

      if (config.kind === "purchaseReturn") {
        const search = request.nextUrl.searchParams.get("search")?.trim() ?? "";
        const supplierId = request.nextUrl.searchParams.get("supplier_id");
        const categoryId = request.nextUrl.searchParams.get("category_id");
        const productId = request.nextUrl.searchParams.get("product_id");
        const from = request.nextUrl.searchParams.get("from");
        const to = request.nextUrl.searchParams.get("to");
        const limit = pageLimit(request);
        const where: string[] = [];
        const values: unknown[] = [];
        if (search) {
          values.push(`%${search}%`);
          const parameter = `$${values.length}`;
          where.push(
            `(pr.id::text ILIKE ${parameter}
              OR s.nama ILIKE ${parameter}
              OR EXISTS (
                SELECT 1
                FROM purchase_return_items spri
                JOIN products sp ON sp.id = spri.product_id
                WHERE spri.purchase_return_id = pr.id
                  AND sp.nama_produk ILIKE ${parameter}
            ))`,
          );
        }
        if (supplierId) {
          values.push(Number(supplierId));
          where.push(`pr.supplier_id = $${values.length}`);
        }
        if (from) {
          values.push(from);
          where.push(`pr.created_at >= $${values.length}`);
        }
        if (to) {
          values.push(to);
          where.push(`pr.created_at < $${values.length}`);
        }
        if (categoryId) {
          values.push(Number(categoryId));
          where.push(
            `EXISTS (
              SELECT 1
              FROM purchase_return_items cpri
              JOIN products cp ON cp.id = cpri.product_id
              WHERE cpri.purchase_return_id = pr.id
                AND cp.category_id = $${values.length}
            )`,
          );
        }
        if (productId) {
          values.push(Number(productId));
          where.push(
            `EXISTS (
              SELECT 1
              FROM purchase_return_items ppri
              WHERE ppri.purchase_return_id = pr.id
                AND ppri.product_id = $${values.length}
            )`,
          );
        }
        const cursorWhere = dateCursorClause(request, values, "pr");
        if (cursorWhere) where.push(cursorWhere);
        const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
        const result = await query(
          `SELECT pr.id, pr.created_at, pr.purchase_id, pr.supplier_id,
                  s.nama supplier_name, pr.total, pr.keterangan,
                  COALESCE(
                    string_agg(p.nama_produk || ' x' || pri.quantity, ', ' ORDER BY pri.id),
                    ''
                  ) returned_products,
                  COALESCE(
                    json_agg(
                      json_build_object(
                        'product_id', pri.product_id,
                        'location_id', pri.location_id,
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
           ${whereSql}
           GROUP BY pr.id, pr.created_at, pr.purchase_id, pr.supplier_id,
                    s.nama, pr.total, pr.keterangan
           ORDER BY pr.created_at DESC, pr.id DESC
           LIMIT ${limit + 1}`,
          values,
        );
        const rows = result.rows.map(normalizeRow);
        return paginated(rows, limit, (row) => ({
          created_at: row.created_at,
          id: row.id,
        }));
      }

      if (config.kind === "salesReturn") {
        const search = request.nextUrl.searchParams.get("search")?.trim() ?? "";
        const customerId = request.nextUrl.searchParams.get("customer_id");
        const categoryId = request.nextUrl.searchParams.get("category_id");
        const productId = request.nextUrl.searchParams.get("product_id");
        const from = request.nextUrl.searchParams.get("from");
        const to = request.nextUrl.searchParams.get("to");
        const limit = pageLimit(request);
        const where: string[] = [];
        const values: unknown[] = [];
        if (search) {
          values.push(`%${search}%`);
          const parameter = `$${values.length}`;
          where.push(
            `(sr.id::text ILIKE ${parameter}
              OR c.nama ILIKE ${parameter}
              OR EXISTS (
                SELECT 1
                FROM sales_return_items ssri
                JOIN products sp ON sp.id = ssri.product_id
                WHERE ssri.sales_return_id = sr.id
                  AND sp.nama_produk ILIKE ${parameter}
            ))`,
          );
        }
        if (customerId) {
          values.push(Number(customerId));
          where.push(`sr.customer_id = $${values.length}`);
        }
        if (from) {
          values.push(from);
          where.push(`sr.created_at >= $${values.length}`);
        }
        if (to) {
          values.push(to);
          where.push(`sr.created_at < $${values.length}`);
        }
        if (categoryId) {
          values.push(Number(categoryId));
          where.push(
            `EXISTS (
              SELECT 1
              FROM sales_return_items csri
              JOIN products cp ON cp.id = csri.product_id
              WHERE csri.sales_return_id = sr.id
                AND cp.category_id = $${values.length}
            )`,
          );
        }
        if (productId) {
          values.push(Number(productId));
          where.push(
            `EXISTS (
              SELECT 1
              FROM sales_return_items psri
              WHERE psri.sales_return_id = sr.id
                AND psri.product_id = $${values.length}
            )`,
          );
        }
        const cursorWhere = dateCursorClause(request, values, "sr");
        if (cursorWhere) where.push(cursorWhere);
        const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
        const result = await query(
          `SELECT sr.id, sr.created_at, sr.transaction_id, sr.customer_id,
                  c.nama customer_name, sr.total, sr.keterangan,
                  COALESCE(
                    string_agg(p.nama_produk || ' x' || sri.quantity, ', ' ORDER BY sri.id),
                    ''
                  ) returned_products,
                  COALESCE(
                    json_agg(
                      json_build_object(
                        'product_id', sri.product_id,
                        'location_id', sri.location_id,
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
           ${whereSql}
           GROUP BY sr.id, sr.created_at, sr.transaction_id, sr.customer_id,
                    c.nama, sr.total, sr.keterangan
           ORDER BY sr.created_at DESC, sr.id DESC
           LIMIT ${limit + 1}`,
          values,
        );
        const rows = result.rows.map(normalizeRow);
        return paginated(rows, limit, (row) => ({
          created_at: row.created_at,
          id: row.id,
        }));
      }

      const limit = pageLimit(request);
      const values: unknown[] = [];
      const cursorWhere = dateCursorClause(request, values, config.headerTable);
      const result = await query(
        `SELECT * FROM ${config.headerTable}
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
  };
}

export function createBusinessTransaction(config: TransactionConfig) {
  return async function POST(request: NextRequest) {
    try {
      const auth = await requirePermission(
        request,
        permissionSection(config),
        "can_create",
      );
      if (auth.error || !auth.user) {
        return problem(
          auth.error?.message ?? "Login diperlukan.",
          auth.error?.status ?? 401,
        );
      }

      const body = (await request.json()) as Record<string, unknown>;
      const items = parseItems(body.items);
      const total = items.reduce(
        (sum, item) => sum + item.quantity * item.unit_price,
        0,
      );
      const paidAmount =
        config.kind === "purchase"
          ? Math.min(asNumber(body.paid_amount ?? total, "paid_amount"), total)
          : 0;
      const remainingAmount =
        config.kind === "purchase" ? total - paidAmount : 0;

      const result = await withTransaction(async (client) => {
        const saved = await insertHeader(client, config, body, auth.user!.id, {
          total,
          paidAmount,
          remainingAmount,
        });

        for (const item of items) {
          await insertItem(client, config, saved.id as number, item);
          await applyStock(client, config, saved.id as number, item);
        }

        if (config.kind === "purchase" && remainingAmount > 0) {
          await client.query(
            `INSERT INTO payables
               (purchase_id, supplier_id, total, paid_amount, remaining_amount, status)
             VALUES ($1, $2, $3, $4, $5, 'open')`,
            [saved.id, saved.supplier_id, total, paidAmount, remainingAmount],
          );
        }

        return saved;
      });

      return created(normalizeRow(result));
    } catch (error) {
      if (error instanceof ValidationError) return problem(error.message, 400);
      return serverError(error);
    }
  };
}

export function getBusinessTransaction(config: TransactionConfig) {
  return async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> },
  ) {
    try {
      const auth = await requirePermission(
        request,
        permissionSection(config),
        "can_view",
      );
      if (auth.error) return problem(auth.error.message, auth.error.status);

      const { id } = await context.params;
      const headerId = asInteger(id, "id", 1);
      const result = await query(
        detailSql(config),
        [headerId],
      );
      if (!result.rows[0]) return problem("Retur tidak ditemukan.", 404);
      return ok(normalizeRow(result.rows[0]));
    } catch (error) {
      if (error instanceof ValidationError) return problem(error.message, 400);
      return serverError(error);
    }
  };
}

export function updateBusinessTransaction(config: TransactionConfig) {
  return async function PATCH(
    request: NextRequest,
    context: { params: Promise<{ id: string }> },
  ) {
    try {
      const auth = await requirePermission(
        request,
        permissionSection(config),
        "can_update",
      );
      if (auth.error || !auth.user) {
        return problem(
          auth.error?.message ?? "Login diperlukan.",
          auth.error?.status ?? 401,
        );
      }
      const { id } = await context.params;
      const headerId = asInteger(id, "id", 1);
      const body = (await request.json()) as Record<string, unknown>;
      const items = parseItems(body.items);
      const total = items.reduce(
        (sum, item) => sum + item.quantity * item.unit_price,
        0,
      );

      const result = await withTransaction(async (client) => {
        const existing = await client.query<ItemInput>(
          `SELECT product_id, location_id, quantity, unit_price
           FROM ${config.itemTable}
           WHERE ${config.itemFk} = $1`,
          [headerId],
        );
        if (config.kind === "purchase") {
          await client.query(
            `DELETE FROM ${config.itemTable} WHERE ${config.itemFk} = $1`,
            [headerId],
          );

          const saved = await updateHeader(client, config, headerId, body, total);
          if (!saved) throw new ValidationError("Pembelian tidak ditemukan.");

          for (const item of items) {
            await insertItem(client, config, headerId, item);
          }

          const defaultLocationId = await getDefaultLocationId(client);
          const oldStock = aggregateItems(existing.rows, defaultLocationId);
          const newStock = aggregateItems(items, defaultLocationId);
          const keys = new Set([...oldStock.keys(), ...newStock.keys()]);
          for (const key of keys) {
            const previous = oldStock.get(key);
            const next = newStock.get(key);
            const delta = (next?.quantity ?? 0) - (previous?.quantity ?? 0);
            if (delta === 0) continue;
            await applyStockDirection(
              client,
              delta > 0 ? "in" : "out",
              `${config.sourceType}_edit`,
              headerId,
              {
                product_id: (next ?? previous)!.product_id,
                location_id: (next ?? previous)!.location_id,
                quantity: Math.abs(delta),
                unit_price: (next ?? previous)!.unit_price,
              },
            );
          }

          const paidAmount = Math.min(
            asNumber(body.paid_amount ?? total, "paid_amount"),
            total,
          );
          const remainingAmount = total - paidAmount;
          await client.query("DELETE FROM payables WHERE purchase_id = $1", [
            headerId,
          ]);
          if (remainingAmount > 0) {
            await client.query(
              `INSERT INTO payables
                 (purchase_id, supplier_id, total, paid_amount, remaining_amount, status)
               VALUES ($1, $2, $3, $4, $5, 'open')`,
              [
                headerId,
                saved.supplier_id,
                total,
                paidAmount,
                remainingAmount,
              ],
            );
          }

          return saved;
        }

        for (const item of existing.rows) {
          await applyStockDirection(
            client,
            reverseDirection(config.stockDirection),
            `${config.sourceType}_edit`,
            headerId,
            item,
          );
        }

        await client.query(
          `DELETE FROM ${config.itemTable} WHERE ${config.itemFk} = $1`,
          [headerId],
        );

        const saved = await updateHeader(client, config, headerId, body, total);
        if (!saved) throw new ValidationError("Retur tidak ditemukan.");

        for (const item of items) {
          await insertItem(client, config, headerId, item);
          await applyStock(client, config, headerId, item);
        }
        return saved;
      });

      return ok(normalizeRow(result));
    } catch (error) {
      if (error instanceof ValidationError) return problem(error.message, 400);
      return serverError(error);
    }
  };
}

export function deleteBusinessTransaction(config: TransactionConfig) {
  return async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ id: string }> },
  ) {
    try {
      const auth = await requirePermission(
        request,
        permissionSection(config),
        "can_delete",
      );
      if (auth.error) return problem(auth.error.message, auth.error.status);

      const { id } = await context.params;
      const headerId = asInteger(id, "id", 1);
      await withTransaction(async (client) => {
        const existing = await client.query<ItemInput>(
          `SELECT product_id, location_id, quantity, unit_price
           FROM ${config.itemTable}
           WHERE ${config.itemFk} = $1`,
          [headerId],
        );
        for (const item of existing.rows) {
          await applyStockDirection(
            client,
            reverseDirection(config.stockDirection),
            `${config.sourceType}_delete`,
            headerId,
            item,
          );
        }
        if (config.kind === "purchase") {
          await client.query("DELETE FROM payables WHERE purchase_id = $1", [
            headerId,
          ]);
        }
        const result = await client.query(
          `DELETE FROM ${config.headerTable}
           WHERE id = $1
           RETURNING id`,
          [headerId],
        );
        if (!result.rows[0]) throw new ValidationError("Data tidak ditemukan.");
      });
      return ok({ id: headerId });
    } catch (error) {
      if (error instanceof ValidationError) return problem(error.message, 400);
      return serverError(error);
    }
  };
}

function detailSql(config: TransactionConfig) {
  if (config.kind === "purchaseReturn") {
    return `SELECT pr.id, pr.created_at, pr.purchase_id, pr.supplier_id,
                   s.nama supplier_name, pr.total, pr.keterangan,
                   COALESCE(string_agg(p.nama_produk || ' x' || pri.quantity, ', ' ORDER BY pri.id), '') returned_products,
                   COALESCE(
                     json_agg(
                       json_build_object(
                         'product_id', pri.product_id,
                         'location_id', pri.location_id,
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
            WHERE pr.id = $1
            GROUP BY pr.id, pr.created_at, pr.purchase_id, pr.supplier_id,
                     s.nama, pr.total, pr.keterangan`;
  }
  return `SELECT sr.id, sr.created_at, sr.transaction_id, sr.customer_id,
                 c.nama customer_name, sr.total, sr.keterangan,
                 COALESCE(string_agg(p.nama_produk || ' x' || sri.quantity, ', ' ORDER BY sri.id), '') returned_products,
                 COALESCE(
                   json_agg(
                     json_build_object(
                     'product_id', sri.product_id,
                     'location_id', sri.location_id,
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
          WHERE sr.id = $1
          GROUP BY sr.id, sr.created_at, sr.transaction_id, sr.customer_id,
                   c.nama, sr.total, sr.keterangan`;
}

async function insertHeader(
  client: PoolClient,
  config: TransactionConfig,
  body: Record<string, unknown>,
  userId: number,
  totals: { total: number; paidAmount: number; remainingAmount: number },
) {
  const keterangan = asOptionalString(body.keterangan) ?? "";
  if (config.kind === "purchase") {
    const supplierId = optionalId(body.supplier_id, "supplier_id");
    const result = await client.query(
      `INSERT INTO purchases
         (supplier_id, user_id, total, paid_amount, remaining_amount, keterangan)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        supplierId,
        userId,
        totals.total,
        totals.paidAmount,
        totals.remainingAmount,
        keterangan,
      ],
    );
    return result.rows[0] as Record<string, unknown>;
  }
  if (config.kind === "purchaseReturn") {
    const result = await client.query(
      `INSERT INTO purchase_returns
         (purchase_id, supplier_id, user_id, total, keterangan)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        optionalId(body.purchase_id, "purchase_id"),
        optionalId(body.supplier_id, "supplier_id"),
        userId,
        totals.total,
        keterangan,
      ],
    );
    return result.rows[0] as Record<string, unknown>;
  }
  const result = await client.query(
    `INSERT INTO sales_returns
       (transaction_id, customer_id, user_id, total, keterangan)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      optionalId(body.transaction_id, "transaction_id"),
      optionalId(body.customer_id, "customer_id"),
      userId,
      totals.total,
      keterangan,
    ],
  );
  return result.rows[0] as Record<string, unknown>;
}

async function updateHeader(
  client: PoolClient,
  config: TransactionConfig,
  headerId: number,
  body: Record<string, unknown>,
  total: number,
) {
  const keterangan = asOptionalString(body.keterangan) ?? "";
  if (config.kind === "purchase") {
    const paidAmount = Math.min(
      asNumber(body.paid_amount ?? total, "paid_amount"),
      total,
    );
    const remainingAmount = total - paidAmount;
    const result = await client.query(
      `UPDATE purchases
       SET supplier_id = $2,
           total = $3,
           paid_amount = $4,
           remaining_amount = $5,
           keterangan = $6,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        headerId,
        optionalId(body.supplier_id, "supplier_id"),
        total,
        paidAmount,
        remainingAmount,
        keterangan,
      ],
    );
    return result.rows[0] as Record<string, unknown> | undefined;
  }
  if (config.kind === "purchaseReturn") {
    const result = await client.query(
      `UPDATE purchase_returns
       SET purchase_id = $2,
           supplier_id = $3,
           total = $4,
           keterangan = $5,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        headerId,
        optionalId(body.purchase_id, "purchase_id"),
        optionalId(body.supplier_id, "supplier_id"),
        total,
        keterangan,
      ],
    );
    return result.rows[0] as Record<string, unknown> | undefined;
  }
  const result = await client.query(
    `UPDATE sales_returns
     SET transaction_id = $2,
         customer_id = $3,
         total = $4,
         keterangan = $5,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [
      headerId,
      optionalId(body.transaction_id, "transaction_id"),
      optionalId(body.customer_id, "customer_id"),
      total,
      keterangan,
    ],
  );
  return result.rows[0] as Record<string, unknown> | undefined;
}

async function insertItem(
  client: PoolClient,
  config: TransactionConfig,
  headerId: number,
  item: ItemInput,
) {
  await client.query(
    `INSERT INTO ${config.itemTable}
       (${config.itemFk}, product_id, location_id, quantity, unit_price, subtotal)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      headerId,
      item.product_id,
      item.location_id,
      item.quantity,
      item.unit_price,
      item.quantity * item.unit_price,
    ],
  );
}

async function applyStock(
  client: PoolClient,
  config: TransactionConfig,
  headerId: number,
  item: ItemInput,
) {
  await applyStockDirection(
    client,
    config.stockDirection,
    config.sourceType,
    headerId,
    item,
  );
}

async function applyStockDirection(
  client: PoolClient,
  stockDirection: "in" | "out",
  sourceType: string,
  headerId: number,
  item: ItemInput,
) {
  const locationId = item.location_id;
  if (stockDirection === "out") {
    const stock = await client.query<{ stock: number }>(
      `SELECT stock
       FROM product_location_stocks
       WHERE product_id = $1
         AND location_id = COALESCE($2, (SELECT id FROM locations WHERE kode = 'UTM'))
       FOR UPDATE`,
      [item.product_id, locationId],
    );
    if ((stock.rows[0]?.stock ?? 0) < item.quantity) {
      throw new ValidationError("Stok tidak cukup untuk transaksi ini.");
    }
  }

  const stockColumn = stockDirection === "in" ? "stock + $3" : "stock - $3";
  const qtyColumn = stockDirection === "in" ? "qty_in" : "qty_out";
  await client.query(
    `INSERT INTO product_location_stocks (product_id, location_id, stock)
     VALUES ($1, COALESCE($2, (SELECT id FROM locations WHERE kode = 'UTM')), 0)
     ON CONFLICT (product_id, location_id) DO NOTHING`,
    [item.product_id, locationId],
  );
  await client.query(
    `UPDATE product_location_stocks
     SET stock = ${stockColumn}, updated_at = NOW()
     WHERE product_id = $1
       AND location_id = COALESCE($2, (SELECT id FROM locations WHERE kode = 'UTM'))`,
    [item.product_id, locationId, item.quantity],
  );
  await client.query(
    `UPDATE products
     SET stok = GREATEST(stok ${stockDirection === "in" ? "+" : "-"} $2, 0),
         updated_at = NOW()
     WHERE id = $1`,
    [item.product_id, item.quantity],
  );
  await client.query(
    `INSERT INTO stock_movements
       (product_id, location_id, ${qtyColumn}, source_type, source_id, keterangan)
     VALUES (
       $1,
       COALESCE($2, (SELECT id FROM locations WHERE kode = 'UTM')),
      $3,
      $4,
      $5,
      $6
     )`,
    [
      item.product_id,
      locationId,
      item.quantity,
      sourceType,
      headerId,
      sourceType,
    ],
  );
}

function reverseDirection(direction: "in" | "out") {
  return direction === "in" ? "out" : "in";
}

async function getDefaultLocationId(client: PoolClient) {
  const result = await client.query<{ id: number }>(
    "SELECT id FROM locations WHERE kode = 'UTM' LIMIT 1",
  );
  return result.rows[0]?.id ?? null;
}

function aggregateItems(items: ItemInput[], defaultLocationId: number | null) {
  const grouped = new Map<string, ItemInput>();
  for (const item of items) {
    const locationKey = item.location_id ?? defaultLocationId ?? "default";
    const key = `${item.product_id}:${locationKey}`;
    const current = grouped.get(key);
    if (!current) {
      grouped.set(key, { ...item });
      continue;
    }
    current.quantity += item.quantity;
  }
  return grouped;
}

function permissionSection(config: TransactionConfig) {
  if (config.kind === "purchase") return "purchases";
  if (config.kind === "purchaseReturn") return "purchase-returns";
  return "sales-returns";
}

function parseItems(value: unknown): ItemInput[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ValidationError("items wajib berisi minimal satu produk.");
  }
  return value.map((item) => {
    if (typeof item !== "object" || item == null) {
      throw new ValidationError("Format item tidak valid.");
    }
    const record = item as Record<string, unknown>;
    return {
      product_id: asInteger(record.product_id, "product_id", 1),
      location_id: optionalId(record.location_id, "location_id"),
      quantity: asInteger(record.quantity, "quantity", 1),
      unit_price: asNumber(record.unit_price, "unit_price", 0),
    };
  });
}

function optionalId(value: unknown, field: string) {
  return value == null || value === "" ? null : asInteger(value, field, 1);
}
