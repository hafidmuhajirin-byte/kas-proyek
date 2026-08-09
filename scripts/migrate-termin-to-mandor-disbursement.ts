/**
 * Migrasi Termin pemborong (ContractorAdvance) → Dana ke Mandor
 * (MandorDisbursement + Transaction isMandorDisbursement).
 *
 * Jalankan: npx tsx --env-file=.env scripts/migrate-termin-to-mandor-disbursement.ts
 *
 * Idempotent: skip advance yang sudah tidak ada / sudah pernah dimigrasikan
 * (deteksi: tidak ada advance tersisa setelah sukses).
 */
import { prisma } from "../lib/prisma";
import { namesMatch } from "../lib/mandor-fund-math";

async function resolveMandorId(
  projectId: string,
  contractorName: string,
): Promise<string | null> {
  const assignments = await prisma.projectAssignment.findMany({
    where: { projectId, user: { role: "MANDOR" } },
    orderBy: { createdAt: "asc" },
    select: { userId: true, user: { select: { name: true } } },
  });
  if (assignments.length === 0) return null;
  const matched = assignments.find((a) =>
    namesMatch(a.user.name, contractorName),
  );
  return matched?.userId ?? assignments[0].userId;
}

async function main() {
  const category = await prisma.category.findFirst({
    where: { name: "Pencairan ke Mandor", type: "EXPENSE" },
  });
  if (!category) {
    throw new Error("Kategori 'Pencairan ke Mandor' belum ada.");
  }

  const owner = await prisma.user.findFirst({
    where: { role: "OWNER" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!owner) throw new Error("User OWNER tidak ditemukan.");

  const advances = await prisma.contractorAdvance.findMany({
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    include: {
      contractor: {
        select: {
          id: true,
          name: true,
          projectId: true,
          project: { select: { name: true } },
        },
      },
      cashSource: { select: { id: true, name: true } },
    },
  });

  console.log(`Ditemukan ${advances.length} termin untuk dimigrasi.`);

  let migrated = 0;
  for (const adv of advances) {
    const projectId = adv.contractor.projectId;
    const projectName = adv.contractor.project.name;
    const mandorId = await resolveMandorId(projectId, adv.contractor.name);
    if (!mandorId) {
      console.warn(
        `SKIP ${projectName} / ${adv.description}: belum ada Mandor ditugaskan.`,
      );
      continue;
    }

    const mandor = await prisma.user.findUnique({
      where: { id: mandorId },
      select: { name: true },
    });

    const last = await prisma.mandorDisbursement.findFirst({
      where: { projectId, mandorId },
      orderBy: { sequence: "desc" },
      select: { sequence: true },
    });
    const sequence = (last?.sequence ?? 0) + 1;
    const label = adv.description.trim() || `Termin ${sequence}`;

    await prisma.$transaction(async (db) => {
      const tx = await db.transaction.create({
        data: {
          date: adv.date,
          type: "EXPENSE",
          amount: adv.amount,
          description:
            adv.description.trim() ||
            `Pencairan ${label} ke ${mandor?.name ?? "Mandor"}`,
          proofUrl: adv.proofUrl,
          projectId,
          cashSourceId: adv.cashSourceId,
          categoryId: category.id,
          createdById: owner.id,
          isFromGlobalCash: adv.fromGlobalAmount > 0,
          isMandorDisbursement: true,
        },
      });

      const d = await db.mandorDisbursement.create({
        data: {
          date: adv.date,
          label,
          sequence,
          amount: adv.amount,
          description: adv.description,
          proofUrl: adv.proofUrl,
          projectId,
          mandorId,
          cashSourceId: adv.cashSourceId,
          transactionId: tx.id,
        },
      });

      await db.transaction.updateMany({
        where: { linkedContractorAdvanceId: adv.id },
        data: {
          linkedContractorAdvanceId: null,
          linkedMandorDisbursementId: d.id,
        },
      });

      await db.contractorAdvance.delete({ where: { id: adv.id } });

      console.log(
        `OK ${projectName}: ${label} ${adv.amount} → DMR ${d.id} (bukti dipindah)`,
      );
    });

    migrated += 1;
  }

  const left = await prisma.contractorAdvance.count();
  console.log(`Selesai. Dimigrasi: ${migrated}. Sisa termin: ${left}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
