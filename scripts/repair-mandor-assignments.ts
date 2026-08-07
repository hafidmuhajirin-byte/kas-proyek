/**
 * Perbaiki penugasan Mandor yang hilang:
 * jika nama Pemborong cocok akun Mandor tapi belum ada ProjectAssignment,
 * buat penugasannya.
 *
 *   npx tsx scripts/repair-mandor-assignments.ts
 *   npx tsx scripts/repair-mandor-assignments.ts --dry-run
 */
import { findMandorByName } from "../lib/mandor-assign";
import { prisma } from "../lib/prisma";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const [contractors, mandors] = await Promise.all([
    prisma.contractor.findMany({
      select: {
        name: true,
        projectId: true,
        project: { select: { name: true } },
      },
    }),
    prisma.user.findMany({
      where: { role: "MANDOR" },
      select: { id: true, name: true, username: true },
    }),
  ]);

  let created = 0;
  let skipped = 0;
  let unmatched = 0;

  for (const c of contractors) {
    const match = findMandorByName(mandors, c.name);
    if (!match) {
      unmatched += 1;
      console.log(`? tidak cocok: "${c.name}" @ ${c.project.name}`);
      continue;
    }
    const existing = await prisma.projectAssignment.findUnique({
      where: {
        userId_projectId: {
          userId: match.id,
          projectId: c.projectId,
        },
      },
    });
    if (existing) {
      skipped += 1;
      continue;
    }
    console.log(
      `+ ${dryRun ? "[dry-run] " : ""}tugaskan ${match.username} → ${c.project.name}`,
    );
    if (!dryRun) {
      await prisma.projectAssignment.create({
        data: { userId: match.id, projectId: c.projectId },
      });
    }
    created += 1;
  }

  console.log(
    `\nSelesai: created=${created} skipped=${skipped} unmatched=${unmatched}${dryRun ? " (dry-run)" : ""}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
