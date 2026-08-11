import Link from "next/link";
import { notFound } from "next/navigation";
import { isLpjViewer, requireLpjAccess } from "@/lib/auth";
import {
  loadAbsenProject,
  loadAbsenWeekDetail,
} from "@/lib/lpj/load-absen-weeks";
import { AbsenWeekToolbar } from "@/components/lpj/AbsenWeekToolbar";
import { DaftarHadirMingguan } from "@/components/lpj/DaftarHadirMingguan";
import { RekapitulasiPembayaranPekerja } from "@/components/lpj/RekapitulasiPembayaranPekerja";
import type { LpjHeaderMeta } from "@/components/lpj/LpjBookPreviews";
import {
  LpjSignatureProvider,
  LpjSignatureToolbar,
} from "@/components/lpj/LpjSignatureControls";
import { Card, EmptyState, PageHeader } from "@/components/ui";

export default async function AdminLpjAbsenPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ view?: string; week?: string }>;
}) {
  const { projectId } = await params;
  const user = await requireLpjAccess(projectId);
  const sp = await searchParams;
  const canEdit = !isLpjViewer(user);

  const loaded = await loadAbsenProject(projectId);
  if (!loaded || loaded.project.status !== "ACTIVE") notFound();

  const { project, weeks } = loaded;
  const view = sp.view === "rekap" ? "rekap" : "hadir";
  const weekParam = sp.week ? Number(sp.week) : NaN;
  const selectedWeek =
    Number.isFinite(weekParam) && weeks.some((w) => w.weekIndex === weekParam)
      ? weekParam
      : (weeks[0]?.weekIndex ?? null);

  const projectTitle = (project.notes ?? "").trim() || project.name;
  const meta: LpjHeaderMeta = {
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
    kepalaTtdUrl: project.lpjKepalaTtdUrl,
    ketuaTtdUrl: project.lpjKetuaTtdUrl,
    bendaharaTtdUrl: project.lpjBendaharaTtdUrl,
    stempelUrl: project.lpjStempelUrl,
  };

  const weekDetail =
    view === "hadir" && selectedWeek != null
      ? await loadAbsenWeekDetail(projectId, selectedWeek)
      : null;

  return (
    <LpjSignatureProvider projectId={project.id}>
    <div
      className={
        view === "hadir" ? "absen-print-landscape" : "absen-print-portrait"
      }
    >
      <div className="print:hidden">
        <PageHeader
          title="Absen & Rekap Gaji"
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

        <Card className="mb-4 text-sm text-[var(--ink-muted)]">
          Data dari pecah nota <strong>Bayar pekerja</strong>. Judul ={" "}
          <strong>catatan proyek</strong>
          {project.notes?.trim()
            ? ` (“${project.notes.trim().toUpperCase()}”).`
            : " (isi Catatan di halaman proyek jika kosong)."}{" "}
          Minggu selalu libur; hari hadir diacak Senin–Sabtu.
          {canEdit
            ? " Klik sel absen untuk ubah, atau tombol Acak kehadiran."
            : " Akses LPJ Proyek hanya baca untuk halaman ini."}{" "}
          Cetak tanpa scrollbar.
        </Card>

        <LpjSignatureToolbar className="mb-4" />

        <AbsenWeekToolbar
          projectId={project.id}
          weeks={weeks.map((w) => ({
            weekIndex: w.weekIndex,
            label: w.label,
          }))}
          selectedWeek={selectedWeek}
          view={view}
          canEdit={canEdit}
        />
      </div>

      {weeks.length === 0 ? (
        <EmptyState message="Belum ada pecah nota Bayar pekerja dengan periode tanggal. Simpan pecah gaji dulu di Review Nota." />
      ) : view === "rekap" ? (
        <div className="overflow-x-auto rounded-lg border border-[var(--line)] bg-white p-4 print:overflow-visible print:border-0 print:p-0">
          <RekapitulasiPembayaranPekerja
            weeks={weeks}
            meta={meta}
            projectTitle={projectTitle}
          />
        </div>
      ) : weekDetail ? (
        <div className="overflow-x-auto rounded-lg border border-[var(--line)] bg-white p-3 print:overflow-visible print:border-0 print:p-0">
          <DaftarHadirMingguan
            detail={weekDetail}
            meta={meta}
            projectTitle={projectTitle}
            projectId={project.id}
            canEdit={canEdit}
          />
        </div>
      ) : (
        <EmptyState message="Pilih minggu untuk melihat daftar hadir." />
      )}
    </div>
    </LpjSignatureProvider>
  );
}
