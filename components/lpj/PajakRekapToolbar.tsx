"use client";

import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { PrintButton } from "@/components/PrintButton";
import { updateLpjNpwpAction } from "@/lib/actions/lpj-tax-rekap";
import { Alert } from "@/components/ui";

function SaveBtn({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-teal-800 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-60"
    >
      {pending ? "…" : label}
    </button>
  );
}

export function PajakRekapToolbar({
  projectId,
  year,
  years,
  npwp,
}: {
  projectId: string;
  year: number;
  years: number[];
  npwp: string;
}) {
  const router = useRouter();
  const [npwpState, npwpAction] = useActionState(updateLpjNpwpAction, {});

  return (
    <div className="mb-4 space-y-3 print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-[var(--ink-muted)]">
          Tahun
          <select
            className="rounded-md border border-[var(--line)] bg-white px-2 py-1.5 text-[var(--ink)]"
            value={year}
            onChange={(e) => {
              router.push(
                `/admin/lpj/${projectId}/pajak?year=${e.target.value}`,
              );
            }}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <PrintButton label="Cetak rekap pajak (A4)" />
      </div>

      <form
        action={npwpAction}
        className="flex flex-wrap items-end gap-2 rounded-lg border border-[var(--line)] bg-white px-3 py-2"
      >
        <input type="hidden" name="projectId" value={projectId} />
        <label className="text-xs text-[var(--ink-muted)]">
          NPWP
          <input
            name="lpjNpwp"
            defaultValue={npwp}
            placeholder="00.000.000.0-000.000"
            className="mt-0.5 block min-w-[14rem] rounded border border-[var(--line)] px-2 py-1 text-sm text-[var(--ink)]"
          />
        </label>
        <SaveBtn label="Simpan NPWP" />
        {npwpState.error ? <Alert>{npwpState.error}</Alert> : null}
        {npwpState.success ? (
          <p className="text-xs text-emerald-800">{npwpState.success}</p>
        ) : null}
      </form>
    </div>
  );
}
