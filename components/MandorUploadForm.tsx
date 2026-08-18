"use client";

import { useActionState, useRef, useState } from "react";
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
import type { FormState } from "@/lib/actions/projects";

/** Form upload bukti — proyek sudah terkunci. */
export function MandorUploadForm({
  projectId,
  projectName,
  hasPencairan = true,
}: {
  projectId: string;
  projectName: string;
  hasPencairan?: boolean;
}) {
  /** iOS Safari sering gagal mengirim file lewat input tersembunyi + DataTransfer. */
  const proofFileRef = useRef<File | null>(null);
  const [proofReady, setProofReady] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  const [amountKey, setAmountKey] = useState(0);
  const [amountDefault, setAmountDefault] = useState(0);

  const [state, action, pending] = useActionState(
    async (prev: FormState, formData: FormData): Promise<FormState> => {
      const proof = proofFileRef.current;
      if (!proof || proof.size <= 0) {
        return { error: "Bukti foto/nota wajib diunggah." };
      }
      formData.set("proof", proof, proof.name || "bukti.jpg");
      return createMandorExpenseAction(prev, formData);
    },
    {},
  );

  function applyOcr(s: ReceiptOcrSuggestion) {
    if (s.amount != null && s.amount > 0) {
      setAmountDefault(s.amount);
      setAmountKey((k) => k + 1);
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const error = clientError || state.error;

  return (
    <form
      action={action}
      className="space-y-4"
      onSubmit={(e) => {
        setClientError(null);
        if (!proofFileRef.current || proofFileRef.current.size <= 0) {
          e.preventDefault();
          setClientError("Ambil foto atau pilih dari galeri dulu sebelum simpan.");
        }
      }}
    >
      {error ? <Alert>{error}</Alert> : null}

      <input type="hidden" name="projectId" value={projectId} />
      <p className="rounded-lg border border-teal-200/80 bg-teal-50/70 px-3 py-2 text-sm text-teal-950">
        Bukti untuk: <span className="font-medium">{projectName}</span>
      </p>

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
        <ProofCapture
          onApplySuggestion={applyOcr}
          onFileChange={(f) => {
            proofFileRef.current = f;
            setProofReady(Boolean(f && f.size > 0));
            setClientError(null);
          }}
        />
      </Field>

      {!hasPencairan ? (
        <p className="text-sm text-amber-900">
          Belum ada dana cair dari Owner untuk proyek ini. Hubungi Owner dulu.
        </p>
      ) : null}

      <button
        type="submit"
        className={`${btnPrimaryClass} w-full min-h-14 text-base`}
        disabled={pending || !hasPencairan || !proofReady}
      >
        {pending ? "Mengirim..." : "Simpan bukti belanja"}
      </button>
    </form>
  );
}
