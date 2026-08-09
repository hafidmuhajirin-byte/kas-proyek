import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

export type PaymentCair = {
  date: Date | string;
  amount: number;
};

export type SCurvePoint = {
  /** ms since epoch */
  t: number;
  date: Date;
  /** kumulatif nominal setelah cair ini */
  cumulative: number;
  /** 0–100+ (bisa >100 jika overpay) */
  percent: number;
  /** nominal cair pada titik ini (0 untuk titik awal) */
  amount: number;
};

export type PaymentSCurveData = {
  points: SCurvePoint[];
  baseline: number;
  totalPaid: number;
  finalPercent: number;
  startDate: Date | null;
  endDate: Date | null;
};

function toDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/** Bangun titik kurva-S kumulatif dari tanggal cair pembayaran klien. */
export function buildPaymentSCurve(input: {
  payments: PaymentCair[];
  /** Acuan 100%: nilai kontrak atau nilai pekerjaan selesai */
  baseline: number;
}): PaymentSCurveData {
  const baseline = Math.max(0, input.baseline);
  const sorted = [...input.payments]
    .filter((p) => p.amount > 0)
    .map((p) => ({ date: toDate(p.date), amount: p.amount }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (sorted.length === 0) {
    return {
      points: [],
      baseline,
      totalPaid: 0,
      finalPercent: 0,
      startDate: null,
      endDate: null,
    };
  }

  const points: SCurvePoint[] = [];
  let cumulative = 0;

  // Titik awal di tanggal cair pertama, 0%
  const first = sorted[0];
  points.push({
    t: first.date.getTime(),
    date: first.date,
    cumulative: 0,
    percent: 0,
    amount: 0,
  });

  for (const p of sorted) {
    cumulative += p.amount;
    const percent =
      baseline > 0 ? Math.round((cumulative / baseline) * 1000) / 10 : 0;
    const last = points[points.length - 1];

    // Gabungkan cair di tanggal yang sama (kecuali titik awal 0%)
    if (
      last &&
      last.amount > 0 &&
      dayKey(last.date) === dayKey(p.date)
    ) {
      last.cumulative = cumulative;
      last.percent = percent;
      last.amount += p.amount;
      continue;
    }

    // Cair pertama: naikkan dari 0% di momen yang sama
    if (last && last.amount === 0 && dayKey(last.date) === dayKey(p.date)) {
      points.push({
        t: p.date.getTime() + 1,
        date: p.date,
        cumulative,
        percent,
        amount: p.amount,
      });
      continue;
    }

    points.push({
      t: p.date.getTime(),
      date: p.date,
      cumulative,
      percent,
      amount: p.amount,
    });
  }

  const last = points[points.length - 1];
  return {
    points,
    baseline,
    totalPaid: cumulative,
    finalPercent: last?.percent ?? 0,
    startDate: first.date,
    endDate: last?.date ?? first.date,
  };
}

export function formatSCurveDate(date: Date) {
  return format(date, "dd MMM yy", { locale: localeId });
}
