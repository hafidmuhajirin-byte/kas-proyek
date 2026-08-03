"use client";

import { useActionState, useState } from "react";
import {
  createMandorExpenseLineAction,
  deleteMandorExpenseLineAction,
} from "@/lib/actions/mandor-expense-lines";
import { RupiahInput } from "@/components/RupiahInput";
import {
  Alert,
  btnPrimaryClass,
  Field,
  inputClass,
} from "@/components/ui";
import { formatRupiah } from "@/lib/money";
import { tidyCase } from "@/lib/text";

export type ExpenseLineRow = {
  id: string;
  kind: "MATERIAL" | "LABOR";
  description: string;
  quantity: number | null;
  unit: string | null;
  workDays: number | null;
  dailyRate: number | null;
  amount: number;
};

export function MandorExpenseBreakdownForm({
  transactionId,
  proofAmount,
  lines,
  canEdit,
}: {
  transactionId: string;
  proofAmount: number;
  lines: ExpenseLineRow[];
  canEdit: boolean;
}) {
  const [state, action, pending] = useActionState(
    createMandorExpenseLineAction,
    {},
  );
  const [kind, setKind] = useState<"MATERIAL" | "LABOR">("MATERIAL");
  const used = lines.reduce((s, l) => s + l.amount, 0);
  const remaining = proofAmount - used;

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-teal-900/10 bg-teal-950/[0.02] p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <p className="font-medium text-teal-950">Pecahan Admin</p>
        <p className="text-xs text-teal-900/55">
          Terpakai {formatRupiah(used)} · Sisa {formatRupiah(remaining)}
        </p>
      </div>

      {lines.length > 0 ? (
        <ul className="divide-y divide-teal-900/8 rounded-md border border-teal-900/10 bg-white text-sm">
          {lines.map((l) => (
            <li
              key={l.id}
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="font-medium text-teal-950">
                  {l.kind === "MATERIAL" ? "Bahan" : "Pekerja"} ·{" "}
                  {tidyCase(l.description)}
                </p>
                <p className="text-xs text-teal-900/55">
                  {l.kind === "MATERIAL"
                    ? [
                        l.quantity != null ? `qty ${l.quantity}` : null,
                        l.unit,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "—"
                    : [
                        l.workDays != null ? `${l.workDays} hari` : null,
                        l.dailyRate
                          ? `${formatRupiah(l.dailyRate)}/hari`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="tabular-nums text-rose-800">
                  {formatRupiah(l.amount)}
                </span>
                {canEdit ? (
                  <form action={deleteMandorExpenseLineAction}>
                    <input type="hidden" name="id" value={l.id} />
                    <button
                      type="submit"
                      className="text-xs text-rose-700 underline"
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
        <p className="text-xs text-teal-900/55">Belum dipecah.</p>
      )}

      {canEdit && remaining > 0 ? (
        <form action={action} className="space-y-3 border-t border-teal-900/8 pt-3">
          <input type="hidden" name="transactionId" value={transactionId} />
          {state.error ? <Alert>{state.error}</Alert> : null}
          {state.success ? (
            <p className="text-sm text-emerald-800">{state.success}</p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Jenis" htmlFor={`kind-${transactionId}`}>
              <select
                id={`kind-${transactionId}`}
                name="kind"
                className={inputClass}
                value={kind}
                onChange={(e) =>
                  setKind(e.target.value as "MATERIAL" | "LABOR")
                }
              >
                <option value="MATERIAL">Bahan</option>
                <option value="LABOR">Pekerja + harian</option>
              </select>
            </Field>
            <Field label="Nominal" htmlFor={`amt-${transactionId}`}>
              <RupiahInput
                id={`amt-${transactionId}`}
                name="amount"
                required
                defaultValue={0}
              />
            </Field>
          </div>

          <Field label="Keterangan / nama" htmlFor={`desc-${transactionId}`}>
            <input
              id={`desc-${transactionId}`}
              name="description"
              className={inputClass}
              required
              placeholder={
                kind === "MATERIAL" ? "Semen 40kg" : "Nama pekerja"
              }
            />
          </Field>

          {kind === "MATERIAL" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Qty" htmlFor={`qty-${transactionId}`}>
                <input
                  id={`qty-${transactionId}`}
                  name="quantity"
                  type="number"
                  step="any"
                  className={inputClass}
                  placeholder="10"
                />
              </Field>
              <Field label="Satuan" htmlFor={`unit-${transactionId}`}>
                <input
                  id={`unit-${transactionId}`}
                  name="unit"
                  className={inputClass}
                  placeholder="zak"
                />
              </Field>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Hari kerja" htmlFor={`days-${transactionId}`}>
                <input
                  id={`days-${transactionId}`}
                  name="workDays"
                  type="number"
                  step="any"
                  className={inputClass}
                  placeholder="3"
                />
              </Field>
              <Field label="Upah / hari" htmlFor={`rate-${transactionId}`}>
                <RupiahInput
                  id={`rate-${transactionId}`}
                  name="dailyRate"
                  defaultValue={0}
                />
              </Field>
            </div>
          )}

          <button
            type="submit"
            className={`${btnPrimaryClass} min-h-11`}
            disabled={pending}
          >
            {pending ? "Menyimpan…" : "Tambah pecahan"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
