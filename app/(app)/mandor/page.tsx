import Link from "next/link";
import {
  getAccessibleProjectIds,
  isFotoOnlyMandor,
  isMandor,
  requireSession,
} from "@/lib/auth";
import { mandorWorkEstimateMax } from "@/lib/contractor";
import { getMandorFundSummariesFor } from "@/lib/mandor-fund";
import { formatRupiah } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { btnPrimaryClass, Card } from "@/components/ui";

function googleMapsSearchUrl(name: string, location: string) {
  const query = [name, location].map((s) => s.trim()).filter(Boolean).join(" ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export default async function MandorHomePage() {
  const user = await requireSession();
  if (!isMandor(user)) redirect("/dashboard");
  if (isFotoOnlyMandor(user)) redirect("/mandor/lokasi");

  const ids = await getAccessibleProjectIds(user);
  if (ids === "all" || ids.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-center text-2xl font-bold uppercase tracking-wide text-[var(--ink)]">
          Beranda
        </h1>
        <Card>
          <p className="text-base text-[var(--ink)]">
            Belum ada proyek ditugaskan. Minta Owner membuka halaman proyek →{" "}
            <strong>Mandor ditugaskan</strong>, atau centang proyek di menu
            Pengguna.
          </p>
        </Card>
      </div>
    );
  }

  const [projects, rejectedProofs] = await Promise.all([
    prisma.project.findMany({
      where: { id: { in: ids } },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        location: true,
        contractValue: true,
        spkBudgetLines: {
          where: {
            category: {
              in: ["PERENCANAAN", "PENGAWASAN", "PENGELOLAAN"],
            },
          },
          select: { category: true, amount: true },
        },
      },
    }),
    prisma.transaction.findMany({
      where: {
        createdById: user.id,
        isMandorExpense: true,
        breakdownStatus: "REJECTED",
        projectId: { in: ids },
        // Satu notifikasi per upload — bukan tiap BKK hasil split
        splitParentId: null,
      },
      orderBy: [{ updatedAt: "desc" }],
      select: {
        id: true,
        amount: true,
        description: true,
        breakdownNote: true,
        project: { select: { id: true, name: true } },
      },
    }),
  ]);

  const fundMap = await getMandorFundSummariesFor(
    projects.map((p) => ({ projectId: p.id, mandorId: user.id })),
  );

  return (
    <div className="space-y-5">
      <h1 className="text-center text-2xl font-bold uppercase tracking-wide text-[var(--ink)]">
        Proyek saya
      </h1>

      {rejectedProofs.length > 0 ? (
        <Card className="space-y-2 border-rose-200 bg-rose-50/80">
          <p className="text-center text-sm font-medium text-rose-950">
            Bukti ditolak — kirim foto/nota yang benar
          </p>
          {rejectedProofs.map((r) => (
            <div
              key={r.id}
              className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm text-rose-950"
            >
              <p className="font-medium">
                {r.project?.name ?? "Proyek"} · {formatRupiah(r.amount)}
              </p>
              <p className="text-xs text-rose-900/80">{r.description}</p>
              {r.breakdownNote ? (
                <p className="mt-1 text-xs">Alasan: {r.breakdownNote}</p>
              ) : null}
              <Link
                href={`/mandor/upload?projectId=${r.project?.id ?? ""}`}
                className="mt-2 inline-block text-sm font-medium text-[var(--accent)] underline"
              >
                Upload ulang
              </Link>
            </div>
          ))}
        </Card>
      ) : null}

      <div className="space-y-4">
        {projects.map((p) => {
          const s = fundMap.get(`${p.id}::${user.id}`) ?? {
            projectId: p.id,
            mandorId: user.id,
            totalCair: 0,
            totalBukti: 0,
            sisa: 0,
          };
          const spkByCat = new Map(
            p.spkBudgetLines.map((l) => [l.category, l.amount]),
          );
          const estimate = mandorWorkEstimateMax({
            contractValue: p.contractValue,
            perencanaan: spkByCat.get("PERENCANAAN") ?? 0,
            pengawasan: spkByCat.get("PENGAWASAN") ?? 0,
            pengelolaan: spkByCat.get("PENGELOLAAN") ?? 0,
          });
          const mapsUrl = googleMapsSearchUrl(p.name, p.location);
          return (
            <Card key={p.id} className="space-y-3">
              <div className="text-center">
                <p className="text-lg font-medium text-[var(--ink)]">{p.name}</p>
                {p.location ? (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 inline-block text-sm text-[var(--accent)] underline-offset-2 hover:underline"
                  >
                    {p.location}
                  </a>
                ) : null}
              </div>

              {estimate.amount > 0 ? (
                <div className="rounded-lg border border-[var(--line)] bg-[var(--paper-tint)] px-3 py-3 text-center">
                  <p className="text-xs text-[var(--ink-faint)]">
                    Estimasi maksimal pekerjaan
                  </p>
                  <p className="mt-0.5 text-lg font-medium tabular-nums text-[var(--ink)]">
                    {formatRupiah(estimate.amount)}
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-[var(--line)] px-3 py-2 text-center text-[11px] text-[var(--ink-faint)]">
                  Estimasi borongan belum tersedia — Admin belum mengisi pagu
                  Bayar jasa perencana, Bayar jasa Pengawas, dan Dana
                  pengelolaan di Ringkasan SPK.
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-[var(--ink-faint)]">Dana dari Owner</p>
                  <p className="text-base font-medium tabular-nums">
                    {formatRupiah(s.totalCair)}
                  </p>
                  <p className="text-[11px] text-[var(--ink-faint)]">
                    Pencairan ke Mandor
                  </p>
                </div>
                <div>
                  <p className="text-[var(--ink-faint)]">Sudah upload bukti</p>
                  <p className="text-base font-medium tabular-nums">
                    {formatRupiah(s.totalBukti)}
                  </p>
                </div>
              </div>

              {s.sisa > 0 ? (
                <div className="rounded-lg border border-amber-300/80 bg-amber-50 px-3 py-3 text-sm text-amber-950">
                  Sisa {formatRupiah(s.sisa)} masih tanggungan upload bukti.
                </div>
              ) : s.sisa < 0 ? (
                <div className="rounded-lg border border-[var(--line)] bg-[var(--paper-tint)] px-3 py-3 text-sm text-[var(--ink)]">
                  Bukti melebihi dana — tunggu dana berikutnya dari Owner.
                </div>
              ) : s.totalCair > 0 ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-3 text-sm text-emerald-900">
                  Bukti sudah menutup dana cair.
                </div>
              ) : (
                <p className="text-sm text-[var(--ink-faint)]">
                  Belum ada pencairan dari Owner.
                </p>
              )}

              <div className="flex flex-col gap-2">
                <Link
                  href={`/mandor/upload?projectId=${p.id}`}
                  className={`${btnPrimaryClass} w-full`}
                >
                  Upload bukti belanja
                </Link>
                <Link
                  href={`/mandor/lokasi?projectId=${p.id}`}
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-medium text-[#f7f4ee] transition hover:bg-teal-800"
                >
                  Ambil foto proyek
                </Link>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
