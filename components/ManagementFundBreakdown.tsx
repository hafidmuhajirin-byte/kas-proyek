"use client";

import { useActionState, useState } from "react";
import { format } from "date-fns";
import {
  createManagementFundExpensesAction,
  deleteManagementFundExpenseAction,
} from "@/lib/actions/management-fund";
import { Alert, btnPrimaryClass, inputClass } from "@/components/ui";
import { formatNumberId, formatRupiah, parseRupiahInput } from "@/lib/money";

type Row = {
  id: string;
  date: Date | string;
  amount: number;
  description: string;
};

type Draft = {
  key: string;
  recipient: string;
  description: string;
  amount: string;
};

function emptyDraft(): Draft {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    recipient: "",
    description: "",
    amount: "",
  };
}

/** Breakdown Dana Pengelolaan — Admin/Owner; terbuku Kas Tunai. */
export function ManagementFundBreakdown({
  projectId,
  planned,
  spent,
  rows,
  canEdit,
}: {
  projectId: string;
  planned: number;
  spent: number;
  rows: Row[];
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([emptyDraft()]);
  const [state, action, pending] = useActionState(
    createManagementFundExpensesAction,
    {},
  );

  const remaining = planned - spent;
  const draftTotal = drafts.reduce(
    (s, d) => s + (parseRupiahInput(d.amount) || 0),
    0,
  );

  return (
    <div className="rounded-lg border border-[var(--line-soft)] bg-[var(--surface)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
        aria-expanded={open}
      >
        <div>
          <p className="text-sm font-medium text-[var(--ink)]">
            Dana pengelolaan
          </p>
          <p className="text-[11px] text-[var(--ink-faint)]">
            Terpakai {formatRupiah(spent)}
            {planned > 0 ? ` · sisa ${formatRupiah(remaining)}` : ""}
            {rows.length > 0 ? ` · ${rows.length} catatan` : ""}
          </p>
        </div>
        <span className="text-xs text-[var(--accent)]">
          {open ? "Tutup" : "Buka"}
        </span>
      </button>

      {open ? (
        <div className="space-y-3 border-t border-[var(--line-soft)] px-3 py-3">
          <p className="text-[11px] text-[var(--ink-faint)]">
            Pecah seperti ke mandor — diisi Admin/Owner, langsung masuk Buku Kas
            Tunai.
          </p>

          {rows.length > 0 ? (
            <ul className="divide-y divide-[var(--line-soft)] rounded-lg border border-[var(--line-soft)] text-sm">
              {rows.map((r) => {
                const d =
                  typeof r.date === "string" ? new Date(r.date) : r.date;
                return (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-start justify-between gap-2 px-2.5 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[var(--ink)]">
                        {r.description}
                      </p>
                      <p className="text-[11px] text-[var(--ink-faint)]">
                        {format(d, "dd/MM/yyyy")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums text-[var(--rose-ink)]">
                        {formatRupiah(r.amount)}
                      </span>
                      {canEdit ? (
                        <form action={deleteManagementFundExpenseAction}>
                          <input type="hidden" name="id" value={r.id} />
                          <input
                            type="hidden"
                            name="projectId"
                            value={projectId}
                          />
                          <button
                            type="submit"
                            className="text-[11px] text-rose-700 underline"
                            onClick={(e) => {
                              if (!confirm("Hapus pencatatan ini dari kas?")) {
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
                );
              })}
            </ul>
          ) : (
            <p className="text-xs text-[var(--ink-faint)]">
              Belum ada pencatatan.
            </p>
          )}

          {canEdit ? (
            <form action={action} className="space-y-2">
              <input type="hidden" name="projectId" value={projectId} />
              {state.error ? <Alert>{state.error}</Alert> : null}
              {state.success ? (
                <Alert tone="success">{state.success}</Alert>
              ) : null}
              <label className="block text-xs">
                <span className="mb-1 block text-[var(--ink-faint)]">
                  Tanggal
                </span>
                <input
                  type="date"
                  name="date"
                  required
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  className={inputClass}
                />
              </label>

              <div className="space-y-2">
                {drafts.map((d, idx) => (
                  <div
                    key={d.key}
                    className="grid gap-1.5 rounded-lg border border-[var(--line-soft)] p-2 sm:grid-cols-[1fr_1.4fr_0.9fr_auto]"
                  >
                    <input
                      name="lineRecipient"
                      placeholder="Ke (opsional)"
                      value={d.recipient}
                      onChange={(e) => {
                        const next = [...drafts];
                        next[idx] = { ...d, recipient: e.target.value };
                        setDrafts(next);
                      }}
                      className={inputClass}
                    />
                    <input
                      name="lineDescription"
                      placeholder="Keterangan"
                      value={d.description}
                      onChange={(e) => {
                        const next = [...drafts];
                        next[idx] = { ...d, description: e.target.value };
                        setDrafts(next);
                      }}
                      className={inputClass}
                      required={Boolean(d.amount.trim())}
                    />
                    <input
                      name="lineAmount"
                      inputMode="numeric"
                      placeholder="Nominal"
                      value={d.amount}
                      onChange={(e) => {
                        const next = [...drafts];
                        next[idx] = { ...d, amount: e.target.value };
                        setDrafts(next);
                      }}
                      onBlur={() => {
                        const n = parseRupiahInput(d.amount);
                        if (!n) return;
                        const next = [...drafts];
                        next[idx] = { ...d, amount: formatNumberId(n) };
                        setDrafts(next);
                      }}
                      className={inputClass}
                    />
                    <button
                      type="button"
                      className="text-xs text-rose-700 underline disabled:opacity-40"
                      disabled={drafts.length <= 1}
                      onClick={() =>
                        setDrafts((rows) => rows.filter((_, i) => i !== idx))
                      }
                    >
                      Hapus
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  className="text-xs text-[var(--accent)] underline"
                  onClick={() => setDrafts((rows) => [...rows, emptyDraft()])}
                >
                  + Baris
                </button>
                <p className="text-xs tabular-nums text-[var(--ink-faint)]">
                  Total {formatRupiah(draftTotal)}
                </p>
              </div>

              <button
                type="submit"
                className={btnPrimaryClass}
                disabled={pending || draftTotal <= 0}
              >
                {pending ? "Menyimpan..." : "Catat ke Kas Tunai"}
              </button>
            </form>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
