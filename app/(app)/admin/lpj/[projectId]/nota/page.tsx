import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRoleAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeVoucherTax } from "@/lib/lpj/tax-compliance";
import {
  AdminMandorNotaReview,
  type AdminNotaGroup,
} from "@/components/admin/AdminMandorNotaReview";
import { AdminAddLpjNotaForm } from "@/components/admin/AdminAddLpjNotaForm";
import { EmptyState, PageHeader } from "@/components/ui";

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

  const [notas, workers, categories] = await Promise.all([
    prisma.transaction.findMany({
    where: {
      projectId,
      isMandorExpense: true,
      type: "EXPENSE",
      splitParentId: null,
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 100,
    select: {
      id: true,
      date: true,
      amount: true,
      description: true,
      proofUrl: true,
      breakdownStatus: true,
      breakdownNote: true,
      breakdownVendor: true,
      isMaterialAlam: true,
      isAdminLpjNota: true,
      isSplitParent: true,
      laborPeriodStart: true,
      laborPeriodEnd: true,
      laborWeekIndex: true,
      createdBy: { select: { name: true } },
      category: { select: { name: true } },
      expenseLines: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          kind: true,
          description: true,
          laborRole: true,
          quantity: true,
          unit: true,
          unitPrice: true,
          workDays: true,
          dailyRate: true,
          amount: true,
          isMaterialAlam: true,
        },
      },
      splitChildren: {
        orderBy: { splitIndex: "asc" },
        select: {
          id: true,
          amount: true,
          description: true,
          splitIndex: true,
          breakdownStatus: true,
          breakdownNote: true,
          breakdownVendor: true,
          laborPeriodStart: true,
          laborPeriodEnd: true,
          laborWeekIndex: true,
          expenseLines: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              kind: true,
              description: true,
              laborRole: true,
              quantity: true,
              unit: true,
              unitPrice: true,
              workDays: true,
              dailyRate: true,
              amount: true,
            },
          },
        },
      },
    },
  }),
    prisma.worker.findMany({
      where: { projectId, active: true },
      orderBy: { name: "asc" },
      select: { name: true, role: true, dailyWage: true },
    }),
    prisma.category.findMany({
      where: { type: "EXPENSE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const knownWorkers = workers.map((w) => ({
    name: w.name,
    role: w.role,
    dailyWage: w.dailyWage,
  }));

  const groups: AdminNotaGroup[] = notas.map((n) => {
    type LineIn = {
      id: string;
      kind: string;
      description: string;
      laborRole: string | null;
      quantity: number | null;
      unit: string | null;
      unitPrice: number | null;
      workDays: number | null;
      dailyRate: number | null;
      amount: number;
    };
    const mapLine = (l: LineIn) => ({
      id: l.id,
      kind: l.kind as "MATERIAL" | "LABOR",
      description: l.description,
      laborRole: l.laborRole,
      quantity: l.quantity,
      unit: l.unit,
      unitPrice: l.unitPrice,
      workDays: l.workDays,
      dailyRate: l.dailyRate,
      amount: l.amount,
    });

    const isSplit = n.isSplitParent && n.splitChildren.length > 0;
    const bkks = isSplit
      ? n.splitChildren.map((c) => ({
          id: c.id,
          splitIndex: c.splitIndex,
          amount: c.amount,
          description: c.description,
          vendor: c.breakdownVendor,
          breakdownStatus: c.breakdownStatus,
          breakdownNote: c.breakdownNote,
          laborPeriodStart: c.laborPeriodStart,
          laborPeriodEnd: c.laborPeriodEnd,
          laborWeekIndex: c.laborWeekIndex,
          lines: c.expenseLines.map(mapLine),
        }))
      : [
          {
            id: n.id,
            splitIndex: null as number | null,
            amount: n.amount,
            description: n.description,
            vendor: n.breakdownVendor,
            breakdownStatus: n.breakdownStatus,
            breakdownNote: n.breakdownNote,
            laborPeriodStart: n.laborPeriodStart,
            laborPeriodEnd: n.laborPeriodEnd,
            laborWeekIndex: n.laborWeekIndex,
            lines: n.expenseLines.map(mapLine),
          },
        ];

    // Pajak: agregat dari BKK yang tampil di LPJ
    let taxAmount = 0;
    let taxLabel = "Belum dihitung";
    let overThreshold = n.amount > 2_000_000 && !n.isMaterialAlam;
    for (const b of bkks) {
      const tax = computeVoucherTax({
        amount: b.amount,
        description: b.description,
        categoryName: n.category.name,
        isMaterialAlam: n.isMaterialAlam,
        isMandorExpense: true,
        breakdownStatus: b.breakdownStatus,
        lines: b.lines.map((l) => ({
          amount: l.amount,
          description: l.description,
          kind: l.kind,
        })),
      });
      taxAmount += tax.totalTax;
      taxLabel = tax.label;
      if (tax.overThreshold) overThreshold = true;
    }

    return {
      parentId: n.id,
      date: n.date,
      mandorTotal: n.amount,
      description: n.description,
      proofUrl: n.proofUrl,
      mandorName: n.createdBy.name,
      isAdminLpjNota: n.isAdminLpjNota,
      isSplit,
      parentStatus: n.breakdownStatus,
      parentNote: n.breakdownNote,
      bkks,
      taxLabel,
      taxAmount,
      overThreshold,
    };
  });

  return (
    <div>
      <PageHeader
        title="Review Nota Mandor"
        description={`${project.name.trim().toUpperCase()} · Pecah isi dulu, Split Nota opsional jika > Rp 2 jt`}
        actions={
          <Link
            href={`/admin/lpj/${project.id}`}
            className="rounded-lg border border-[var(--line-soft)] px-3 py-2 text-sm text-[var(--ink-muted)] hover:bg-[var(--paper-tint)]"
          >
            ← Menu proyek
          </Link>
        }
      />

      <AdminAddLpjNotaForm projectId={project.id} categories={categories} />

      {groups.length === 0 ? (
        <EmptyState message="Belum ada nota Mandor / Admin LPJ untuk proyek ini." />
      ) : (
        <AdminMandorNotaReview groups={groups} knownWorkers={knownWorkers} />
      )}
    </div>
  );
}
