"use client";

import { useActionState, useState } from "react";
import { createMandorExpenseAction } from "@/lib/actions/mandor-expense";
import { MANDOR_EXPENSE_DESCRIPTIONS } from "@/lib/mandor-expense-labels";
import { ProofCapture } from "@/components/ProofCapture";
import { RupiahInput } from "@/components/RupiahInput";
import {
  Alert,
  btnPrimaryClass,
  Field,
  inputClass,
} from "@/components/ui";
import type { ReceiptOcrSuggestion } from "@/lib/receipt-ocr";
import { formatNumberId } from "@/lib/money";

type ProjectOption = { id: string; name: string };

export function MandorUploadForm({
  projects,
  defaultProjectId,
  hasPencairan = true,
}: {
  projects: ProjectOption[];
  defaultProjectId?: string;
  /** Ada dana cair Mandor di proyek default / setidaknya satu proyek. */
  hasPencairan?: boolean;
}) {
  const [state, action, pending] = useActionState(createMandorExpenseAction, {});
  const [amountKey, setAmountKey] = useState(0);
  const [amountDefault, setAmountDefault] = useState(0);
  const [projectId, setProjectId] = useState(
    defaultProjectId ?? projects[0]?.id ?? "",
  );

  function applyOcr(s: ReceiptOcrSuggestion) {
    if (s.amount != null && s.amount > 0) {
      setAmountDefault(s.amount);
      setAmountKey((k) => k + 1);
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
        <select
          id="description"
          name="description"
          className={inputClass}
          required
          defaultValue=""
        >
          <option value="" disabled>
            Pilih keterangan…
          </option>
          {MANDOR_EXPENSE_DESCRIPTIONS.map((label) => (
            <option key={label} value={label}>
              {label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Bukti (wajib)">
        <ProofCapture onApplySuggestion={applyOcr} />
      </Field>

      {!hasPencairan ? (
        <p className="text-sm text-amber-900">
          Belum ada dana cair dari Owner untuk proyek Anda. Hubungi Owner dulu.
        </p>
      ) : null}

      <button
        type="submit"
        className={`${btnPrimaryClass} w-full min-h-14 text-base`}
        disabled={pending || !hasPencairan}
      >
        {pending ? "Mengirim..." : "Simpan bukti belanja"}
      </button>
    </form>
  );
}
