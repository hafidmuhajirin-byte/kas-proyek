import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRoleAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tidyCase } from "@/lib/text";
import { formatRupiah } from "@/lib/money";
import { Card, PageHeader } from "@/components/ui";
import {
  aggregateLineTaxes,
  getTaxCeilingStatus,
} from "@/lib/lpj/tax-compliance";
import { TaxCeilingBar } from "@/components/lpj/TaxCeilingBar";

export default async function AdminLpjPajakPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  await requireRoleAdmin();
  const { projectId } = await params;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      contractValue: true,
      status: true,
    },
  });
  if (!project || project.status !== "ACTIVE") notFound();

  const expenses = await prisma.transaction.findMany({
    where: {
      projectId,
      type: "EXPENSE",
      isOwnerPersonal: false,
      isFeeTransfer: false,
      isMandorDisbursement: false,
    },
    select: {
      id: true,
      amount: true,
      description: true,
      isMaterialAlam: true,
      date: true,
    },
    orderBy: { date: "desc" },
    take: 300,
  });

  const { results, totalTax, totalPpn, totalPph } = aggregateLineTaxes(
    expenses.map((e) => ({
      amount: e.amount,
      description: e.description,
      isMaterialAlam: e.isMaterialAlam,
    })),
  );
  const ceiling = getTaxCeilingStatus(totalTax, project.contractValue);

  const rows = expenses.map((e, i) => ({
    ...e,
    tax: results[i],
  }));

  return (
    <div>
      <PageHeader
        title="Pajak"
        description={tidyCase(project.name)}
        actions={
          <Link
            href={`/admin/lpj/${project.id}`}
            className="rounded-lg border border-[var(--line-soft)] px-3 py-2 text-sm text-[var(--ink-muted)] hover:bg-[var(--paper-tint)]"
          >
            ← Menu proyek
          </Link>
        }
      />

      <TaxCeilingBar status={ceiling} />

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card className="!p-3">
          <p className="text-xs text-[var(--ink-muted)]">Total PPN</p>
          <p className="font-medium">{formatRupiah(totalPpn)}</p>
        </Card>
        <Card className="!p-3">
          <p className="text-xs text-[var(--ink-muted)]">Total PPh</p>
          <p className="font-medium">{formatRupiah(totalPph)}</p>
        </Card>
        <Card className="!p-3">
          <p className="text-xs text-[var(--ink-muted)]">Total pajak</p>
          <p className="font-medium">{formatRupiah(totalTax)}</p>
        </Card>
      </div>

      <Card className="mt-4">
        <h3 className="font-medium">Baris yang kena / mendekati ambang</h3>
        <ul className="mt-3 space-y-2 text-sm">
          {rows
            .filter((r) => r.tax.totalTax > 0 || r.tax.overThreshold)
            .slice(0, 40)
            .map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap justify-between gap-2 border-b border-[var(--line-soft)]/50 py-2"
              >
                <span className="min-w-0 flex-1">
                  {r.description || "—"}
                  {r.isMaterialAlam ? " (alam)" : ""}
                </span>
                <span className="text-[var(--ink-muted)]">
                  {formatRupiah(r.amount)} → {formatRupiah(r.tax.totalTax)}
                </span>
              </li>
            ))}
          {rows.every((r) => r.tax.totalTax === 0 && !r.tax.overThreshold) ? (
            <li className="text-[var(--ink-muted)]">
              Belum ada baris kena pajak dari data saat ini.
            </li>
          ) : null}
        </ul>
      </Card>
    </div>
  );
}
