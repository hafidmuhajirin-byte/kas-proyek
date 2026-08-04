"use client";

import { useActionState, useState } from "react";
import {
  createMandorDisbursementAction,
  deleteMandorDisbursementAction,
} from "@/lib/actions/disbursements";
import { RupiahInput } from "@/components/RupiahInput";
import { ProofReviewLink } from "@/components/ProofReviewLink";
import {
  Alert,
  btnPrimaryClass,
  Field,
  inputClass,
} from "@/components/ui";
import { formatRupiah } from "@/lib/money";

type MandorOption = { id: string; name: string };
type SourceOption = { id: string; name: string };
type DisbursementRow = {
  id: string;
  date: string;
  label: string;
  amount: number;
  mandorName: string;
  proofUrl: string | null;
  /** false = orphan tanpa transaksi Kas Besar */
  hasKasBesar?: boolean;
};

export function MandorDisbursementPanel({
  projectId,
  mandors,
  sources,
  rows,
  canEdit,
  overspend,
  compact = false,
}: {
  projectId: string;
  mandors: MandorOption[];
  sources: SourceOption[];
  rows: DisbursementRow[];
  canEdit: boolean;
  overspend?: { mandorName: string; amount: number }[];
  /** true = tanpa judul besar (sudah di dalam panel pemborong) */
  compact?: boolean;
}) {
  const [state, action, pending] = useActionState(
    createMandorDisbursementAction,
    {},
  );
  const [formOpen, setFormOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const nextLabel = `Termin ${rows.filter((r) => r.hasKasBesar !== false).length + 1}`;
  const totalCair = rows
    .filter((r) => r.hasKasBesar !== false)
    .reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-4">
      {!compact ? (
        <div>
          <h3 className="font-medium text-[var(--ink)]">Dana ke Mandor</h3>
          <p className="text-xs text-[var(--ink-faint)]">
            Pencairan Owner → Mandor (bukan pembayaran klien).
          </p>
        </div>
      ) : (
        <div>
          <h3 className="text-base font-medium text-teal-950">Dana ke Mandor</h3>
          <p className="mt-0.5 text-sm text-teal-900/55">
            {rows.length} pencairan · {formatRupiah(totalCair)}
          </p>
        </div>
      )}

      {overspend && overspend.length > 0 ? (
        <div className="space-y-2 rounded-lg border border-rose-300 bg-rose-50 px-3 py-3 text-sm text-rose-950">
          <p className="font-medium">Alarm: bukti melebihi dana cair</p>
          {overspend.map((o) => (
            <p key={o.mandorName}>
              {o.mandorName}: kelebihan {formatRupiah(o.amount)} — segera
              berikan dana berikutnya.
            </p>
          ))}
        </div>
      ) : null}

      {rows.length > 0 ? (
        <ul className="divide-y divide-[var(--line-soft)] rounded-lg border border-[var(--line)]">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium">
                  {r.label} · {r.mandorName}
                  {r.hasKasBesar === false ? (
                    <span className="ml-1.5 text-[11px] font-normal text-amber-800">
                      (duplikat / belum ke Kas Besar)
                    </span>
                  ) : null}
                </p>
                <p className="text-xs text-[var(--ink-faint)]">{r.date}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="tabular-nums">{formatRupiah(r.amount)}</span>
                {r.proofUrl ? (
                  <ProofReviewLink
                    href={r.proofUrl}
                    title={`${r.label} · ${r.mandorName}`}
                    className="text-[var(--accent)] underline"
                  >
                    Bukti
                  </ProofReviewLink>
                ) : null}
                {canEdit ? (
                  <form action={deleteMandorDisbursementAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <button
                      type="submit"
                      className="text-rose-700 underline"
                      onClick={(e) => {
                        if (
                          !confirm(
                            r.hasKasBesar === false
                              ? "Hapus baris duplikat ini?"
                              : "Hapus pencairan ini beserta transaksi Kas Besar?",
                          )
                        ) {
                          e.preventDefault();
                        }
                      }}
                    >
                      Hapus
                    </button>
                  </form>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-[var(--ink-faint)]">Belum ada pencairan.</p>
      )}

      {canEdit && mandors.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-[var(--line)]">
          <button
            type="button"
            onClick={() => setFormOpen((o) => !o)}
            className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition hover:bg-[var(--surface-2)]"
            aria-expanded={formOpen}
          >
            <span className="font-medium text-[var(--ink)]">
              {formOpen ? "Catat pencairan" : "+ Catat pencairan"}
            </span>
            <svg
              className={`h-5 w-5 shrink-0 text-[var(--ink-faint)] transition-transform duration-200 ${
                formOpen ? "rotate-180" : ""
              }`}
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          {formOpen ? (
            <form
              action={action}
              className="space-y-3 border-t border-[var(--line)] p-3"
            >
              <input type="hidden" name="projectId" value={projectId} />
              {state.error ? <Alert>{state.error}</Alert> : null}
              {state.success ? (
                <Alert tone="success">{state.success}</Alert>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Mandor" htmlFor="mandorId">
                  <select
                    id="mandorId"
                    name="mandorId"
                    className={inputClass}
                    required
                  >
                    {mandors.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Label pencairan" htmlFor="label">
                  <input
                    id="label"
                    name="label"
                    className={inputClass}
                    placeholder="Termin 1"
                    defaultValue={nextLabel}
                    required
                  />
                </Field>
                <Field label="Tanggal" htmlFor="date">
                  <input
                    id="date"
                    name="date"
                    type="date"
                    className={inputClass}
                    defaultValue={today}
                    required
                  />
                </Field>
                <Field label="Sumber kas" htmlFor="cashSourceId">
                  <select
                    id="cashSourceId"
                    name="cashSourceId"
                    className={inputClass}
                    required
                  >
                    {sources.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Nominal" htmlFor="amount">
                  <RupiahInput id="amount" name="amount" required />
                </Field>
                <Field label="Keterangan" htmlFor="description">
                  <input
                    id="description"
                    name="description"
                    className={inputClass}
                  />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="isFromGlobalCash" />
                Dari kas besar (bukan kas proyek)
              </label>
              <Field label="Bukti (opsional)" htmlFor="proof">
                <input
                  id="proof"
                  name="proof"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className={inputClass}
                />
              </Field>
              <button
                type="submit"
                className={btnPrimaryClass}
                disabled={pending}
              >
                {pending ? "Menyimpan..." : "Catat pencairan"}
              </button>
            </form>
          ) : null}
        </div>
      ) : canEdit ? (
        <p className="text-sm text-[var(--ink-faint)]">
          Belum ada Mandor ditugaskan. Atur di menu Pengguna.
        </p>
      ) : null}
    </div>
  );
}
