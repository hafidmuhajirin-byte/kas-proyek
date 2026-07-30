import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { TransactionForm } from "@/components/TransactionForm";
import {
  btnSecondaryClass,
  Card,
  PageHeader,
} from "@/components/ui";
import { updateTransactionAction } from "@/lib/actions/transactions";
import { getGlobalCashBreakdown } from "@/lib/balance";
import { requireOwner } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function EditTransactionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOwner();
  const { id } = await params;

  const [transaction, rawProjects, sources, categories, stages] =
    await Promise.all([
      prisma.transaction.findUnique({ where: { id } }),
      prisma.project.findMany({
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          billingMode: true,
          contractValue: true,
          transactions: {
            where: { type: "INCOME", isOwnerPersonal: false },
            select: { id: true, amount: true },
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
    ]);

  if (!transaction) notFound();

  const projects = rawProjects.map((p) => ({
    id: p.id,
    name: p.name,
    billingMode: p.billingMode,
    contractValue: p.contractValue,
    paidIncome: p.transactions
      .filter((tx) => tx.id !== transaction.id)
      .reduce((sum, tx) => sum + tx.amount, 0),
    workCompletedValue: p.workItems.reduce((sum, item) => sum + item.amount, 0),
  }));

  const kasBesar = await getGlobalCashBreakdown({
    excludeTransactionId: transaction.id,
  });

  return (
    <div>
      <PageHeader
        title="Edit transaksi"
        description="Pembayaran klien dibatasi kontrak/pekerjaan. Setoran pribadi menambah kas besar (Tunai/Bank sesuai sumber)."
        actions={
          <Link href="/transactions" className={btnSecondaryClass}>
            Kembali
          </Link>
        }
      />

      <Card className="max-w-3xl">
        <TransactionForm
          action={updateTransactionAction}
          projects={projects}
          sources={sources}
          categories={categories}
          stages={stages}
          globalCashBalance={kasBesar.total}
          globalCashTunai={kasBesar.cash}
          globalCashBank={kasBesar.bank}
          defaults={{
            id: transaction.id,
            date: format(transaction.date, "yyyy-MM-dd"),
            type: transaction.type,
            amount: transaction.amount,
            description: transaction.description,
            projectId: transaction.projectId ?? undefined,
            cashSourceId: transaction.cashSourceId,
            categoryId: transaction.categoryId,
            fundingStageId: transaction.fundingStageId,
            isOwnerPersonal: transaction.isOwnerPersonal,
            isFromGlobalCash: transaction.isFromGlobalCash,
            proofUrl: transaction.proofUrl,
          }}
          submitLabel="Simpan perubahan"
        />
      </Card>
    </div>
  );
}
