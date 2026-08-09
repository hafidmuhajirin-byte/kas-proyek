import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRoleAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatRupiah } from "@/lib/money";
import { Card, PageHeader } from "@/components/ui";
import {
  buildSpkRingkasanTable,
  computeSpkTargets,
  defaultLaborMaterialPercent,
  emptySpkBudgetFromContract,
  SPK_CATEGORIES,
  SPK_CATEGORY_LABELS,
  type SpkCategoryKey,
} from "@/lib/lpj/smart-estimator";
import { upsertSpkBudgetAction } from "@/lib/actions/lpj-spk";
import { SpkRingkasanTableView } from "@/components/lpj/SpkRingkasanTable";

export default async function AdminLpjSpkPage({
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
      spkBudgetLines: true,
    },
  });
  if (!project || project.status !== "ACTIVE") notFound();

  const hasSaved = project.spkBudgetLines.length > 0;
  const existing = new Map(
    project.spkBudgetLines.map((l) => [l.category as SpkCategoryKey, l]),
  );
  const inputs = hasSaved
    ? SPK_CATEGORIES.map((category) => {
        const saved = existing.get(category);
        const defaults = defaultLaborMaterialPercent(category);
        return {
          category,
          amount: saved?.amount ?? 0,
          laborPercent: saved?.laborPercent ?? defaults.laborPercent,
          materialPercent: saved?.materialPercent ?? defaults.materialPercent,
          isBeliBaru: saved?.isBeliBaru ?? false,
        };
      })
    : emptySpkBudgetFromContract(project.contractValue);

  const targets = computeSpkTargets(inputs);
  const allocated = targets.totalAmount;
  const remaining = Math.max(0, project.contractValue - allocated);
  const ringkasan = hasSaved
    ? buildSpkRingkasanTable(targets.lines, project.contractValue)
    : null;

  return (
    <div>
      <PageHeader
        title="Ringkasan SPK"
        description={project.name.trim().toUpperCase()}
        actions={
          <Link
            href={`/admin/lpj/${project.id}`}
            className="rounded-lg border border-[var(--line-soft)] px-3 py-2 text-sm text-[var(--ink-muted)] hover:bg-[var(--paper-tint)]"
          >
            ← Menu proyek
          </Link>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="!p-3">
          <p className="text-xs text-[var(--ink-muted)]">Nilai SPK</p>
          <p className="font-medium">{formatRupiah(project.contractValue)}</p>
        </Card>
        <Card className="!p-3">
          <p className="text-xs text-[var(--ink-muted)]">Sudah dialokasi</p>
          <p className="font-medium">{formatRupiah(allocated)}</p>
        </Card>
        <Card className="!p-3">
          <p className="text-xs text-[var(--ink-muted)]">Sisa pagu</p>
          <p className="font-medium">{formatRupiah(remaining)}</p>
        </Card>
        <Card className="!p-3">
          <p className="text-xs text-[var(--ink-muted)]">Target upah / material</p>
          <p className="text-sm font-medium">
            {formatRupiah(targets.totalLaborTarget)} /{" "}
            {formatRupiah(targets.totalMaterialTarget)}
          </p>
        </Card>
      </div>

      {ringkasan ? (
        <div className="mb-6">
          <SpkRingkasanTableView
            table={ringkasan}
            projectName={project.name}
            contractValue={project.contractValue}
          />
        </div>
      ) : null}

      <details className="group" open={!hasSaved}>
        <summary className="mb-3 cursor-pointer list-none text-sm font-medium text-[var(--accent)] underline marker:content-none [&::-webkit-details-marker]:hidden">
          {hasSaved ? "Ubah pagu SPK" : "Isi pagu SPK"}
        </summary>

        <form action={upsertSpkBudgetAction} className="space-y-3">
          <input type="hidden" name="projectId" value={project.id} />
          {inputs.map((line) => {
            const saved = existing.get(line.category);
            return (
              <Card key={line.category} className="!p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-medium text-[var(--ink)]">
                    {SPK_CATEGORY_LABELS[line.category]}
                  </h3>
                  <span className="text-xs text-[var(--ink-muted)]">
                    Default upah {line.laborPercent}% / material{" "}
                    {line.materialPercent}%
                  </span>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-4">
                  <label className="block text-sm">
                    <span className="text-[var(--ink-muted)]">Pagu (Rp)</span>
                    <input
                      type="number"
                      name={`amount__${line.category}`}
                      defaultValue={saved?.amount ?? line.amount}
                      min={0}
                      className="mt-1 w-full rounded-lg border border-[var(--line-soft)] px-3 py-2"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-[var(--ink-muted)]">% Upah</span>
                    <input
                      type="number"
                      name={`labor__${line.category}`}
                      defaultValue={saved?.laborPercent ?? line.laborPercent}
                      min={0}
                      max={100}
                      className="mt-1 w-full rounded-lg border border-[var(--line-soft)] px-3 py-2"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-[var(--ink-muted)]">% Material</span>
                    <input
                      type="number"
                      name={`material__${line.category}`}
                      defaultValue={
                        saved?.materialPercent ?? line.materialPercent
                      }
                      min={0}
                      max={100}
                      className="mt-1 w-full rounded-lg border border-[var(--line-soft)] px-3 py-2"
                    />
                  </label>
                  {line.category === "REHAB_MEBELAIR" ? (
                    <label className="flex items-end gap-2 pb-2 text-sm">
                      <input
                        type="checkbox"
                        name={`beliBaru__${line.category}`}
                        defaultChecked={saved?.isBeliBaru ?? false}
                        value="1"
                      />
                      <span>Beli baru (50/50)</span>
                    </label>
                  ) : (
                    <div />
                  )}
                </div>
              </Card>
            );
          })}
          <button
            type="submit"
            className="rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white"
          >
            Simpan pagu SPK
          </button>
        </form>
      </details>
    </div>
  );
}
