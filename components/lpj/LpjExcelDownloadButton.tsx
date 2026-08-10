"use client";

import { btnPrimaryClass } from "@/components/ui";

export function LpjExcelDownloadButton({
  projectId,
  label = "Unduh Excel Workbook",
}: {
  projectId: string;
  label?: string;
}) {
  return (
    <a
      href={`/api/admin/lpj/${projectId}/excel`}
      className={`${btnPrimaryClass} print:hidden`}
      download
    >
      {label}
    </a>
  );
}
