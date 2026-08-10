import { prisma } from "@/lib/prisma";

/** Filter transaksi yang boleh masuk agregat kas besar Owner. */
export const kasBesarTransactionWhere: {
  OR: Array<
    | { projectId: null }
    | { project: { standaloneBookkeeping: false } }
  >;
} = {
  OR: [
    { projectId: null },
    { project: { standaloneBookkeeping: false } },
  ],
};

export async function isStandaloneProject(
  projectId: string | null | undefined,
): Promise<boolean> {
  if (!projectId) return false;
  const p = await prisma.project.findUnique({
    where: { id: projectId },
    select: { standaloneBookkeeping: true },
  });
  return Boolean(p?.standaloneBookkeeping);
}

export async function getStandaloneProjectIds(): Promise<string[]> {
  const rows = await prisma.project.findMany({
    where: { standaloneBookkeeping: true },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}
