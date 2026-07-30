"use client";

import { useActionState } from "react";
import { createMandorExpenseAction } from "@/lib/actions/mandor-expense";
import { ProofCapture } from "@/components/ProofCapture";
import { RupiahInput } from "@/components/RupiahInput";
import {
  Alert,
  btnPrimaryClass,
  Field,
  inputClass,
} from "@/components/ui";
import { useState } from "react";
import type { ReceiptOcrSuggestion } from "@/lib/receipt-ocr";
import { formatNumberId } from "@/lib/money";

type ProjectOption = { id: string; name: string };

export function MandorUploadForm({
  projects,
  defaultProjectId,
}: {
  projects: ProjectOption[];
  defaultProjectId?: string;
}) {
  const [state, action, pending] = useActionState(createMandorExpenseAction, {});
  const [amountKey, setAmountKey] = useState(0);
  const [amountDefault, setAmountDefault] = useState(0);
  const [descKey, setDescKey] = useState(0);
  const [descDefault, setDescDefault] = useState("");

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
          defaultValue={defaultProjectId ?? projects[0]?.id}
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

      <Field label="Bukti (wajib)" htmlFor="proof">
        <ProofCapture onApplySuggestion={applyOcr} />
      </Field>

      <button
        type="submit"
        className={`${btnPrimaryClass} w-full min-h-14 text-base`}
        disabled={pending}
      >
        {pending ? "Mengirim..." : "Simpan bukti belanja"}
      </button>
    </form>
  );
}
