import { endOfDay, format, parseISO, startOfDay } from "date-fns";
import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { cashSourceTypeLabels, categoryTypeLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

function buildCsv(rows: Array<Record<string, string | number>>) {
  if (rows.length === 0) return "Tidak ada data";
  const headers = Object.keys(rows[0]);
  const escape = (value: string | number) => {
    const text = String(value);
    if (text.includes(",") || text.includes('"') || text.includes("\n")) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h] ?? "")).join(",")),
  ].join("\n");
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const fromRaw = params.get("from");
  const toRaw = params.get("to");
  const from = fromRaw ? startOfDay(parseISO(fromRaw)) : undefined;
  const to = toRaw ? endOfDay(parseISO(toRaw)) : undefined;
  const type = params.get("type");

  const transactions = await prisma.transaction.findMany({
    where: {
      ...(params.get("projectId")
        ? { projectId: params.get("projectId")! }
        : {}),
      ...(params.get("cashSourceId")
        ? { cashSourceId: params.get("cashSourceId")! }
        : {}),
      ...(params.get("categoryId")
        ? { categoryId: params.get("categoryId")! }
        : {}),
      ...(type === "INCOME" || type === "EXPENSE" ? { type } : {}),
      ...(params.get("location")
        ? { project: { location: { contains: params.get("location")! } } }
        : {}),
      ...(from || to
        ? {
            date: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    include: {
      project: true,
      cashSource: true,
      category: true,
    },
  });

  const rows = transactions.map((tx) => ({
    Tanggal: format(tx.date, "yyyy-MM-dd"),
    Jenis: tx.type === "INCOME" ? "Pemasukan" : "Pengeluaran",
    PribadiOwner:
      tx.isOwnerPersonal
        ? tx.type === "INCOME"
          ? "Setoran"
          : "Ambil"
        : "Tidak",
    MasukKasBesar:
      tx.type === "EXPENSE" && tx.isFromGlobalCash ? "Ya" : "Tidak",
    Proyek: tx.project?.name ?? "Dana pribadi owner",
    Lokasi: tx.project?.location ?? "—",
    SumberKas: tx.cashSource.name,
    JenisSumber: cashSourceTypeLabels[tx.cashSource.type] ?? tx.cashSource.type,
    Kategori: tx.category.name,
    JenisKategori: categoryTypeLabels[tx.category.type] ?? tx.category.type,
    Nominal: tx.amount,
    Keterangan: tx.description,
  }));

  const csv = "\uFEFF" + buildCsv(rows);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="laporan-kas-proyek.csv"`,
    },
  });
}
