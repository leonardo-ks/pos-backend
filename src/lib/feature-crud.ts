import { type NextRequest } from "next/server";

import { requireManager, requireUser } from "./auth";
import { query } from "./db";
import { created, ok, problem, serverError } from "./http";
import { pageLimit, paginated, textCursorClause } from "./pagination";
import {
  asInteger,
  asNumber,
  asOptionalString,
  asString,
  ValidationError,
} from "./validation";

type FieldType = "string" | "optionalString" | "integer" | "number";

type ResourceConfig = {
  table: string;
  fields: Record<string, FieldType>;
  searchFields: string[];
  orderBy?: string;
  managerOnlyWrite?: boolean;
};

export const resources = {
  suppliers: {
    table: "suppliers",
    fields: {
      kode: "string",
      nama: "string",
      alamat: "optionalString",
      telepon: "optionalString",
      keterangan: "optionalString",
    },
    searchFields: ["kode", "nama", "telepon"],
    orderBy: "nama",
  },
  locations: {
    table: "locations",
    fields: {
      kode: "string",
      nama: "string",
      keterangan: "optionalString",
    },
    searchFields: ["kode", "nama"],
    orderBy: "nama",
  },
  productCategories: {
    table: "product_categories",
    fields: {
      kode: "string",
      nama: "string",
      keterangan: "optionalString",
    },
    searchFields: ["kode", "nama"],
    orderBy: "nama",
  },
  discountCategories: {
    table: "discount_categories",
    fields: {
      kode: "string",
      nama: "string",
      rate: "number",
      keterangan: "optionalString",
    },
    searchFields: ["kode", "nama"],
    orderBy: "rate",
  },
} satisfies Record<string, ResourceConfig>;

export function listResource(config: ResourceConfig) {
  return async function GET(request: NextRequest) {
    try {
      const auth = await requireUser(request);
      if (auth.error) return problem(auth.error.message, auth.error.status);

      const search = request.nextUrl.searchParams.get("q")?.trim();
      const limit = pageLimit(request);
      const values: unknown[] = [];
      const searchWhere = search
        ? `(${config.searchFields.map((field) => `${field} ILIKE $1`).join(" OR ")})`
        : "";
      if (search) values.push(`%${search}%`);
      const cursorField = config.orderBy === "rate" ? "id" : (config.orderBy ?? "id");
      const cursorWhere =
        cursorField === "id"
          ? ""
          : textCursorClause(request, values, cursorField, "id");
      const clauses = ["deleted_at IS NULL", searchWhere, cursorWhere].filter(
        Boolean,
      );
      const where = `WHERE ${clauses.join(" AND ")}`;
      const result = await query(
        `SELECT * FROM ${config.table} ${where}
         ORDER BY ${cursorField === "id" ? "id" : `LOWER(${cursorField}), id`}
         LIMIT ${limit + 1}`,
        values,
      );
      const rows = result.rows.map(normalizeRow);
      return paginated(rows, limit, (row) => ({
        sort: row[cursorField]?.toString() ?? "",
        id: row.id,
      }));
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        return problem("Data masih digunakan dan tidak dapat dihapus.", 409);
      }
      return serverError(error);
    }
  };
}

export function createResource(config: ResourceConfig) {
  return async function POST(request: NextRequest) {
    try {
      const auth = await requireManager(request);
      if (auth.error) return problem(auth.error.message, auth.error.status);

      const body = (await request.json()) as Record<string, unknown>;
      const parsed = parseFields(body, config.fields);
      const names = Object.keys(parsed);
      const values = Object.values(parsed);
      const reactivateField =
        "nama" in parsed ? "nama" : "kode" in parsed ? "kode" : "";
      if (reactivateField) {
        const existing = await query(
          `SELECT id FROM ${config.table}
           WHERE LOWER(${reactivateField}) = LOWER($1::TEXT)
             AND deleted_at IS NOT NULL
           LIMIT 1`,
          [parsed[reactivateField]],
        );
        if (existing.rows[0]) {
          const sets = names.map((name, index) => `${name} = $${index + 1}`);
          const result = await query(
            `UPDATE ${config.table}
             SET ${sets.join(", ")}, deleted_at = NULL, updated_at = NOW()
             WHERE id = $${names.length + 1}
             RETURNING *`,
            [...values, existing.rows[0].id],
          );
          return created(normalizeRow(result.rows[0]));
        }
      }
      const placeholders = names.map((_, index) => `$${index + 1}`);
      const result = await query(
        `INSERT INTO ${config.table} (${names.join(", ")})
         VALUES (${placeholders.join(", ")})
         RETURNING *`,
        values,
      );
      return created(normalizeRow(result.rows[0]));
    } catch (error) {
      if (error instanceof ValidationError) return problem(error.message, 400);
      return serverError(error);
    }
  };
}

export function updateResource(config: ResourceConfig) {
  return async function PATCH(
    request: NextRequest,
    context: { params: Promise<{ id: string }> },
  ) {
    try {
      const auth = await requireManager(request);
      if (auth.error) return problem(auth.error.message, auth.error.status);

      const { id } = await context.params;
      const body = (await request.json()) as Record<string, unknown>;
      const parsed = parseFields(body, config.fields);
      const names = Object.keys(parsed);
      const values = Object.values(parsed);
      const sets = names.map((name, index) => `${name} = $${index + 1}`);
      const result = await query(
        `UPDATE ${config.table}
         SET ${sets.join(", ")}, updated_at = NOW()
         WHERE id = $${names.length + 1}
         RETURNING *`,
        [...values, Number(id)],
      );
      if (!result.rows[0]) return problem("Data tidak ditemukan.", 404);
      return ok(normalizeRow(result.rows[0]));
    } catch (error) {
      if (error instanceof ValidationError) return problem(error.message, 400);
      return serverError(error);
    }
  };
}

export function deleteResource(config: ResourceConfig) {
  return async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ id: string }> },
  ) {
    try {
      const auth = await requireManager(request);
      if (auth.error) return problem(auth.error.message, auth.error.status);

      const { id } = await context.params;
      const result = await query(
        `UPDATE ${config.table}
         SET deleted_at = NOW(), updated_at = NOW()
         WHERE id = $1
         RETURNING id`,
        [Number(id)],
      );
      if (!result.rows[0]) return problem("Data tidak ditemukan.", 404);
      return ok({ id: Number(id) });
    } catch (error) {
      return serverError(error);
    }
  };
}

function parseFields(
  body: Record<string, unknown>,
  fields: Record<string, FieldType>,
) {
  return Object.fromEntries(
    Object.entries(fields).map(([name, type]) => {
      const value = body[name];
      const parsed = (() => {
        switch (type) {
          case "string":
            return asString(value, name);
          case "optionalString":
            return asOptionalString(value) ?? "";
          case "integer":
            return asInteger(value ?? 0, name, 0);
          case "number":
            return asNumber(value ?? 0, name, 0);
        }
      })();
      return [name, parsed];
    }),
  );
}

export function normalizeRow(row: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      typeof value === "string" &&
      /^-?\d+(\.\d+)?$/.test(value) &&
      key.match(/amount|total|price|harga|paid|remaining/)
        ? Number(value)
        : value instanceof Date
          ? value.toISOString()
          : value,
    ]),
  );
}

export function isForeignKeyViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23503"
  );
}
