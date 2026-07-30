import Link from "next/link";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { formatRupiah } from "@/lib/money";
import {
  scheduleStatusLabels,
  type ProjectScheduleItem,
  type ScheduleStatus,
} from "@/lib/project-schedule";
import { tidyCase } from "@/lib/text";

const statusTone: Record<ScheduleStatus, string> = {
  on_track: "text-[var(--accent)]",
  due_soon: "text-amber-800",
  overdue: "text-[var(--rose-ink)]",
};

const barTone: Record<ScheduleStatus, string> = {
  on_track: "bg-[var(--accent)]",
  due_soon: "bg-amber-600",
  overdue: "bg-[var(--rose-ink)]",
};

function daysLabel(daysRemaining: number): string {
  if (daysRemaining < 0) {
    return `Terlambat ${Math.abs(daysRemaining)} hari`;
  }
  if (daysRemaining === 0) return "Jatuh tempo hari ini";
  return `Sisa ${daysRemaining} hari`;
}

export function ProjectSchedule({
  items,
  totalCount,
  focusLabel,
}: {
  items: ProjectScheduleItem[];
  totalCount?: number;
  focusLabel?: string;
}) {
  const onTrackCount = items.filter((i) => i.status === "on_track").length;
  const attentionCount = items.length - onTrackCount;
  const hidden =
    typeof totalCount === "number" && totalCount > items.length
      ? totalCount - items.length
      : 0;

  return (
    <div className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface)] p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium text-[var(--ink)]">
            Jadwal pelaksanaan
          </h3>
          <p className="mt-0.5 text-sm text-[var(--ink-faint)]">
            Wajib selesai sebelum akhir tahun
            {focusLabel === "on track"
              ? ` · ${onTrackCount} on track${
                  attentionCount > 0
                    ? ` · ${attentionCount} perlu perhatian`
                    : ""
                }`
              : hidden > 0
                ? ` · ${items.length} ditampilkan, ${hidden} disembunyikan`
                : totalCount != null
                  ? ` · ${items.length} proyek`
                  : ""}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {items.length === 0 ? (
          <p className="text-sm text-[var(--ink-faint)]">
            Belum ada proyek aktif.
          </p>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="border-b border-[var(--line-soft)] pb-4 last:border-0 last:pb-0"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={`/projects/${item.id}`}
                    className="text-sm font-medium text-[var(--ink)] hover:underline"
                  >
                    {tidyCase(item.name)}
                  </Link>
                  <p className="mt-0.5 text-sm text-[var(--ink-faint)]">
                    {tidyCase(item.location)} ·{" "}
                    {formatRupiah(item.contractValue)} · {item.durationMonths}{" "}
                    bln
                    {item.cappedByYearEnd ? " · dibatasi akhir tahun" : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right text-sm">
                  <p className={`font-medium ${statusTone[item.status]}`}>
                    {scheduleStatusLabels[item.status]}
                  </p>
                  <p className="tabular-nums text-[var(--ink-faint)]">
                    {daysLabel(item.daysRemaining)}
                  </p>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm text-[var(--ink-faint)]">
                <span className="tabular-nums">
                  {format(item.startDate, "d MMM yyyy", { locale: localeId })}{" "}
                  –{" "}
                  {format(item.plannedEnd, "d MMM yyyy", { locale: localeId })}
                </span>
                <span className="tabular-nums">
                  {item.timeProgressPercent}% waktu
                </span>
              </div>

              <div className="mt-1.5 h-1.5 overflow-hidden rounded bg-[var(--paper-tint)]">
                <div
                  className={`h-full rounded ${barTone[item.status]}`}
                  style={{
                    width: `${Math.min(100, item.timeProgressPercent)}%`,
                  }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
