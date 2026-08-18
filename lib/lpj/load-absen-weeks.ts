import { prisma } from "@/lib/prisma";
import {
  laborPayrollPeriodKey,
  laborWeekLabel,
  sundayThroughSaturdayWeek,
} from "@/lib/labor-period";
import { golFromRole, type LaborGol } from "@/lib/labor-golongan";

export type AbsenWeekSummary = {
  weekIndex: number;
  label: string;
  periodStart: Date;
  periodEnd: Date;
  paymentDate: Date;
  totalAmount: number;
  workerCount: number;
  transactionId: string;
};

export type AbsenDayCol = {
  date: Date;
  /** M / S / S / R / K / J / S — selalu Minggu→Sabtu */
  dayLetter: string;
  /** Tanggal termasuk periode gaji yang dipecah */
  inPeriod: boolean;
};

export type AbsenWorkerRow = {
  workerId: string;
  name: string;
  role: string;
  gol: LaborGol;
  /** present keyed by yyyy-mm-dd UTC */
  presentByDate: Record<string, boolean>;
  workDays: number;
  overtimeHours: number;
  dailyWage: number;
  overtimeWage: number;
  totalWage: number;
};

export type AbsenWeekDetail = AbsenWeekSummary & {
  dayCols: AbsenDayCol[];
  workers: AbsenWorkerRow[];
};

function utcKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function loadAbsenProject(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      notes: true,
      location: true,
      status: true,
      lpjKabKota: true,
      lpjProvinsi: true,
      lpjKepalaNama: true,
      lpjKepalaNip: true,
      lpjKetuaNama: true,
      lpjKetuaNip: true,
      lpjBendaharaNama: true,
      lpjBendaharaNip: true,
      lpjKepalaTtdUrl: true,
      lpjKetuaTtdUrl: true,
      lpjBendaharaTtdUrl: true,
      lpjStempelUrl: true,
    },
  });
  if (!project) return null;

  const laborTxs = await prisma.transaction.findMany({
    where: {
      projectId,
      isMandorExpense: true,
      laborWeekIndex: { not: null },
      laborPeriodStart: { not: null },
      laborPeriodEnd: { not: null },
      isSplitParent: false,
    },
    orderBy: [{ laborWeekIndex: "asc" }, { date: "asc" }],
    select: {
      id: true,
      date: true,
      amount: true,
      laborWeekIndex: true,
      laborPeriodStart: true,
      laborPeriodEnd: true,
      expenseLines: {
        where: { kind: "LABOR" },
        orderBy: { createdAt: "asc" },
        select: {
          description: true,
          laborRole: true,
          quantity: true,
          workDays: true,
          unitPrice: true,
          dailyRate: true,
          amount: true,
        },
      },
    },
  });

  // Satu baris rekap per minggu (ambil tx pertama jika duplikat index)
  const byWeek = new Map<number, (typeof laborTxs)[number]>();
  for (const tx of laborTxs) {
    const w = tx.laborWeekIndex!;
    if (!byWeek.has(w)) byWeek.set(w, tx);
  }

  const weeks: AbsenWeekSummary[] = [...byWeek.values()].map((tx) => {
    const weekIndex = tx.laborWeekIndex!;
    const lines = tx.expenseLines;
    const totalAmount =
      lines.length > 0
        ? lines.reduce((s, l) => s + l.amount, 0)
        : tx.amount;
    return {
      weekIndex,
      label: laborWeekLabel(weekIndex),
      periodStart: tx.laborPeriodStart!,
      periodEnd: tx.laborPeriodEnd!,
      paymentDate: tx.date,
      totalAmount,
      workerCount: lines.length,
      transactionId: tx.id,
    };
  });

  return { project, weeks, laborTxByWeek: byWeek };
}

export async function loadAbsenWeekDetail(
  projectId: string,
  weekIndex: number,
): Promise<AbsenWeekDetail | null> {
  const loaded = await loadAbsenProject(projectId);
  if (!loaded) return null;
  const summary = loaded.weeks.find((w) => w.weekIndex === weekIndex);
  const tx = loaded.laborTxByWeek.get(weekIndex);
  if (!summary || !tx) return null;

  const periodStart = summary.periodStart;
  const periodEnd = summary.periodEnd;
  const dayCols: AbsenDayCol[] = sundayThroughSaturdayWeek(periodStart).map(
    (d) => ({
      ...d,
      // Minggu selalu libur; Senin–Sabtu bisa diisi kehadiran
      inPeriod: d.date.getUTCDay() !== 0,
    }),
  );

  const weekStart = dayCols[0]!.date;
  const weekEnd = dayCols[6]!.date;
  const periodKey = laborPayrollPeriodKey(weekIndex);
  const workersDb = await prisma.worker.findMany({
    where: { projectId, active: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      role: true,
      dailyWage: true,
      attendances: {
        where: {
          present: true,
          date: { gte: weekStart, lte: weekEnd },
        },
        select: { date: true },
      },
      payrollLines: {
        where: { periodMonth: periodKey },
        select: { days: true, dailyWage: true, amount: true },
        take: 1,
      },
    },
  });

  // Urutkan mengikuti baris pecah nota jika ada
  const lineOrder = new Map(
    tx.expenseLines.map((l, i) => [l.description.trim().toLowerCase(), i]),
  );

  const workers: AbsenWorkerRow[] = workersDb
    .map((w) => {
      const payroll = w.payrollLines[0];
      const line = tx.expenseLines.find(
        (l) =>
          l.description.trim().toLowerCase() === w.name.trim().toLowerCase(),
      );
      // Skip pekerja tanpa payroll minggu ini dan tanpa baris pecah
      if (!payroll && !line) return null;

      const presentByDate: Record<string, boolean> = {};
      for (const a of w.attendances) {
        presentByDate[utcKey(a.date)] = true;
      }

      const role = line?.laborRole || w.role;
      const presentCount = w.attendances.length;
      const workDays =
        presentCount > 0
          ? presentCount
          : (payroll?.days ??
            line?.workDays ??
            line?.quantity ??
            0);
      const dailyWage =
        payroll?.dailyWage ??
        line?.dailyRate ??
        line?.unitPrice ??
        w.dailyWage;
      const totalWage =
        payroll?.amount ??
        line?.amount ??
        Math.round(workDays * dailyWage);

      return {
        workerId: w.id,
        name: w.name,
        role,
        gol: golFromRole(role),
        presentByDate,
        workDays,
        overtimeHours: 0,
        dailyWage,
        overtimeWage: 0,
        totalWage,
      } satisfies AbsenWorkerRow;
    })
    .filter((r): r is AbsenWorkerRow => r != null)
    .sort((a, b) => {
      const ia = lineOrder.get(a.name.trim().toLowerCase()) ?? 999;
      const ib = lineOrder.get(b.name.trim().toLowerCase()) ?? 999;
      if (ia !== ib) return ia - ib;
      return a.name.localeCompare(b.name, "id");
    });

  return {
    ...summary,
    dayCols,
    workers,
  };
}
