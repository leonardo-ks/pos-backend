import { type PoolClient } from "pg";
import { type NextRequest } from "next/server";

import { requireUser } from "@/lib/auth";
import { query, withTransaction } from "@/lib/db";
import { created, ok, problem, serverError } from "@/lib/http";
import { dateCursorClause, pageLimit, paginated } from "@/lib/pagination";
import { transaction, type TransactionRow } from "@/lib/serializers";
import { asInteger, asNumber, ValidationError } from "@/lib/validation";

type ProductForSale = {
  id: number;
  nama_produk: string;
  harga: string;
  stok: number;
  category_id: number | null;
};

type CustomerForSale = {
  id: number;
};

type TransactionItemResponse = {
  product_id: number;
  nama_produk: string;
  jumlah_beli: number;
  harga_satuan: number;
  subtotal: number;
};

type TransactionCreateBody = {
  customer_id?: unknown;
  items?: unknown;
  paid_amount?: unknown;
  cash_received?: unknown;
  payment_method?: unknown;
};

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (auth.error) return problem(auth.error.message, auth.error.status);

    const mode = request.nextUrl.searchParams.get("mode");
    const search = request.nextUrl.searchParams.get("search")?.trim() ?? "";
    const limit = pageLimit(request, mode === "return-picker" ? 25 : 50);
    const where: string[] = [];
    const values: unknown[] = [];
    if (mode === "return-picker" && !search) {
      where.push(
        "t.created_at >= CURRENT_DATE AND t.created_at < CURRENT_DATE + INTERVAL '1 day'",
      );
    }
    if (search) {
      values.push(`%${search}%`);
      const parameter = `$${values.length}`;
      where.push(
        `(t.id::text ILIKE ${parameter}
          OR c.nama ILIKE ${parameter}
          OR EXISTS (
            SELECT 1
            FROM transaction_items sti
            JOIN products sp ON sp.id = sti.product_id
            WHERE sti.transaction_id = t.id
              AND sp.nama_produk ILIKE ${parameter}
          ))`,
      );
    }
    const cursorWhere = dateCursorClause(request, values, "t");
    if (cursorWhere) where.push(cursorWhere);
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const result = await query<TransactionRow & { customer_name?: string }>(
      `SELECT t.id, t.created_at, t.customer_id, c.nama customer_name,
              t.user_id, t.subtotal,
              t.discount_amount, t.total_akhir, t.paid_amount,
              t.cash_received, t.change_amount, t.payment_method,
              COALESCE(
                json_agg(
                  json_build_object(
                    'product_id', ti.product_id,
                    'nama_produk', p.nama_produk,
                    'jumlah_beli', ti.jumlah_beli,
                    'harga_satuan', ti.harga_satuan,
                    'subtotal', ti.subtotal
                  )
                  ORDER BY ti.id
                ) FILTER (WHERE ti.id IS NOT NULL),
                '[]'::json
              ) AS items
       FROM transactions t
       LEFT JOIN customers c ON c.id = t.customer_id
       LEFT JOIN transaction_items ti ON ti.transaction_id = t.id
       LEFT JOIN products p ON p.id = ti.product_id
       ${whereSql}
       GROUP BY t.id, t.created_at, t.customer_id, t.user_id, t.subtotal,
                c.nama, t.discount_amount, t.total_akhir, t.paid_amount,
                t.cash_received, t.change_amount, t.payment_method
       ORDER BY t.created_at DESC, t.id DESC
       LIMIT ${limit + 1}`,
      values,
    );

    return paginated(
      result.rows.map((row) => ({
        ...transaction(row),
        customer_name: row.customer_name ?? null,
        items: row.items ?? [],
      })),
      limit,
      (row) => ({ created_at: row.created_at, id: row.id }),
    );
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (auth.error || !auth.user) {
      return problem(
        auth.error?.message ?? "Login diperlukan.",
        auth.error?.status ?? 401,
      );
    }

    const body = (await request.json()) as TransactionCreateBody;
    const rawItems = parseItems(body.items);
    const customerId =
      body.customer_id == null
        ? null
        : asInteger(body.customer_id, "customer_id", 1);
    const paymentMethod =
      typeof body.payment_method === "string" && body.payment_method.trim()
        ? body.payment_method.trim()
        : "cash";

    const result = await withTransaction(async (client) => {
      const customer =
        customerId == null
          ? null
          : await findCustomerForUpdate(client, customerId);
      if (customerId != null && !customer) {
        throw new ValidationError("Pelanggan tidak ditemukan.");
      }
      const customerDiscounts =
        customerId == null
          ? new Map<number, number>()
          : await findCustomerDiscounts(client, customerId);

      const items: TransactionItemResponse[] = [];
      let subtotal = 0;
      let discountAmount = 0;

      for (const item of rawItems) {
        const product = await findProductForUpdate(client, item.product_id);
        if (!product) throw new ValidationError("Produk tidak ditemukan.");
        if (product.stok < item.jumlah_beli) {
          throw new ValidationError(`Stok ${product.nama_produk} tidak cukup.`);
        }

        const unitPrice = Number(product.harga);
        const itemSubtotal = unitPrice * item.jumlah_beli;
        const itemDiscountRate =
          product.category_id == null
            ? 0
            : (customerDiscounts.get(product.category_id) ?? 0);
        subtotal += itemSubtotal;
        discountAmount += itemSubtotal * itemDiscountRate;

        items.push({
          product_id: product.id,
          nama_produk: product.nama_produk,
          jumlah_beli: item.jumlah_beli,
          harga_satuan: unitPrice,
          subtotal: itemSubtotal,
        });
      }

      const totalFinal = subtotal - discountAmount;
      const rawCashReceived = asNumber(
        body.cash_received ?? body.paid_amount ?? totalFinal,
        "cash_received",
      );
      if (paymentMethod === "cash" && rawCashReceived < totalFinal) {
        throw new ValidationError("Uang tunai kurang dari total transaksi.");
      }
      const paidAmount = Math.min(
        asNumber(body.paid_amount ?? rawCashReceived, "paid_amount"),
        totalFinal,
      );
      const cashReceived =
        paymentMethod === "cash" ? rawCashReceived : paidAmount;
      const changeAmount =
        paymentMethod === "cash"
          ? Math.max(rawCashReceived - totalFinal, 0)
          : 0;
      const remainingAmount = totalFinal - paidAmount;

      const transactionResult = await client.query<TransactionRow>(
        `INSERT INTO transactions
           (customer_id, user_id, subtotal, discount_amount, total_akhir,
            paid_amount, remaining_amount, payment_status, payment_method,
            cash_received, change_amount)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id, created_at, customer_id, user_id, subtotal, discount_amount,
                   total_akhir, paid_amount, cash_received, change_amount,
                   payment_method`,
        [
          customerId,
          auth.user.id,
          subtotal,
          discountAmount,
          totalFinal,
          paidAmount,
          remainingAmount,
          remainingAmount > 0 ? "partial" : "paid",
          paymentMethod,
          cashReceived,
          changeAmount,
        ],
      );
      const savedTransaction = transactionResult.rows[0];

      for (const item of items) {
        await client.query(
          `INSERT INTO transaction_items
             (transaction_id, product_id, jumlah_beli, harga_satuan, subtotal)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            savedTransaction.id,
            item.product_id,
            item.jumlah_beli,
            item.harga_satuan,
            item.subtotal,
          ],
        );
        await client.query(
          `UPDATE products
           SET stok = stok - $2,
               updated_at = NOW()
           WHERE id = $1`,
          [item.product_id, item.jumlah_beli],
        );
        await client.query(
          `UPDATE product_location_stocks
           SET stock = GREATEST(stock - $2, 0),
               updated_at = NOW()
           WHERE product_id = $1
             AND location_id = (SELECT id FROM locations WHERE kode = 'UTM')`,
          [item.product_id, item.jumlah_beli],
        );
        await client.query(
          `INSERT INTO stock_movements
             (product_id, location_id, qty_out, source_type, source_id, keterangan)
           VALUES (
             $1,
             (SELECT id FROM locations WHERE kode = 'UTM'),
             $2,
             'sale',
             $3,
             'Penjualan POS'
           )`,
          [item.product_id, item.jumlah_beli, savedTransaction.id],
        );
      }

      if (remainingAmount > 0) {
        await client.query(
          `INSERT INTO receivables
             (transaction_id, customer_id, total, paid_amount, remaining_amount, status)
           VALUES ($1, $2, $3, $4, $5, 'open')
           ON CONFLICT (transaction_id) DO UPDATE
           SET total = EXCLUDED.total,
               paid_amount = EXCLUDED.paid_amount,
               remaining_amount = EXCLUDED.remaining_amount,
               status = 'open'`,
          [
            savedTransaction.id,
            customerId,
            totalFinal,
            paidAmount,
            remainingAmount,
          ],
        );
      }

      return {
        ...transaction(savedTransaction),
        items,
      };
    });

    return created(result);
  } catch (error) {
    if (error instanceof ValidationError) return problem(error.message, 400);
    return serverError(error);
  }
}

function parseItems(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ValidationError("items wajib berisi minimal satu produk.");
  }

  return value.map((item) => {
    if (typeof item !== "object" || item == null) {
      throw new ValidationError("Format item transaksi tidak valid.");
    }
    const record = item as Record<string, unknown>;
    return {
      product_id: asInteger(record.product_id, "product_id", 1),
      jumlah_beli: asInteger(record.jumlah_beli, "jumlah_beli", 1),
    };
  });
}

async function findProductForUpdate(client: PoolClient, productId: number) {
  const result = await client.query<ProductForSale>(
    `SELECT id, nama_produk, harga, stok, category_id
     FROM products
     WHERE id = $1
     FOR UPDATE`,
    [productId],
  );
  return result.rows[0] ?? null;
}

async function findCustomerForUpdate(client: PoolClient, customerId: number) {
  const result = await client.query<CustomerForSale>(
    `SELECT id
     FROM customers
     WHERE id = $1
     FOR UPDATE`,
    [customerId],
  );
  return result.rows[0] ?? null;
}

async function findCustomerDiscounts(client: PoolClient, customerId: number) {
  const result = await client.query<{ category_id: number; rate: string }>(
    `SELECT category_id, rate
     FROM customer_group_discounts
     WHERE customer_id = $1`,
    [customerId],
  );
  return new Map(result.rows.map((row) => [row.category_id, Number(row.rate)]));
}
