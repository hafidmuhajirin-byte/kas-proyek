import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { requireRoleAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tidyCase } from "@/lib/text";
import { formatRupiah } from "@/lib/money";
import { Card, PageHeader } from "@/components/ui";
import {
  buildBankMonthBlocks,
  plannedTranchesFromContract,
  validatePhase1Spend,
  type BankMutation,
} from "@/lib/buku-kas/bank";
import {
  ensureBankTranchesAction,
  updateBankTrancheAction,
} from "@/lib/actions/lpj-bank";
import { updateLpjSignatoriesAction } from "@/lib/actions/lpj-signatories";
import { BankBookPreview } from "@/components/lpj/LpjBookPreviews";

export default async function AdminLpjBankPage({
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
      location: true,
      contractValue: true,
      status: true,
      bankTranches: true,
      lpjKepalaNama: true,
      lpjKepalaNip: true,
      lpjKetuaNama: true,
      lpjKetuaNip: true,
      lpjBendaharaNama: true,
      lpjBendaharaNip: true,
      lpjKabKota: true,
      lpjProvinsi: true,
    },
  });
  if (!project || project.status !== "ACTIVE") notFound();

  const planned = plannedTranchesFromContract(project.contractValue);
  const t70 = project.bankTranches.find((t) => t.phase === "PHASE_70");
  const t30 = project.bankTranches.find((t) => t.phase === "PHASE_30");

  const mutations: BankMutation[] = [];
  if (t70?.receivedAmount && t70.receivedAt) {
    mutations.push({
      date: t70.receivedAt,
      description: "Uang Masuk Bank Mandiri",
      proofNo: "01",
      debit: t70.receivedAmount,
      credit: 0,
    });
  }
  if (t30?.receivedAmount && t30.receivedAt) {
    mutations.push({
      date: t30.receivedAt,
      description: "Pencairan tahap 2 (30%)",
      proofNo: "02",
      debit: t30.receivedAmount,
      credit: 0,
    });
  }

  const phase1Out = 0;
  const blocks = buildBankMonthBlocks(mutations);
  const phaseCheck = validatePhase1Spend(t70?.receivedAmount ?? 0, phase1Out);

  return (
    <div>
      <PageHeader
        title="Pencairan Bank"
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

      {project.bankTranches.length === 0 ? (
        <Card className="mb-4">
          <p className="text-sm text-[var(--ink-muted)]">
            Belum ada baris pencairan. Buat rencana 70% / 30% dari nilai SPK{" "}
            {formatRupiah(project.contractValue)}.
          </p>
          <form action={ensureBankTranchesAction} className="mt-3">
            <input type="hidden" name="projectId" value={project.id} />
            <button
              type="submit"
              className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
            >
              Buat rencana 70% / 30%
            </button>
          </form>
          <p className="mt-2 text-xs text-[var(--ink-muted)]">
            Rencana: 70% = {formatRupiah(planned.phase70)} · 30% ={" "}
            {formatRupiah(planned.phase30)}
          </p>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {(
          [
            {
              phase: "PHASE_70" as const,
              label: "Tahap 1 — 70%",
              planned: t70?.plannedAmount ?? planned.phase70,
              row: t70,
            },
            {
              phase: "PHASE_30" as const,
              label: "Tahap 2 — 30%",
              planned: t30?.plannedAmount ?? planned.phase30,
              row: t30,
            },
          ] as const
        ).map((item) => (
          <Card key={item.phase}>
            <h3 className="font-medium">{item.label}</h3>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              Rencana {formatRupiah(item.planned)}
            </p>
            <form action={updateBankTrancheAction} className="mt-3 space-y-3">
              <input type="hidden" name="projectId" value={project.id} />
              <input type="hidden" name="phase" value={item.phase} />
              <label className="block text-sm">
                <span className="text-[var(--ink-muted)]">Nominal cair</span>
                <input
                  type="number"
                  name="receivedAmount"
                  min={0}
                  defaultValue={item.row?.receivedAmount ?? 0}
                  className="mt-1 w-full rounded-lg border border-[var(--line-soft)] px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="text-[var(--ink-muted)]">Tanggal cair</span>
                <input
                  type="date"
                  name="receivedAt"
                  defaultValue={
                    item.row?.receivedAt
                      ? format(item.row.receivedAt, "yyyy-MM-dd")
                      : ""
                  }
                  className="mt-1 w-full rounded-lg border border-[var(--line-soft)] px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="text-[var(--ink-muted)]">Catatan</span>
                <input
                  type="text"
                  name="notes"
                  defaultValue={item.row?.notes ?? ""}
                  className="mt-1 w-full rounded-lg border border-[var(--line-soft)] px-3 py-2"
                />
              </label>
              <button
                type="submit"
                className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
              >
                Simpan pencairan
              </button>
            </form>
          </Card>
        ))}
      </div>

      <Card className="mt-4">
        <h3 className="font-medium">Validasi fase 1 (70%)</h3>
        <p className="mt-2 text-sm">
          Cair 70%: {formatRupiah(t70?.receivedAmount ?? 0)} · Pengambilan
          tercatat: {formatRupiah(phase1Out)} · Sisa plafon:{" "}
          {formatRupiah(phaseCheck.remaining)}
        </p>
        {!phaseCheck.ok ? (
          <p className="mt-2 text-sm text-[var(--rose-ink)]">
            Melebihi pencairan 70% sebesar {formatRupiah(phaseCheck.overspend)}.
          </p>
        ) : (
          <p className="mt-2 text-sm text-[var(--emerald-ink)]">
            Pengambilan masih dalam plafon 70%.
          </p>
        )}
      </Card>

      <Card className="mt-4">
        <h3 className="font-medium">Pejabat tanda tangan Buku Bank</h3>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Kepala Sekolah, Ketua P2SP, dan Bendahara P2SP (sesuai template LPJ).
        </p>
        <form action={updateLpjSignatoriesAction} className="mt-3 grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="projectId" value={project.id} />
          <label className="block text-sm">
            <span className="text-[var(--ink-muted)]">Kepala Sekolah — nama</span>
            <input
              name="lpjKepalaNama"
              defaultValue={project.lpjKepalaNama ?? ""}
              className="mt-1 w-full rounded-lg border border-[var(--line-soft)] px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-[var(--ink-muted)]">Kepala Sekolah — NIP</span>
            <input
              name="lpjKepalaNip"
              defaultValue={project.lpjKepalaNip ?? ""}
              className="mt-1 w-full rounded-lg border border-[var(--line-soft)] px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-[var(--ink-muted)]">Ketua P2SP — nama</span>
            <input
              name="lpjKetuaNama"
              defaultValue={project.lpjKetuaNama ?? ""}
              className="mt-1 w-full rounded-lg border border-[var(--line-soft)] px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-[var(--ink-muted)]">Ketua P2SP — NIP (opsional)</span>
            <input
              name="lpjKetuaNip"
              defaultValue={project.lpjKetuaNip ?? ""}
              className="mt-1 w-full rounded-lg border border-[var(--line-soft)] px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-[var(--ink-muted)]">Bendahara P2SP — nama</span>
            <input
              name="lpjBendaharaNama"
              defaultValue={project.lpjBendaharaNama ?? ""}
              className="mt-1 w-full rounded-lg border border-[var(--line-soft)] px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-[var(--ink-muted)]">Bendahara P2SP — NIP</span>
            <input
              name="lpjBendaharaNip"
              defaultValue={project.lpjBendaharaNip ?? ""}
              className="mt-1 w-full rounded-lg border border-[var(--line-soft)] px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-[var(--ink-muted)]">Kab/Kota (ttd)</span>
            <input
              name="lpjKabKota"
              defaultValue={project.lpjKabKota ?? ""}
              placeholder="Kota Malang"
              className="mt-1 w-full rounded-lg border border-[var(--line-soft)] px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-[var(--ink-muted)]">Provinsi</span>
            <input
              name="lpjProvinsi"
              defaultValue={project.lpjProvinsi ?? ""}
              placeholder="Jawa Timur"
              className="mt-1 w-full rounded-lg border border-[var(--line-soft)] px-3 py-2"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
            >
              Simpan pejabat
            </button>
          </div>
        </form>
      </Card>

      <div className="mt-6">
        <h3 className="mb-3 font-serif text-xl">Pratinjau Buku Bank</h3>
        <BankBookPreview
          blocks={blocks}
          meta={{
            schoolName: project.name,
            location: project.location,
            kabKota: project.lpjKabKota,
            provinsi: project.lpjProvinsi,
            kepalaNama: project.lpjKepalaNama,
            kepalaNip: project.lpjKepalaNip,
            ketuaNama: project.lpjKetuaNama,
            ketuaNip: project.lpjKetuaNip,
            bendaharaNama: project.lpjBendaharaNama,
            bendaharaNip: project.lpjBendaharaNip,
          }}
        />
      </div>
    </div>
  );
}
