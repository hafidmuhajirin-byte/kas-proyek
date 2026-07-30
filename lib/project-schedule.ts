import { addMonths, differenceInCalendarDays, endOfDay, endOfYear, min } from "date-fns";

export const SCHEDULE_BAND_LOW = 200_000_000;
export const SCHEDULE_BAND_MID = 500_000_000;

export type ScheduleStatus = "on_track" | "due_soon" | "overdue";

export type ProjectScheduleItem = {
  id: string;
  name: string;
  location: string;
  contractValue: number;
  startDate: Date;
  plannedEnd: Date;
  durationMonths: number;
  daysRemaining: number;
  /** 0–100, progress waktu dari mulai sampai plannedEnd */
  timeProgressPercent: number;
  status: ScheduleStatus;
  cappedByYearEnd: boolean;
};

/** Durasi normal (bulan) menurut nominal kontrak. */
export function plannedDurationMonths(contractValue: number): number {
  if (contractValue >= SCHEDULE_BAND_MID) return 4;
  return 3;
}

/**
 * Tanggal akhir rencana = min(mulai + durasi, 31 Des tahun mulai).
 * Semua proyek wajib selesai sebelum akhir tahun.
 */
export function computePlannedEnd(startDate: Date, contractValue: number) {
  const durationMonths = plannedDurationMonths(contractValue);
  const byDuration = addMonths(startDate, durationMonths);
  const yearEnd = endOfDay(endOfYear(startDate));
  const plannedEnd = min([byDuration, yearEnd]);
  const cappedByYearEnd = plannedEnd.getTime() < byDuration.getTime();

  return { plannedEnd, durationMonths, cappedByYearEnd };
}

export function assessScheduleStatus(
  plannedEnd: Date,
  now: Date = new Date(),
): { status: ScheduleStatus; daysRemaining: number } {
  const daysRemaining = differenceInCalendarDays(plannedEnd, now);

  if (daysRemaining < 0) {
    return { status: "overdue", daysRemaining };
  }
  if (daysRemaining <= 14) {
    return { status: "due_soon", daysRemaining };
  }
  return { status: "on_track", daysRemaining };
}

export function timeProgressPercent(
  startDate: Date,
  plannedEnd: Date,
  now: Date = new Date(),
): number {
  const total = differenceInCalendarDays(plannedEnd, startDate);
  if (total <= 0) return 100;
  const elapsed = differenceInCalendarDays(now, startDate);
  return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
}

export function buildProjectSchedule(
  project: {
    id: string;
    name: string;
    location: string;
    contractValue: number;
    createdAt: Date;
  },
  now: Date = new Date(),
): ProjectScheduleItem {
  const startDate = project.createdAt;
  const { plannedEnd, durationMonths, cappedByYearEnd } = computePlannedEnd(
    startDate,
    project.contractValue,
  );
  const { status, daysRemaining } = assessScheduleStatus(plannedEnd, now);

  return {
    id: project.id,
    name: project.name,
    location: project.location,
    contractValue: project.contractValue,
    startDate,
    plannedEnd,
    durationMonths,
    daysRemaining,
    timeProgressPercent: timeProgressPercent(startDate, plannedEnd, now),
    status,
    cappedByYearEnd,
  };
}

export const scheduleStatusLabels: Record<ScheduleStatus, string> = {
  on_track: "On track",
  due_soon: "Segera jatuh tempo",
  overdue: "Terlambat",
};

const statusPriority: Record<ScheduleStatus, number> = {
  overdue: 0,
  due_soon: 1,
  on_track: 2,
};

/** Urutkan: terlambat → segera → on track, lalu sisa hari naik. */
export function sortScheduleByUrgency(
  items: ProjectScheduleItem[],
): ProjectScheduleItem[] {
  return [...items].sort((a, b) => {
    const byStatus = statusPriority[a.status] - statusPriority[b.status];
    if (byStatus !== 0) return byStatus;
    return a.daysRemaining - b.daysRemaining;
  });
}

export function filterScheduleItems(
  items: ProjectScheduleItem[],
  options: {
    projectId?: string;
    view?: "ringkas" | "perhatian" | "semua" | "on_track";
    ringkasLimit?: number;
  },
): ProjectScheduleItem[] {
  const view = options.view ?? "ringkas";
  const limit = options.ringkasLimit ?? 4;
  let next = sortScheduleByUrgency(items);

  if (options.projectId) {
    next = next.filter((item) => item.id === options.projectId);
  }

  if (view === "perhatian") {
    next = next.filter(
      (item) => item.status === "overdue" || item.status === "due_soon",
    );
  } else if (view === "on_track") {
    // Perlu perhatian dulu (jika ada), lalu semua on track
    const attention = next.filter(
      (item) => item.status === "overdue" || item.status === "due_soon",
    );
    const onTrack = next
      .filter((item) => item.status === "on_track")
      .sort((a, b) => a.daysRemaining - b.daysRemaining);
    next = [...attention, ...onTrack];
  } else if (view === "ringkas" && !options.projectId) {
    next = next.slice(0, limit);
  }

  return next;
}
