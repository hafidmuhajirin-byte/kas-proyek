"use client";

import { useActionState } from "react";
import { createMandorDisbursementAction } from "@/lib/actions/disbursements";
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
};

export function MandorDisbursementPanel({
  projectId,
  mandors,
  sources,
  rows,
  canEdit,
  overspend,
}: {
  projectId: string;
  mandors: MandorOption[];
  sources: SourceOption[];
  rows: DisbursementRow[];
  canEdit: boolean;
  overspend?: { mandorName: string; amount: number }[];
}) {
  const [state, action, pending] = useActionState(
    createMandorDisbursementAction,
    {},
  );
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-medium text-[var(--ink)]">Dana ke Mandor</h3>
        <p className="text-xs text-[var(--ink-faint)]">
          Pencairan Owner → Mandor (bukan pembayaran klien).
        </p>
      </div>

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
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-[var(--ink-faint)]">Belum ada pencairan.</p>
      )}

      {canEdit && mandors.length > 0 ? (
        <form action={action} className="space-y-3 rounded-lg border border-[var(--line)] p-3">
          <input type="hidden" name="projectId" value={projectId} />
          {state.error ? <Alert>{state.error}</Alert> : null}
          {state.success ? <Alert tone="success">{state.success}</Alert> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Mandor" htmlFor="mandorId">
              <select id="mandorId" name="mandorId" className={inputClass} required>
                {mandors.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Label termin" htmlFor="label">
              <input
                id="label"
                name="label"
                className={inputClass}
                placeholder="Termin 1"
                defaultValue={`Termin ${rows.length + 1}`}
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
              <input id="description" name="description" className={inputClass} />
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
          <button type="submit" className={btnPrimaryClass} disabled={pending}>
            {pending ? "Menyimpan..." : "Catat pencairan"}
          </button>
        </form>
      ) : canEdit ? (
        <p className="text-sm text-[var(--ink-faint)]">
          Belum ada Mandor ditugaskan. Atur di menu Pengguna.
        </p>
      ) : null}
    </div>
  );
}
