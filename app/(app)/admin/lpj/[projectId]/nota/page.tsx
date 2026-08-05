import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { requireRoleAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tidyCase } from "@/lib/text";
import { formatRupiah } from "@/lib/money";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { computeVoucherTax } from "@/lib/lpj/tax-compliance";

export default async function AdminLpjNotaPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  await requireRoleAdmin();
  const { projectId } = await params;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, status: true },
  });
  if (!project || project.status !== "ACTIVE") notFound();

  const notas = await prisma.transaction.findMany({
    where: {
      projectId,
      isMandorExpense: true,
      type: "EXPENSE",
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 100,
    select: {
      id: true,
      date: true,
      amount: true,
      description: true,
      breakdownStatus: true,
      isMaterialAlam: true,
      proofUrl: true,
      category: { select: { name: true } },
      expenseLines: {
        select: {
          id: true,
          kind: true,
          description: true,
          amount: true,
          isMaterialAlam: true,
        },
      },
    },
  });

  return (
    <div>
      <PageHeader
        title="Review Nota Mandor"
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

      {notas.length === 0 ? (
        <EmptyState message="Belum ada nota Mandor untuk proyek ini." />
      ) : (
        <ul className="space-y-3">
          {notas.map((n) => {
            const tax = computeVoucherTax({
              amount: n.amount,
              description: n.description,
              categoryName: n.category.name,
              isMaterialAlam: n.isMaterialAlam,
              lines: n.expenseLines.map((l) => ({
                amount: l.amount,
                description: l.description,
                kind: l.kind,
                isMaterialAlam: l.isMaterialAlam,
              })),
            });
            return (
              <li key={n.id}>
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-[var(--ink)]">
                        {n.description || "Tanpa uraian"}
                      </p>
                      <p className="mt-1 text-sm text-[var(--ink-muted)]">
                        {format(n.date, "dd/MM/yyyy")} · {formatRupiah(n.amount)}{" "}
                        · Status: {n.breakdownStatus}
                        {n.isMaterialAlam ? " · Material alam" : ""}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="text-[var(--ink-muted)]">{tax.label}</p>
                      <p className="font-medium">
                        Pajak {formatRupiah(tax.totalTax)}
                      </p>
                      {tax.overThreshold && !n.isMaterialAlam ? (
                        <p className="mt-1 text-xs text-amber-800">
                          Nota &gt; Rp 2 jt — wajib hitung PPN/PPh kecuali material
                          alam
                        </p>
                      ) : null}
                    </div>
                  </div>
                  {n.expenseLines.length > 0 ? (
                    <ul className="mt-3 space-y-1 border-t border-[var(--line-soft)] pt-3 text-sm">
                      {n.expenseLines.map((l) => (
                        <li key={l.id} className="flex justify-between gap-2">
                          <span>
                            [{l.kind}] {l.description}
                            {l.isMaterialAlam ? " (alam)" : ""}
                          </span>
                          <span>{formatRupiah(l.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-[var(--ink-muted)]">
                      Belum dipecah bahan/upah. Pecah lewat halaman proyek (Owner)
                      atau perluas form Admin berikutnya.
                    </p>
                  )}
                  {n.proofUrl ? (
                    <p className="mt-2 text-xs">
                      <a
                        href={n.proofUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="underline"
                      >
                        Lihat bukti
                      </a>
                    </p>
                  ) : null}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
