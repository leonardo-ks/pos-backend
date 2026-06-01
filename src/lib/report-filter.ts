import type { NextRequest } from "next/server";

export function buildDateFilter(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const from = params.get("from");
  const to = params.get("to");
  const allowAll = params.get("allow_all") === "true";
  const values: string[] = [];
  const clauses: string[] = [];

  const effectiveFrom =
    from ??
    (allowAll
      ? null
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          .toISOString());

  if (effectiveFrom) {
    values.push(effectiveFrom);
    clauses.push(`t.created_at >= $${values.length}`);
  }

  if (to) {
    values.push(to);
    clauses.push(`t.created_at < $${values.length}`);
  }

  return {
    whereSql: clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "",
    values,
  };
}
