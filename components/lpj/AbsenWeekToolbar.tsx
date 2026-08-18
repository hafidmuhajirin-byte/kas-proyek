"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { PrintButton } from "@/components/PrintButton";
import { reshuffleWeekAttendanceAction } from "@/lib/actions/reshuffle-attendance";

export function AbsenWeekToolbar({
  projectId,
  weeks,
  selectedWeek,
  view,
  canEdit = true,
}: {
  projectId: string;
  weeks: Array<{ weekIndex: number; label: string }>;
  selectedWeek: number | null;
  view: "hadir" | "rekap";
  canEdit?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const base = `/admin/lpj/${projectId}/absen`;

  function go(nextView: "hadir" | "rekap", week?: number | null) {
    const q = new URLSearchParams();
    q.set("view", nextView);
    if (nextView === "hadir" && week != null) q.set("week", String(week));
    router.push(`${base}?${q.toString()}`);
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
      <div className="flex rounded-lg border border-[var(--line)] p-0.5 text-sm">
        <button
          type="button"
          onClick={() => go("hadir", selectedWeek)}
          className={`rounded-md px-3 py-1.5 ${
            view === "hadir"
              ? "bg-teal-800 text-white"
              : "text-[var(--ink-muted)] hover:bg-[var(--paper-tint)]"
          }`}
        >
          Daftar hadir mingguan
        </button>
        <button
          type="button"
          onClick={() => go("rekap")}
          className={`rounded-md px-3 py-1.5 ${
            view === "rekap"
              ? "bg-teal-800 text-white"
              : "text-[var(--ink-muted)] hover:bg-[var(--paper-tint)]"
          }`}
        >
          Rekapitulasi pembayaran
        </button>
      </div>

      {view === "hadir" && weeks.length > 0 ? (
        <label className="flex items-center gap-2 text-sm text-[var(--ink-muted)]">
          Minggu
          <select
            className="rounded-md border border-[var(--line)] bg-white px-2 py-1.5 text-[var(--ink)]"
            value={selectedWeek ?? weeks[0].weekIndex}
            onChange={(e) => go("hadir", Number(e.target.value))}
          >
            {weeks.map((w) => (
              <option key={w.weekIndex} value={w.weekIndex}>
                {w.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {canEdit && view === "hadir" && selectedWeek != null ? (
        <button
          type="button"
          disabled={pending}
          className="rounded-md border border-[var(--line)] px-3 py-1.5 text-sm text-[var(--ink)] hover:bg-[var(--paper-tint)] disabled:opacity-50"
          title="Acak ulang hari hadir Senin–Sabtu (Minggu tetap libur)"
          onClick={() => {
            const fd = new FormData();
            fd.set("projectId", projectId);
            fd.set("weekIndex", String(selectedWeek));
            start(() => reshuffleWeekAttendanceAction(fd));
          }}
        >
          {pending ? "Mengacak…" : "Acak kehadiran"}
        </button>
      ) : null}

      <PrintButton
        label={
          view === "hadir"
            ? "Cetak daftar hadir (A4 landscape)"
            : "Cetak rekapitulasi (A4 potret)"
        }
      />
    </div>
  );
}
