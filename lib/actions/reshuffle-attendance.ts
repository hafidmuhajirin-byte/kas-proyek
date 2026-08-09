"use server";

import { revalidatePath } from "next/cache";
import { canBreakDownMandorExpense, requireSession } from "@/lib/auth";
import {
  attendanceAuditNote,
  laborPayrollPeriodKey,
  pickAttendanceDays,
  sundayThroughSaturdayWeek,
} from "@/lib/labor-period";
import { prisma } from "@/lib/prisma";

/**
 * Acak ulang ceklis kehadiran minggu ini:
 * jumlah hari tetap (dari payroll/pecah), pola hari Senin–Sabtu diacak per pekerja.
 */
export async function reshuffleWeekAttendanceAction(formData: FormData) {
  const user = await requireSession();
  if (!canBreakDownMandorExpense(user)) return;

  const projectId = String(formData.get("projectId") ?? "");
  const weekIndex = Number(formData.get("weekIndex") ?? 0);
  if (!projectId || !(weekIndex > 0)) return;

  const tx = await prisma.transaction.findFirst({
    where: {
      projectId,
      isMandorExpense: true,
      laborWeekIndex: weekIndex,
      isSplitParent: false,
    },
    select: {
      id: true,
      laborPeriodStart: true,
      laborPeriodEnd: true,
      expenseLines: {
        where: { kind: "LABOR" },
        select: {
          description: true,
          quantity: true,
          workDays: true,
          unitPrice: true,
          dailyRate: true,
          amount: true,
        },
      },
    },
  });
  if (!tx?.laborPeriodStart || !tx.laborPeriodEnd) return;

  const week = sundayThroughSaturdayWeek(tx.laborPeriodStart);
  const weekStart = week[0]!.date;
  const weekEnd = week[6]!.date;
  const periodKey = laborPayrollPeriodKey(weekIndex);
  const audit = attendanceAuditNote(tx.id);

  const workers = await prisma.worker.findMany({
    where: { projectId, active: true },
    select: {
      id: true,
      name: true,
      dailyWage: true,
      payrollLines: {
        where: { periodMonth: periodKey },
        select: { id: true, days: true, dailyWage: true, amount: true },
        take: 1,
      },
    },
  });

  await prisma.$transaction(async (db) => {
    // Hapus absensi minggu ini untuk pekerja yang punya pecah/payroll
    for (const w of workers) {
      const line = tx.expenseLines.find(
        (l) =>
          l.description.trim().toLowerCase() === w.name.trim().toLowerCase(),
      );
      const payroll = w.payrollLines[0];
      if (!line && !payroll) continue;

      const days =
        payroll?.days ??
        line?.workDays ??
        line?.quantity ??
        0;
      const wage =
        payroll?.dailyWage ??
        line?.dailyRate ??
        line?.unitPrice ??
        w.dailyWage;

      await db.workerAttendance.deleteMany({
        where: {
          workerId: w.id,
          date: { gte: weekStart, lte: weekEnd },
        },
      });

      const attendDates = pickAttendanceDays(
        tx.laborPeriodStart!,
        tx.laborPeriodEnd!,
        days,
      );
      for (const d of attendDates) {
        await db.workerAttendance.create({
          data: {
            workerId: w.id,
            date: d,
            present: true,
            source: "ADMIN",
            auditNote: audit,
          },
        });
      }

      if (payroll) {
        await db.payrollHokLine.update({
          where: { id: payroll.id },
          data: {
            days: attendDates.length,
            amount: Math.round(attendDates.length * wage),
          },
        });
      }
    }
  });

  revalidatePath(`/admin/lpj/${projectId}/absen`);
}
