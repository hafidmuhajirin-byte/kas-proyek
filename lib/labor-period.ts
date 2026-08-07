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

const DAY_LETTERS_SUN_SAT = ["M", "S", "S", "R", "K", "J", "S"] as const;

/**
 * Kolom absensi tetap Minggu → Sabtu (7 hari).
 * Mingguan diambil dari minggu kalender yang memuat tanggal awal periode.
 */
export function sundayThroughSaturdayWeek(anchor: Date): Array<{
  date: Date;
  dayLetter: string;
}> {
  const utc = Date.UTC(
    anchor.getUTCFullYear(),
    anchor.getUTCMonth(),
    anchor.getUTCDate(),
  );
  const dow = new Date(utc).getUTCDay(); // 0=Minggu … 6=Sabtu
  const sunday = utc - dow * MS_DAY;
  return DAY_LETTERS_SUN_SAT.map((dayLetter, i) => ({
    date: new Date(sunday + i * MS_DAY),
    dayLetter,
  }));
}

/** Apakah tanggal d (UTC date) ada di [start, end] inklusif. */
export function isDateInRange(d: Date, start: Date, end: Date): boolean {
  const t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const a = Date.UTC(
    start.getUTCFullYear(),
    start.getUTCMonth(),
    start.getUTCDate(),
  );
  const b = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  return t >= a && t <= b;
}

/** Ambil N hari kerja acak: Senin–Sabtu saja (Minggu selalu libur). */
export function pickAttendanceDays(
  start: Date,
  end: Date,
  workDays: number,
): Date[] {
  const n = Math.floor(workDays);
  if (n <= 0) return [];

  // Kandidat: Senin–Sabtu pada minggu kalender + hari dalam periode (tanpa Minggu)
  const week = sundayThroughSaturdayWeek(start);
  const inRange = eachCalendarDay(start, end);
  const byKey = new Map<string, Date>();
  for (const d of [...week.map((w) => w.date), ...inRange]) {
    if (d.getUTCDay() === 0) continue; // Minggu libur
    byKey.set(d.toISOString().slice(0, 10), d);
  }
  const candidates = [...byKey.values()].sort(
    (a, b) => a.getTime() - b.getTime(),
  );
  if (candidates.length === 0) return [];
  if (n >= candidates.length) return candidates;

  // Acak (Fisher–Yates) lalu ambil n hari — pola beda tiap pekerja/simpan
  const shuffled = [...candidates];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = shuffled[i]!;
    shuffled[i] = shuffled[j]!;
    shuffled[j] = tmp;
  }
  return shuffled.slice(0, n).sort((a, b) => a.getTime() - b.getTime());
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
