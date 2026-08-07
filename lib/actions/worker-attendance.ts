"use server";

import { revalidatePath } from "next/cache";
import { canBreakDownMandorExpense, requireSession } from "@/lib/auth";
import { parseDateInput } from "@/lib/labor-period";
import { prisma } from "@/lib/prisma";

/** Toggle kehadiran satu hari (Senin–Sabtu). Minggu ditolak. */
export async function toggleWorkerAttendanceAction(formData: FormData) {
  const user = await requireSession();
  if (!canBreakDownMandorExpense(user)) return;

  const workerId = String(formData.get("workerId") ?? "");
  const dateRaw = String(formData.get("date") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const weekIndex = Number(formData.get("weekIndex") ?? 0);
  const date = parseDateInput(dateRaw);
  if (!workerId || !date || !projectId) return;
  if (date.getUTCDay() === 0) return; // Minggu libur

  const existing = await prisma.workerAttendance.findUnique({
    where: { workerId_date: { workerId, date } },
    select: { id: true, present: true },
  });

  if (existing?.present) {
    await prisma.workerAttendance.delete({ where: { id: existing.id } });
  } else if (existing) {
    await prisma.workerAttendance.update({
      where: { id: existing.id },
      data: { present: true, source: "ADMIN" },
    });
  } else {
    await prisma.workerAttendance.create({
      data: {
        workerId,
        date,
        present: true,
        source: "ADMIN",
        auditNote: weekIndex > 0 ? `absen:minggu-${weekIndex}` : "absen:manual",
      },
    });
  }

  // Sinkron jumlah hari di rekap gaji minggu ini (jika ada)
  if (weekIndex > 0) {
    const periodMonth = `Minggu Ke ${weekIndex}`;
    const weekStart = new Date(date);
    weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay());
    weekStart.setUTCHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);

    const presentCount = await prisma.workerAttendance.count({
      where: {
        workerId,
        present: true,
        date: { gte: weekStart, lte: weekEnd },
      },
    });
    const payroll = await prisma.payrollHokLine.findUnique({
      where: {
        projectId_workerId_periodMonth: {
          projectId,
          workerId,
          periodMonth,
        },
      },
      select: { id: true, dailyWage: true },
    });
    if (payroll) {
      await prisma.payrollHokLine.update({
        where: { id: payroll.id },
        data: {
          days: presentCount,
          amount: Math.round(presentCount * payroll.dailyWage),
        },
      });
    }
  }

  revalidatePath(`/admin/lpj/${projectId}/absen`);
}
