"use client";

import { useActionState, useMemo, useState } from "react";
import { createMandorExpenseAction } from "@/lib/actions/mandor-expense";
import { ProofCapture } from "@/components/ProofCapture";
import { RupiahInput } from "@/components/RupiahInput";
import {
  Alert,
  btnPrimaryClass,
  Field,
  inputClass,
} from "@/components/ui";
import type { ReceiptOcrSuggestion } from "@/lib/receipt-ocr";
import { formatNumberId, formatRupiah } from "@/lib/money";
import {
  formatPencairanLabel,
  type PencairanOption,
} from "@/lib/mandor-pencairan-shared";

type ProjectOption = { id: string; name: string };

/** Serializable pencairan for client (dates as ISO). */
export type PencairanOptionClient = Omit<PencairanOption, "date"> & {
  date: string;
};

export function MandorUploadForm({
  projects,
  defaultProjectId,
  pencairanByProject,
}: {
  projects: ProjectOption[];
  defaultProjectId?: string;
  pencairanByProject: Record<string, PencairanOptionClient[]>;
}) {
  const [state, action, pending] = useActionState(createMandorExpenseAction, {});
  const [amountKey, setAmountKey] = useState(0);
  const [amountDefault, setAmountDefault] = useState(0);
  const [descKey, setDescKey] = useState(0);
  const [descDefault, setDescDefault] = useState("");
  const [projectId, setProjectId] = useState(
    defaultProjectId ?? projects[0]?.id ?? "",
  );

  const pencairanOptions = useMemo(
    () => pencairanByProject[projectId] ?? [],
    [pencairanByProject, projectId],
  );

  function applyOcr(s: ReceiptOcrSuggestion) {
    if (s.amount != null && s.amount > 0) {
      setAmountDefault(s.amount);
      setAmountKey((k) => k + 1);
    }
    if (s.descriptionHint) {
      setDescDefault(s.descriptionHint);
      setDescKey((k) => k + 1);
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={action} className="space-y-4">
      {state.error ? <Alert>{state.error}</Alert> : null}

      <Field label="Proyek" htmlFor="projectId">
        <select
          id="projectId"
          name="projectId"
          className={inputClass}
          required
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Acuan pencairan / termin" htmlFor="pencairanKey">
        <select
          id="pencairanKey"
          name="pencairanKey"
          className={inputClass}
          required
          defaultValue=""
          key={projectId}
        >
          <option value="" disabled>
            {pencairanOptions.length === 0
              ? "Belum ada pencairan di proyek ini"
              : "Pilih pencairan…"}
          </option>
          {pencairanOptions.map((o) => (
            <option key={o.key} value={o.key} disabled={o.remaining <= 0}>
              {formatPencairanLabel({
                label: o.label,
                amount: o.amount,
                remaining: o.remaining,
              })}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-[var(--ink-faint)]">
          Bukti memotong sisa pencairan, bukan kas besar.
        </p>
      </Field>

      <Field label="Tanggal" htmlFor="date">
        <input
          id="date"
          name="date"
          type="date"
          className={inputClass}
          required
          defaultValue={today}
        />
      </Field>

      <Field label="Nominal" htmlFor="amount">
        <RupiahInput
          key={amountKey}
          id="amount"
          name="amount"
          defaultValue={amountDefault}
          required
          placeholder={formatNumberId(0)}
        />
      </Field>

      <Field label="Keterangan" htmlFor="description">
        <textarea
          key={descKey}
          id="description"
          name="description"
          className={inputClass}
          rows={3}
          required
          defaultValue={descDefault}
          placeholder="Contoh: Beli semen 10 zak"
        />
      </Field>

      <Field label="Bukti (wajib)">
        <ProofCapture onApplySuggestion={applyOcr} />
      </Field>

      {pencairanOptions.length > 0 ? (
        <p className="text-xs text-[var(--ink-faint)]">
          Total sisa pencairan:{" "}
          {formatRupiah(
            pencairanOptions.reduce((s, o) => s + Math.max(0, o.remaining), 0),
          )}
        </p>
      ) : null}

      <button
        type="submit"
        className={`${btnPrimaryClass} w-full min-h-14 text-base`}
        disabled={pending || pencairanOptions.length === 0}
      >
        {pending ? "Mengirim..." : "Simpan bukti belanja"}
      </button>
    </form>
  );
}
