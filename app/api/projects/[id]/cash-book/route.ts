import { format } from "date-fns";
import { NextRequest } from "next/server";
import { assertProjectAccess, getSession } from "@/lib/auth";
import {
  buildCashBookRows,
  cashBookToCsv,
  cashBookToExcelXml,
} from "@/lib/project-cash-book";
import { prisma } from "@/lib/prisma";
import { tidyCase } from "@/lib/text";

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { id: projectId } = await ctx.params;
  const ok = await assertProjectAccess(session, projectId);
  if (!ok) return new Response("Forbidden", { status: 403 });

  const formatParam = (
    request.nextUrl.searchParams.get("format") ?? "xlsx"
  ).toLowerCase();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      location: true,
      openingBalance: true,
      transactions: {
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
        select: {
          date: true,
          type: true,
          amount: true,
          description: true,
          isMandorExpense: true,
          category: { select: { name: true } },
          cashSource: { select: { name: true, type: true } },
        },
      },
    },
  });

  if (!project) return new Response("Not found", { status: 404 });

  // Utamakan Kas Tunai; jika kosong, pakai semua transaksi proyek
  const cashOnly = project.transactions.filter(
    (tx) => tx.cashSource.type === "CASH",
  );
  const source = cashOnly.length > 0 ? cashOnly : project.transactions;

  const rows = buildCashBookRows(
    source.map((tx) => ({
      date: tx.date,
      description: tx.description,
      type: tx.type,
      amount: tx.amount,
      isMandorExpense: tx.isMandorExpense,
      categoryName: tx.category.name,
      cashSourceName: tx.cashSource.name,
    })),
    project.openingBalance,
  );

  const meta = {
    projectName: tidyCase(project.name),
    location: tidyCase(project.location),
  };
  const stamp = format(new Date(), "yyyyMMdd");
  const baseName = `buku-kas-tunai-${stamp}`;

  if (formatParam === "csv") {
    return new Response(cashBookToCsv(rows, meta), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${baseName}.csv"`,
      },
    });
  }

  // default xlsx/xls — SpreadsheetML
  return new Response(cashBookToExcelXml(rows, meta), {
    headers: {
      "Content-Type": "application/vnd.ms-excel; charset=utf-8",
      "Content-Disposition": `attachment; filename="${baseName}.xls"`,
    },
  });
}
