"use client";

import { useActionState, useRef, useState } from "react";
import { createAdminLpjNotaAction } from "@/lib/actions/admin-lpj-nota";
import { ProofCapture } from "@/components/ProofCapture";
import { RupiahInput } from "@/components/RupiahInput";
import {
  Alert,
  btnPrimaryClass,
  btnSecondaryClass,
  Field,
  inputClass,
} from "@/components/ui";
import type { ReceiptOcrSuggestion } from "@/lib/receipt-ocr";
import { formatNumberId } from "@/lib/money";
import type { FormState } from "@/lib/actions/projects";

export type AdminLpjCategoryOption = { id: string; name: string };

export function AdminAddLpjNotaForm({
  projectId,
  categories,
}: {
  projectId: string;
  categories: AdminLpjCategoryOption[];
}) {
  const [open, setOpen] = useState(false);
  /** iOS Safari: inject bukti ke FormData (input tersembunyi sering kosong). */
  const proofFileRef = useRef<File | null>(null);
  const [state, action, pending] = useActionState(
    async (prev: FormState, formData: FormData): Promise<FormState> => {
      const proof = proofFileRef.current;
      if (proof && proof.size > 0) {
        formData.set("proof", proof, proof.name || "bukti.jpg");
      }
      return createAdminLpjNotaAction(prev, formData);
    },
    {},
  );
  const [amountKey, setAmountKey] = useState(0);
  const [amountDefault, setAmountDefault] = useState(0);

  function applyOcr(s: ReceiptOcrSuggestion) {
    if (s.amount != null && s.amount > 0) {
      setAmountDefault(s.amount);
      setAmountKey((k) => k + 1);
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  if (!open) {
    return (
      <div className="mb-4">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={btnSecondaryClass}
        >
          + Tambah nota Admin LPJ
        </button>
      </div>
    );
  }

  return (
    <form
      action={action}
      className="mb-6 space-y-4 rounded-lg border border-[var(--line)] bg-[var(--paper-tint)]/40 p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-medium text-[var(--ink)]">Tambah nota Admin LPJ</h3>
          <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
            Masuk LPJ dengan nilai penuh; di Owner tampil Rp 0 (tidak menambah
            Total bukti / Ringkasan dana).
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-[var(--ink-muted)] underline"
        >
          Tutup
        </button>
      </div>

      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.success ? (
        <Alert tone="success">{state.success}</Alert>
      ) : null}

      <input type="hidden" name="projectId" value={projectId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tanggal" htmlFor="admin-lpj-date">
          <input
            id="admin-lpj-date"
            name="date"
            type="date"
            className={inputClass}
            required
            defaultValue={today}
          />
        </Field>

        <Field label="Nominal (nilai LPJ)" htmlFor="admin-lpj-amount">
          <RupiahInput
            key={amountKey}
            id="admin-lpj-amount"
            name="amount"
            defaultValue={amountDefault}
            required
            placeholder={formatNumberId(0)}
          />
        </Field>
      </div>

      <Field label="Uraian" htmlFor="admin-lpj-description">
        <input
          id="admin-lpj-description"
          name="description"
          type="text"
          className={inputClass}
          required
          placeholder="Contoh: Belanja semen toko X"
        />
      </Field>

      <Field label="Kategori" htmlFor="admin-lpj-category">
        <select
          id="admin-lpj-category"
          name="categoryId"
          className={inputClass}
          required
          defaultValue={
            categories.find((c) => c.name === "Belanja Mandor")?.id ??
            categories[0]?.id ??
            ""
          }
        >
          {categories.length === 0 ? (
            <option value="" disabled>
              Belum ada kategori
            </option>
          ) : (
            categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))
          )}
        </select>
      </Field>

      <label className="flex items-center gap-2 text-sm text-[var(--ink)]">
        <input
          type="checkbox"
          name="isMaterialAlam"
          className="rounded border-[var(--line)]"
        />
        Material alam (bebas PPN/PPh)
      </label>

      <Field label="Bukti (wajib)">
        <ProofCapture
          onApplySuggestion={applyOcr}
          onFileChange={(f) => {
            proofFileRef.current = f;
          }}
        />
      </Field>

      <Field label="Atau URL bukti" htmlFor="admin-lpj-proof-url">
        <input
          id="admin-lpj-proof-url"
          name="proofUrl"
          type="text"
          className={inputClass}
          placeholder="https://… atau /uploads/…"
        />
      </Field>

      <button
        type="submit"
        className={btnPrimaryClass}
        disabled={pending || categories.length === 0}
      >
        {pending ? "Menyimpan…" : "Simpan nota Admin LPJ"}
      </button>
    </form>
  );
}
