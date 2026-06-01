import { type NextRequest } from "next/server";

import { ok } from "./http";

export const DEFAULT_PAGE_LIMIT = 50;
export const MAX_PAGE_LIMIT = 200;
export const MAX_EXCEL_ROWS = 1_048_576;

export type Cursor = Record<string, unknown>;

export function pageLimit(request: NextRequest, fallback = DEFAULT_PAGE_LIMIT) {
  const raw = Number(request.nextUrl.searchParams.get("limit") ?? fallback);
  if (!Number.isFinite(raw) || raw <= 0) return fallback;
  return Math.min(Math.trunc(raw), MAX_PAGE_LIMIT);
}

export function readCursor(request: NextRequest): Cursor | null {
  const raw = request.nextUrl.searchParams.get("cursor");
  if (!raw) return null;
  try {
    return JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Cursor;
  } catch {
    return null;
  }
}

export function encodeCursor(cursor: Cursor | null) {
  if (!cursor) return null;
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

export function paginated<T>(
  rows: T[],
  limit: number,
  cursorFor: (row: T) => Cursor,
) {
  const visibleRows = rows.slice(0, limit);
  const hasMore = rows.length > limit;
  return ok({
    rows: visibleRows,
    next_cursor:
      hasMore && visibleRows.length > 0
        ? encodeCursor(cursorFor(visibleRows[visibleRows.length - 1]))
        : null,
    limit,
    has_more: hasMore,
  });
}

export function dateCursorClause(
  request: NextRequest,
  values: unknown[],
  alias: string,
  column = "created_at",
) {
  const cursor = readCursor(request);
  if (!cursor?.created_at || !cursor?.id) return "";
  values.push(cursor.created_at, cursor.id);
  return `(${alias}.${column} < $${values.length - 1} OR (${alias}.${column} = $${values.length - 1} AND ${alias}.id < $${values.length}))`;
}

export function textCursorClause(
  request: NextRequest,
  values: unknown[],
  column: string,
  idColumn: string,
) {
  const cursor = readCursor(request);
  if (typeof cursor?.sort !== "string" || !cursor?.id) return "";
  values.push(cursor.sort, cursor.id);
  return `(LOWER(${column}) > LOWER($${values.length - 1}) OR (LOWER(${column}) = LOWER($${values.length - 1}) AND ${idColumn} > $${values.length}))`;
}
