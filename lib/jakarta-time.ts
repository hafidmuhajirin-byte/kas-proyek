/** Zona waktu aplikasi lapangan — WIB (UTC+7). */

export function jakartaYmd(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function jakartaDayOfMonth(date = new Date()): number {
  const day = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
  }).format(date);
  return Number(day);
}

export function jakartaMonthRange(date = new Date()): { start: Date; end: Date } {
  const ymd = jakartaYmd(date);
  const [y, m] = ymd.split("-").map(Number) as [number, number];
  const start = new Date(
    `${y}-${String(m).padStart(2, "0")}-01T00:00:00+07:00`,
  );
  const nextM = m === 12 ? 1 : m + 1;
  const nextY = m === 12 ? y + 1 : y;
  const end = new Date(
    `${nextY}-${String(nextM).padStart(2, "0")}-01T00:00:00+07:00`,
  );
  return { start, end };
}
