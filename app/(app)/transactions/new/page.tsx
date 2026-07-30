import Link from "next/link";
import { format } from "date-fns";
import { TransactionForm } from "@/components/TransactionForm";
import {
  btnSecondaryClass,
  Card,
  PageHeader,
} from "@/components/ui";
import { createTransactionAction } from "@/lib/actions/transactions";
import { getGlobalCashBreakdown } from "@/lib/balance";
import { requireSession } from "@/lib/auth";
import { ensureRequiredCategories } from "@/lib/ensure-categories";
import { SCHOOL_RESIDUAL_CATEGORY } from "@/lib/project-completion";
import { prisma } from "@/lib/prisma";

export default async function NewTransactionPage({
  searchParams,
}: {
  searchParams: Promise<{
    projectId?: string;
    type?: string;
    ownerPersonal?: string;
    schoolResidual?: string;
  }>;
}) {
  await requireSession();
  const params = await searchParams;

  await ensureRequiredCategories();

  const [rawProjects, sources, categories, stages, kasBesar] =
    await Promise.all([
      prisma.project.findMany({
        where: { status: "ACTIVE" },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          billingMode: true,
          contractValue: true,
          transactions: {
            where: { type: "INCOME", isOwnerPersonal: false },
            select: { amount: true },
          },
          workItems: {
            select: { amount: true },
          },
        },
      }),
      prisma.cashSource.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.category.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, type: true },
      }),
      prisma.fundingStage.findMany({
        orderBy: [{ sequence: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          name: true,
          projectId: true,
          percent: true,
          plannedAmount: true,
        },
      }),
      getGlobalCashBreakdown(),
    ]);

  const projects = rawProjects.map((p) => ({
    id: p.id,
    name: p.name,
    billingMode: p.billingMode,
    contractValue: p.contractValue,
    paidIncome: p.transactions.reduce((sum, tx) => sum + tx.amount, 0),
    workCompletedValue: p.workItems.reduce((sum, item) => sum + item.amount, 0),
  }));

  const defaultType =
    params.type === "INCOME" || params.type === "EXPENSE"
      ? params.type
      : params.ownerPersonal === "1" || params.schoolResidual === "1"
        ? "EXPENSE"
        : "EXPENSE";

  const schoolCategory = categories.find(
    (c) => c.type === "EXPENSE" && c.name === SCHOOL_RESIDUAL_CATEGORY,
  );
  const ownerCategory = categories.find(
    (c) =>
      c.type === "EXPENSE" &&
      c.name.toLowerCase().includes("pengambilan owner"),
  );

  const isOwnerPersonal = params.ownerPersonal === "1";
  const isSchoolResidual = params.schoolResidual === "1";

  return (
    <div>
      <PageHeader
        title="Transaksi baru"
        description="Pilih sumber Tunai atau Bank. Kas besar terpisah per saluran."
        actions={
          <Link href="/transactions" className={btnSecondaryClass}>
            Kembali
          </Link>
        }
      />

      <Card className="max-w-3xl">
        {sources.length === 0 ||
        categories.length === 0 ||
        (!isOwnerPersonal && projects.length === 0) ? (
          <p className="text-sm text-teal-900/65">
            Pastikan sudah ada{" "}
            {isOwnerPersonal ? "sumber kas dan kategori" : "proyek aktif, sumber kas, dan kategori"}{" "}
            sebelum mencatat transaksi.
          </p>
        ) : (
          <TransactionForm
            action={createTransactionAction}
            projects={projects}
            sources={sources}
            categories={categories}
            stages={stages}
            globalCashBalance={kasBesar.total}
            globalCashTunai={kasBesar.cash}
            globalCashBank={kasBesar.bank}
            defaults={{
              date: format(new Date(), "yyyy-MM-dd"),
              type: defaultType,
              projectId: isOwnerPersonal ? undefined : params.projectId,
              isOwnerPersonal,
              categoryId: isSchoolResidual
                ? schoolCategory?.id
                : isOwnerPersonal
                  ? ownerCategory?.id
                  : undefined,
              description: isSchoolResidual
                ? "Sisa dana proyek untuk sekolah"
                : isOwnerPersonal
                  ? "Ambil pribadi owner"
                  : undefined,
            }}
            submitLabel="Simpan transaksi"
          />
        )}
      </Card>
    </div>
  );
}
