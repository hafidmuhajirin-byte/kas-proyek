"use client";

import { useActionState, useMemo, useState } from "react";
import {
  approveMandorExpenseBreakdownAction,
  rejectMandorExpenseBreakdownAction,
  reopenMandorExpenseBreakdownAction,
  saveMandorExpenseBreakdownAction,
} from "@/lib/actions/mandor-expense-lines";
import { Alert } from "@/components/ui";
import { formatNumberId, formatRupiah, parseRupiahInput } from "@/lib/money";
import { tidyCase } from "@/lib/text";

export type ExpenseLineRow = {
  id: string;
  kind: "MATERIAL" | "LABOR";
  description: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  workDays: number | null;
  dailyRate: number | null;
  amount: number;
};

export type BreakdownStatus = "PENDING" | "APPROVED" | "REJECTED";

type DraftRow = {
  key: string;
  quantity: string;
  unit: string;
  description: string;
  unitPrice: string;
  amount: string;
};

function emptyRow(kind: "MATERIAL" | "LABOR"): DraftRow {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    quantity: "",
    unit: kind === "LABOR" ? "hari" : "",
    description: "",
    unitPrice: "",
    amount: "",
  };
}

function linesToDrafts(
  lines: ExpenseLineRow[],
  kind: "MATERIAL" | "LABOR",
): DraftRow[] {
  if (lines.length === 0) return [emptyRow(kind)];
  return lines.map((l) => {
    const qty = l.quantity ?? l.workDays;
    const price = l.unitPrice ?? l.dailyRate;
    return {
      key: l.id,
      quantity: qty != null ? String(qty) : "",
      unit: l.unit ?? (kind === "LABOR" ? "hari" : ""),
      description: l.description,
      unitPrice: price != null && price > 0 ? formatNumberId(price) : "",
      amount: l.amount > 0 ? formatNumberId(l.amount) : "",
    };
  });
}

function parseQty(raw: string): number | null {
  const t = raw.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const cell =
  "min-h-8 w-full rounded border border-teal-900/15 bg-white px-1.5 py-1 text-xs outline-none focus:border-teal-600";

export function MandorExpenseBreakdownForm({
  transactionId,
  proofAmount,
  lines,
  canEdit,
  vendor = null,
  status = "PENDING",
  rejectNote = null,
}: {
  transactionId: string;
  proofAmount: number;
  lines: ExpenseLineRow[];
  canEdit: boolean;
  vendor?: string | null;
  status?: BreakdownStatus;
  rejectNote?: string | null;
}) {
  const initialKind =
    lines[0]?.kind ?? ("MATERIAL" as "MATERIAL" | "LABOR");
  const [kind, setKind] = useState<"MATERIAL" | "LABOR">(initialKind);
  const [vendorName, setVendorName] = useState(vendor ?? "");
  const [rows, setRows] = useState<DraftRow[]>(() =>
    linesToDrafts(lines, initialKind),
  );
  const [rejectOpen, setRejectOpen] = useState(false);

  const [saveState, saveAction, savePending] = useActionState(
    saveMandorExpenseBreakdownAction,
    {},
  );
  const [rejectState, rejectAction, rejectPending] = useActionState(
    rejectMandorExpenseBreakdownAction,
    {},
  );

  const draftTotal = useMemo(() => {
    return rows.reduce((s, r) => s + parseRupiahInput(r.amount), 0);
  }, [rows]);

  const matches = draftTotal === proofAmount && draftTotal > 0;
  const savedTotal = lines.reduce((s, l) => s + l.amount, 0);
  const savedMatches = savedTotal === proofAmount && lines.length > 0;

  function updateRow(
    key: string,
    patch: Partial<DraftRow>,
    source: "qty" | "price" | "amount" | "other",
  ) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r;
        const next = { ...r, ...patch };
        const qty = parseQty(next.quantity);
        if (source === "qty" || source === "price") {
          const price = parseRupiahInput(next.unitPrice);
          if (qty != null && qty > 0 && price > 0) {
            next.amount = formatNumberId(Math.round(qty * price));
          }
        } else if (source === "amount") {
          const amount = parseRupiahInput(next.amount);
          if (qty != null && qty > 0 && amount > 0) {
            next.unitPrice = formatNumberId(Math.round(amount / qty));
          }
        }
        return next;
      }),
    );
  }

  function switchKind(next: "MATERIAL" | "LABOR") {
    setKind(next);
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        unit: r.unit || (next === "LABOR" ? "hari" : r.unit),
      })),
    );
  }

  if (status === "APPROVED" && !canEdit) {
    return (
      <ApprovedSummary
        kind={initialKind}
        vendor={vendor}
        lines={lines}
        proofAmount={proofAmount}
      />
    );
  }

  if (status === "APPROVED" && canEdit) {
    return (
      <div className="mt-2 space-y-2 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2.5">
        <ApprovedSummary
          kind={initialKind}
          vendor={vendor}
          lines={lines}
          proofAmount={proofAmount}
        />
        <form action={reopenMandorExpenseBreakdownAction}>
          <input type="hidden" name="transactionId" value={transactionId} />
          <button type="submit" className="text-xs text-teal-700 underline">
            Buka ulang pecahan
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-teal-900/10 bg-teal-950/[0.02] p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-teal-950">Pecahan Admin</p>
        <p
          className={`text-[11px] tabular-nums ${
            matches ? "text-emerald-700" : "text-teal-900/55"
          }`}
        >
          Total {formatRupiah(draftTotal)}
          {matches ? " · sesuai nota" : ` · nota ${formatRupiah(proofAmount)}`}
        </p>
      </div>

      {status === "REJECTED" ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-2 text-xs text-rose-950">
          <p className="font-medium">Ditolak — minta foto/nota ulang</p>
          {rejectNote ? <p className="mt-0.5">{rejectNote}</p> : null}
        </div>
      ) : null}

      {canEdit ? (
        <>
          <div className="flex flex-wrap gap-3 text-xs">
            <label className="inline-flex items-center gap-1.5">
              <input
                type="radio"
                name={`kind-${transactionId}`}
                checked={kind === "MATERIAL"}
                onChange={() => switchKind("MATERIAL")}
              />
              Pembelian bahan
            </label>
            <label className="inline-flex items-center gap-1.5">
              <input
                type="radio"
                name={`kind-${transactionId}`}
                checked={kind === "LABOR"}
                onChange={() => switchKind("LABOR")}
              />
              Bayar pekerja
            </label>
          </div>

          {kind === "MATERIAL" ? (
            <input
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              placeholder="Nama toko (opsional), mis. Toko bangunan OPOJARE"
              className={`${cell} text-sm`}
            />
          ) : null}

          <div className="overflow-x-auto rounded border border-teal-900/10 bg-white">
            <table className="w-full min-w-[520px] border-collapse text-left text-[11px]">
              <thead>
                <tr className="border-b border-teal-900/10 bg-teal-950/[0.03] text-teal-900/55">
                  <th className="w-12 px-1.5 py-1.5 font-medium">Qty</th>
                  <th className="w-12 px-1.5 py-1.5 font-medium">Sat</th>
                  <th className="px-1.5 py-1.5 font-medium">Keterangan</th>
                  <th className="w-[7.5rem] px-1.5 py-1.5 font-medium">
                    {kind === "LABOR" ? "Upah/hari" : "Harga sat"}
                  </th>
                  <th className="w-[7.5rem] px-1.5 py-1.5 font-medium">
                    Jumlah
                  </th>
                  <th className="w-8 px-1 py-1.5" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} className="border-b border-teal-900/6">
                    <td className="px-1 py-1 align-top">
                      <input
                        className={cell}
                        inputMode="decimal"
                        value={r.quantity}
                        placeholder="1"
                        onChange={(e) =>
                          updateRow(r.key, { quantity: e.target.value }, "qty")
                        }
                      />
                    </td>
                    <td className="px-1 py-1 align-top">
                      <input
                        className={cell}
                        value={r.unit}
                        placeholder={kind === "LABOR" ? "hari" : "m3"}
                        onChange={(e) =>
                          updateRow(r.key, { unit: e.target.value }, "other")
                        }
                      />
                    </td>
                    <td className="px-1 py-1 align-top">
                      <input
                        className={cell}
                        value={r.description}
                        placeholder={
                          kind === "LABOR" ? "Nama pekerja" : "Hebel, besi…"
                        }
                        onChange={(e) =>
                          updateRow(
                            r.key,
                            { description: e.target.value },
                            "other",
                          )
                        }
                      />
                    </td>
                    <td className="px-1 py-1 align-top">
                      <input
                        className={cell}
                        inputMode="numeric"
                        value={r.unitPrice}
                        placeholder="0"
                        onChange={(e) => {
                          const n = parseRupiahInput(e.target.value);
                          updateRow(
                            r.key,
                            {
                              unitPrice: n > 0 ? formatNumberId(n) : "",
                            },
                            "price",
                          );
                        }}
                      />
                    </td>
                    <td className="px-1 py-1 align-top">
                      <input
                        className={cell}
                        inputMode="numeric"
                        value={r.amount}
                        placeholder="0"
                        onChange={(e) => {
                          const n = parseRupiahInput(e.target.value);
                          updateRow(
                            r.key,
                            { amount: n > 0 ? formatNumberId(n) : "" },
                            "amount",
                          );
                        }}
                      />
                    </td>
                    <td className="px-1 py-1 align-top text-center">
                      {rows.length > 1 ? (
                        <button
                          type="button"
                          className="text-rose-600"
                          title="Hapus baris"
                          onClick={() =>
                            setRows((prev) =>
                              prev.filter((x) => x.key !== r.key),
                            )
                          }
                        >
                          ×
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-teal-950/[0.03] text-xs">
                  <td colSpan={4} className="px-1.5 py-1.5 text-right font-medium">
                    Total
                  </td>
                  <td
                    className={`px-1.5 py-1.5 tabular-nums font-medium ${
                      matches ? "text-emerald-700" : "text-rose-800"
                    }`}
                  >
                    {formatRupiah(draftTotal)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="text-xs text-teal-700 underline"
              onClick={() => setRows((prev) => [...prev, emptyRow(kind)])}
            >
              + Baris
            </button>

            <form action={saveAction} className="contents">
              <input type="hidden" name="transactionId" value={transactionId} />
              <input type="hidden" name="kind" value={kind} />
              <input type="hidden" name="vendor" value={vendorName} />
              <input
                type="hidden"
                name="linesJson"
                value={JSON.stringify(
                  rows
                    .filter((r) => r.description.trim() && parseRupiahInput(r.amount) > 0)
                    .map((r) => ({
                      description: r.description.trim(),
                      quantity: parseQty(r.quantity),
                      unit: r.unit.trim() || null,
                      unitPrice: parseRupiahInput(r.unitPrice) || null,
                      amount: parseRupiahInput(r.amount),
                    })),
                )}
              />
              <button
                type="submit"
                disabled={savePending}
                className="rounded-md bg-teal-800 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
              >
                {savePending ? "Menyimpan…" : "Simpan pecahan"}
              </button>
            </form>

            {savedMatches ? (
              <form action={approveMandorExpenseBreakdownAction}>
                <input type="hidden" name="transactionId" value={transactionId} />
                <button
                  type="submit"
                  className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white"
                >
                  Setujui (sesuai nota)
                </button>
              </form>
            ) : null}

            <button
              type="button"
              className="rounded-md border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-800"
              onClick={() => setRejectOpen((v) => !v)}
            >
              Tolak
            </button>
          </div>

          {saveState.error ? <Alert>{saveState.error}</Alert> : null}
          {saveState.success ? (
            <p className="text-xs text-emerald-800">{saveState.success}</p>
          ) : null}

          {rejectOpen ? (
            <form action={rejectAction} className="space-y-2 border-t border-teal-900/8 pt-2">
              <input type="hidden" name="transactionId" value={transactionId} />
              <textarea
                name="note"
                required
                rows={2}
                className={`${cell} text-sm`}
                placeholder="Alasan tolak, mis. foto buram / nominal tidak terbaca — minta kirim ulang"
              />
              <button
                type="submit"
                disabled={rejectPending}
                className="rounded-md bg-rose-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
              >
                {rejectPending ? "Mengirim…" : "Kirim penolakan ke Mandor"}
              </button>
              {rejectState.error ? <Alert>{rejectState.error}</Alert> : null}
              {rejectState.success ? (
                <p className="text-xs text-emerald-800">{rejectState.success}</p>
              ) : null}
            </form>
          ) : null}
        </>
      ) : lines.length > 0 ? (
        <ReadonlyTable kind={initialKind} vendor={vendor} lines={lines} />
      ) : (
        <p className="text-xs text-teal-900/55">Belum dipecah.</p>
      )}
    </div>
  );
}

function ApprovedSummary({
  kind,
  vendor,
  lines,
  proofAmount,
}: {
  kind: "MATERIAL" | "LABOR";
  vendor: string | null | undefined;
  lines: ExpenseLineRow[];
  proofAmount: number;
}) {
  return (
    <div className="mt-2 space-y-1.5 rounded-lg border border-emerald-200 bg-emerald-50/50 px-2.5 py-2">
      <p className="text-xs font-medium text-emerald-900">
        ✓ Disetujui ·{" "}
        {kind === "MATERIAL" ? "Pembelian bahan" : "Bayar pekerja"}
        {vendor ? ` · ${tidyCase(vendor)}` : ""} · {formatRupiah(proofAmount)}
      </p>
      <ReadonlyTable kind={kind} vendor={null} lines={lines} compact />
    </div>
  );
}

function ReadonlyTable({
  kind,
  vendor,
  lines,
  compact,
}: {
  kind: "MATERIAL" | "LABOR";
  vendor: string | null | undefined;
  lines: ExpenseLineRow[];
  compact?: boolean;
}) {
  const total = lines.reduce((s, l) => s + l.amount, 0);
  return (
    <div className={compact ? "" : "overflow-x-auto"}>
      {vendor ? (
        <p className="mb-1 text-[11px] text-teal-900/55">{tidyCase(vendor)}</p>
      ) : null}
      <table className="w-full text-left text-[11px]">
        <thead>
          <tr className="text-teal-900/50">
            <th className="pr-2 font-medium">Qty</th>
            <th className="pr-2 font-medium">Sat</th>
            <th className="pr-2 font-medium">Keterangan</th>
            <th className="pr-2 text-right font-medium">
              {kind === "LABOR" ? "Upah" : "Harga"}
            </th>
            <th className="text-right font-medium">Jumlah</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => {
            const qty = l.quantity ?? l.workDays;
            const price = l.unitPrice ?? l.dailyRate;
            return (
              <tr key={l.id} className="border-t border-teal-900/5">
                <td className="py-0.5 pr-2 tabular-nums">{qty ?? "—"}</td>
                <td className="py-0.5 pr-2">{l.unit ?? "—"}</td>
                <td className="py-0.5 pr-2">{tidyCase(l.description)}</td>
                <td className="py-0.5 pr-2 text-right tabular-nums">
                  {price != null ? formatRupiah(price) : "—"}
                </td>
                <td className="py-0.5 text-right tabular-nums text-rose-800">
                  {formatRupiah(l.amount)}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-teal-900/10 font-medium">
            <td colSpan={4} className="pt-1 text-right">
              Total
            </td>
            <td className="pt-1 text-right tabular-nums">{formatRupiah(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
