import ExcelJS from "exceljs";
import { PassThrough, Readable } from "node:stream";
import { type NextRequest, NextResponse } from "next/server";

import { requireManager } from "@/lib/auth";
import { problem, serverError } from "@/lib/http";
import { MAX_EXCEL_ROWS } from "@/lib/pagination";

type Params = {
  params: Promise<{ kind: string }>;
};

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await requireManager(request);
    if (auth.error) return problem(auth.error.message, auth.error.status);

    const { kind } = await params;
    const stream = streamReportWorkbook(request, kind);
    return new NextResponse(
      Readable.toWeb(stream) as ReadableStream<Uint8Array>,
      {
      headers: {
        "content-type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="laporan-${kind}.xlsx"`,
      },
      },
    );
  } catch (error) {
    return serverError(error);
  }
}

function streamReportWorkbook(request: NextRequest, kind: string) {
  const stream = new PassThrough();

  void writeReportWorkbook(request, kind, stream).catch((error: unknown) => {
    stream.destroy(error instanceof Error ? error : new Error(String(error)));
  });

  return stream;
}

async function writeReportWorkbook(
  request: NextRequest,
  kind: string,
  stream: PassThrough,
) {
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
    stream,
    useStyles: true,
  });
  workbook.creator = "POS Kasir";
  const sheet = workbook.addWorksheet("Laporan");
  let cursor: string | null = null;
  let columnsReady = false;
  let rowsWritten = 0;

  do {
    const page = await fetchReportPage(request, kind, cursor);
    if (!columnsReady) {
      const keys = Object.keys(page.rows[0] ?? { info: "Tidak ada data" });
      sheet.columns = keys.map((key) => ({
        header: key.replaceAll("_", " ").toUpperCase(),
        key,
        width: 22,
      }));
      sheet.getRow(1).font = { bold: true };
      sheet.getRow(1).commit();
      columnsReady = true;
      if (page.rows.length === 0) {
        sheet.addRow({ info: "Tidak ada data" }).commit();
      }
    }

    for (const row of page.rows) {
      rowsWritten += 1;
      if (rowsWritten > MAX_EXCEL_ROWS) {
        throw new Error("Laporan melebihi batas baris Excel. Persempit filter.");
      }
      sheet.addRow(sanitizeRow(row)).commit();
    }
    cursor = page.nextCursor;
  } while (cursor);

  await workbook.commit();
}

async function fetchReportPage(
  request: NextRequest,
  kind: string,
  cursor: string | null,
) {
  const url = new URL(request.url);
  url.pathname = `/api/reports/${kind}`;
  url.searchParams.set("limit", "200");
  if (cursor) url.searchParams.set("cursor", cursor);
  const response = await fetch(url, {
    headers: { authorization: request.headers.get("authorization") ?? "" },
  });
  const payload = (await response.json()) as {
    data?: {
      rows?: Record<string, unknown>[];
      next_cursor?: string | null;
    };
    error?: unknown;
  };
  if (!response.ok) {
    throw new Error("Gagal membuat laporan Excel.");
  }
  return {
    rows: payload.data?.rows ?? [],
    nextCursor: payload.data?.next_cursor ?? null,
  };
}

function sanitizeRow(row: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      typeof value === "object" && value !== null
        ? JSON.stringify(value)
        : value,
    ]),
  );
}
