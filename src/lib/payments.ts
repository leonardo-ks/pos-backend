import { type NextRequest } from "next/server";

import { requireManager } from "./auth";
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

type PaymentConfig = {
  sourceTable: "payables" | "receivables";
  paymentTable: "payable_payments" | "receivable_payments";
  fk: "payable_id" | "receivable_id";
};

export const payablePaymentConfig: PaymentConfig = {
  sourceTable: "payables",
  paymentTable: "payable_payments",
  fk: "payable_id",
};

export const receivablePaymentConfig: PaymentConfig = {
  sourceTable: "receivables",
  paymentTable: "receivable_payments",
  fk: "receivable_id",
};

export function listPayments(config: PaymentConfig) {
  return async function GET(request: NextRequest) {
    try {
      const auth = await requireManager(request);
      if (auth.error) return problem(auth.error.message, auth.error.status);

      const limit = pageLimit(request);
      const values: unknown[] = [];
      const cursorWhere = dateCursorClause(request, values, "p");
      const result = await query(
        `SELECT p.*
         FROM ${config.paymentTable} p
         ${cursorWhere ? `WHERE ${cursorWhere}` : ""}
         ORDER BY p.created_at DESC, p.id DESC
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

export function createPayment(config: PaymentConfig) {
  return async function POST(request: NextRequest) {
    try {
      const auth = await requireManager(request);
      if (auth.error || !auth.user) {
        return problem(
          auth.error?.message ?? "Login diperlukan.",
          auth.error?.status ?? 401,
        );
      }

      const body = (await request.json()) as Record<string, unknown>;
      const sourceId = asInteger(body[config.fk], config.fk, 1);
      const amount = asNumber(body.amount, "amount", 1);
      const keterangan = asOptionalString(body.keterangan) ?? "";

      const saved = await withTransaction(async (client) => {
        const source = await client.query<{ remaining_amount: string }>(
          `SELECT remaining_amount FROM ${config.sourceTable} WHERE id = $1 FOR UPDATE`,
          [sourceId],
        );
        const remaining = Number(source.rows[0]?.remaining_amount ?? 0);
        if (remaining <= 0) throw new ValidationError("Tagihan sudah lunas.");
        if (amount > remaining)
          throw new ValidationError("Jumlah bayar melebihi sisa tagihan.");

        const result = await client.query(
          `INSERT INTO ${config.paymentTable}
             (${config.fk}, user_id, amount, keterangan)
           VALUES ($1, $2, $3, $4)
           RETURNING *`,
          [sourceId, auth.user!.id, amount, keterangan],
        );
        await client.query(
          `UPDATE ${config.sourceTable}
           SET paid_amount = paid_amount + $2,
               remaining_amount = remaining_amount - $2,
               status = CASE WHEN remaining_amount - $2 <= 0 THEN 'paid' ELSE 'open' END
           WHERE id = $1`,
          [sourceId, amount],
        );
        return result.rows[0] as Record<string, unknown>;
      });

      return created(normalizeRow(saved));
    } catch (error) {
      if (error instanceof ValidationError) return problem(error.message, 400);
      return serverError(error);
    }
  };
}
