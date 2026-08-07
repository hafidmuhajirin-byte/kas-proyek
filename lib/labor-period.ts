/** Periode gaji pecah nota LABOR → absensi + label minggu di kas. */

const MS_DAY = 24 * 60 * 60 * 1000;

export function parseDateInput(raw: string): Date | null {
  const t = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const d = new Date(`${t}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toDateInputValue(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

/** Tanggal kalender inklusif [start, end] (UTC date-only). */
export function eachCalendarDay(start: Date, end: Date): Date[] {
  const a = Date.UTC(
    start.getUTCFullYear(),
    start.getUTCMonth(),
    start.getUTCDate(),
  );
  const b = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  if (b < a) return [];
  const out: Date[] = [];
  for (let t = a; t <= b; t += MS_DAY) {
    out.push(new Date(t));
  }
  return out;
}

/** Ambil N hari pertama dari rentang (untuk qty HOK). */
export function pickAttendanceDays(
  start: Date,
  end: Date,
  workDays: number,
): Date[] {
  const all = eachCalendarDay(start, end);
  if (workDays <= 0) return [];
  if (workDays >= all.length) return all;
  return all.slice(0, Math.floor(workDays));
}

export function laborWeekLabel(weekIndex: number): string {
  return `Pembayaran Pekerja Minggu Ke ${weekIndex}`;
}

export function laborPayrollPeriodKey(weekIndex: number): string {
  return `Minggu Ke ${weekIndex}`;
}

export function attendanceAuditNote(transactionId: string): string {
  return `pecah:${transactionId}`;
}

/** Apakah semua baris pecahan adalah LABOR (untuk ringkas di BKU/BKT). */
export function isAllLaborLines(
  lines: Array<{ kind?: string | null }> | null | undefined,
): boolean {
  if (!lines || lines.length === 0) return false;
  return lines.every((l) => String(l.kind ?? "").toUpperCase() === "LABOR");
}
