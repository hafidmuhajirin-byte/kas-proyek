"use client";

import { useTransition } from "react";
import { toggleWorkerAttendanceAction } from "@/lib/actions/worker-attendance";

/** Ceklis hadir — klik untuk ubah V ↔ kosong (Minggu tidak bisa). */
export function AttendanceMarkButton({
  workerId,
  projectId,
  weekIndex,
  dateKey,
  present,
  workable,
  canEdit = true,
}: {
  workerId: string;
  projectId: string;
  weekIndex: number;
  dateKey: string;
  present: boolean;
  workable: boolean;
  canEdit?: boolean;
}) {
  const [pending, start] = useTransition();

  if (!workable) {
    return <span className="inline-block min-w-[0.75rem]">&nbsp;</span>;
  }

  if (!canEdit) {
    return <span className="inline-block min-w-[0.85rem] font-semibold">{present ? "V" : "\u00a0"}</span>;
  }

  return (
    <button
      type="button"
      disabled={pending}
      title={present ? "Hadir — klik untuk kosongkan" : "Kosong — klik untuk hadir"}
      className="min-w-[0.85rem] rounded px-0.5 font-semibold text-teal-900 hover:bg-teal-900/10 print:pointer-events-none disabled:opacity-50"
      onClick={() => {
        const fd = new FormData();
        fd.set("workerId", workerId);
        fd.set("date", dateKey);
        fd.set("projectId", projectId);
        fd.set("weekIndex", String(weekIndex));
        start(() => toggleWorkerAttendanceAction(fd));
      }}
    >
      {present ? "V" : "\u00a0"}
    </button>
  );
}
