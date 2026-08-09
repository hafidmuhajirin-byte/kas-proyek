"use client";

import { useActionState } from "react";
import {
  splitMandorNotaAction,
  undoSplitMandorNotaAction,
} from "@/lib/actions/mandor-nota-split";
import { TAX_THRESHOLD } from "@/lib/lpj/tax-compliance";
import { formatRupiah } from "@/lib/money";
import { Alert } from "@/components/ui";

/** Tombol Split Nota — di bawah pecah isi Admin (bukan redesign tabel). */
export function MandorNotaSplitButton({
  transactionId,
  mandorTotal,
  lineCount,
  remainingAfterCurrent,
  partCount,
}: {
  transactionId: string;
  mandorTotal: number;
  lineCount: number;
  /** Sisa nota Mandor setelah BKK lain + pecah isi BKK ini (perkiraan). */
  remainingAfterCurrent: number;
  partCount: number;
}) {
  const [state, action, pending] = useActionState(splitMandorNotaAction, {});

  const eligible =
    mandorTotal > TAX_THRESHOLD &&
    lineCount > 0 &&
    remainingAfterCurrent > 0 &&
    partCount < 3;

  if (!eligible) return null;

  return (
    <div className="mt-2 space-y-1.5 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2">
      <p className="text-[11px] text-amber-950">
        Total Mandor {formatRupiah(mandorTotal)} &gt;{" "}
        {formatRupiah(TAX_THRESHOLD)} — Anda bisa{" "}
        <strong>Split Nota</strong> untuk BKK berikutnya (opsional). Sisa ≈{" "}
        {formatRupiah(remainingAfterCurrent)}.
      </p>
      <form action={action}>
        <input type="hidden" name="transactionId" value={transactionId} />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-amber-700/40 bg-white px-3 py-1.5 text-xs font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-60"
        >
          {pending ? "Memproses…" : "Split Nota → BKK berikutnya"}
        </button>
      </form>
      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.success ? (
        <p className="text-xs text-emerald-800">{state.success}</p>
      ) : null}
    </div>
  );
}

export function MandorNotaUndoSplitButton({ parentId }: { parentId: string }) {
  const [state, action, pending] = useActionState(undoSplitMandorNotaAction, {});

  return (
    <form action={action} className="inline">
      <input type="hidden" name="parentId" value={parentId} />
      <button
        type="submit"
        disabled={pending}
        className="text-xs text-[var(--ink-muted)] underline hover:text-[var(--ink)] disabled:opacity-60"
        onClick={(e) => {
          if (!confirm("Batalkan split dan gabung lagi ke satu nota?")) {
            e.preventDefault();
          }
        }}
      >
        {pending ? "…" : "Batalkan split"}
      </button>
      {state.error ? (
        <p className="mt-1 text-xs text-rose-700">{state.error}</p>
      ) : null}
      {state.success ? (
        <p className="mt-1 text-xs text-emerald-800">{state.success}</p>
      ) : null}
    </form>
  );
}
