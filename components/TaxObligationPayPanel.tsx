"use client";

import { useActionState, useState } from "react";
import { payTaxObligationAction } from "@/lib/actions/tax-obligations";
import { formatRupiah } from "@/lib/money";
import { btnPrimaryClass, btnSecondaryClass } from "@/components/ui";
import { ProofReviewLink } from "@/components/ProofReviewLink";

export type TaxObligationPayItem = {
  id: string;
  kindLabel: string;
  taxAmount: number;
  label: string;
  monthKey: string;
  sourceDescription: string | null;
  sourceDate: string | null;
};

/**
 * Pemberitahuan pengeluaran terhutang — klik untuk daftar pajak yang harus dibayar.
 */
export function TaxTerhutangNotice({
  unpaid,
  total,
}: {
  unpaid: TaxObligationPayItem[];
  total: number;
}) {
  const [open, setOpen] = useState(false);
  const [payId, setPayId] = useState<string | null>(null);

  if (unpaid.length === 0) return null;

  return (
    <div className="mb-3 print:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-3 rounded-xl border border-amber-300/90 bg-amber-50 px-3 py-3 text-left transition hover:bg-amber-100/80 sm:px-4"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <p className="text-sm font-medium text-amber-950">
            Pengeluaran terhutang · {formatRupiah(total)}
          </p>
          <p className="mt-0.5 text-xs text-amber-900/70">
            {unpaid.length} pajak menunggu pembayaran.{" "}
            {open ? "Klik untuk menutup." : "Klik untuk melihat daftar & bayar."}
          </p>
        </div>
        <span className="shrink-0 text-xs font-medium text-amber-900/80 underline">
          {open ? "Tutup" : "Lihat"}
        </span>
      </button>

      {open ? (
        <ul className="mt-2 space-y-2 rounded-xl border border-amber-200/80 bg-[#fffcf7] p-2 sm:p-3">
          {unpaid.map((item) => {
            const paying = payId === item.id;
            return (
              <li
                key={item.id}
                className="rounded-lg border border-teal-900/10 bg-white px-3 py-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm text-teal-950">
                      <span className="font-medium">{item.kindLabel}</span>
                      {" · "}
                      {formatRupiah(item.taxAmount)}
                    </p>
                    <p className="truncate text-xs text-teal-900/55">
                      {item.monthKey}
                      {item.sourceDescription
                        ? ` · ${item.sourceDescription}`
                        : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={btnSecondaryClass}
                    onClick={() => setPayId(paying ? null : item.id)}
                  >
                    {paying ? "Batal" : "Bayar"}
                  </button>
                </div>
                {paying ? (
                  <PayForm
                    obligationId={item.id}
                    onDone={() => setPayId(null)}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

/** Panel daftar (selalu terbuka) — dipakai di halaman Pajak AdminOK. */
export function TaxObligationPayPanel({
  unpaid,
  title = "Pajak terhutang — segera bayar",
}: {
  unpaid: TaxObligationPayItem[];
  /** @deprecated tidak dipakai — kas tidak dipotong ulang saat bayar */
  cashSources?: Array<{ id: string; name: string }>;
  title?: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (unpaid.length === 0) return null;

  const total = unpaid.reduce((s, u) => s + u.taxAmount, 0);

  return (
    <div className="mb-4 rounded-xl border border-amber-300/80 bg-amber-50/90 p-3 sm:p-4 print:hidden">
      <div>
        <p className="text-sm font-medium text-amber-950">{title}</p>
        <p className="mt-0.5 text-xs text-amber-900/70">
          {unpaid.length} kewajiban · total {formatRupiah(total)}. Unggah bukti
          bayar + ID billing. Kas BKU/BKT sudah dipotong saat nota.
        </p>
      </div>

      <ul className="mt-3 space-y-2">
        {unpaid.map((item) => {
          const open = openId === item.id;
          return (
            <li
              key={item.id}
              className="rounded-lg border border-amber-200/80 bg-white/80 px-3 py-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm text-teal-950">
                    <span className="font-medium">{item.kindLabel}</span>
                    {" · "}
                    {formatRupiah(item.taxAmount)}
                  </p>
                  <p className="truncate text-xs text-teal-900/55">
                    {item.monthKey}
                    {item.sourceDescription
                      ? ` · ${item.sourceDescription}`
                      : ""}
                  </p>
                </div>
                <button
                  type="button"
                  className={btnSecondaryClass}
                  onClick={() => setOpenId(open ? null : item.id)}
                >
                  {open ? "Tutup" : "Bayar"}
                </button>
              </div>
              {open ? (
                <PayForm
                  obligationId={item.id}
                  onDone={() => setOpenId(null)}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PayForm({
  obligationId,
  onDone,
}: {
  obligationId: string;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(
    async (prev: { error?: string; success?: string }, fd: FormData) => {
      const res = await payTaxObligationAction(prev, fd);
      if (res.success) onDone();
      return res;
    },
    {},
  );

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form
      action={action}
      className="mt-3 grid gap-2 border-t border-amber-100 pt-3 sm:grid-cols-2"
    >
      <input type="hidden" name="obligationId" value={obligationId} />
      <label className="block text-xs text-teal-900/70 sm:col-span-2">
        ID billing / NTPN
        <input
          name="billingId"
          required
          placeholder="Contoh: ID billing DJP"
          className="mt-1 min-h-11 w-full rounded-xl border border-teal-900/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-600"
        />
      </label>
      <label className="block text-xs text-teal-900/70">
        Tanggal bayar
        <input
          type="date"
          name="date"
          defaultValue={today}
          required
          className="mt-1 min-h-11 w-full rounded-xl border border-teal-900/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-600"
        />
      </label>
      <label className="block text-xs text-teal-900/70">
        Bukti bayar (JPG/PNG/PDF)
        <input
          type="file"
          name="proof"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          required
          className="mt-1 block w-full text-sm"
        />
      </label>
      {state.error ? (
        <p className="text-sm text-rose-700 sm:col-span-2">{state.error}</p>
      ) : null}
      {state.success ? (
        <p className="text-sm text-emerald-800 sm:col-span-2">{state.success}</p>
      ) : null}
      <div className="sm:col-span-2">
        <button type="submit" disabled={pending} className={btnPrimaryClass}>
          {pending ? "Menyimpan…" : "Konfirmasi bayar"}
        </button>
      </div>
    </form>
  );
}

export function TaxObligationPaidList({
  paid,
}: {
  paid: Array<{
    id: string;
    kindLabel: string;
    taxAmount: number;
    billingId: string | null;
    proofUrl: string | null;
    paidAt: string | null;
  }>;
}) {
  if (paid.length === 0) return null;
  return (
    <div className="mt-4 print:hidden">
      <p className="mb-2 text-xs tracking-wide text-teal-900/50 uppercase">
        Pajak sudah dibayar
      </p>
      <ul className="space-y-1.5 text-sm">
        {paid.map((p) => (
          <li
            key={p.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded border border-teal-900/10 bg-[#fffcf7] px-3 py-2"
          >
            <span>
              {p.kindLabel} · {formatRupiah(p.taxAmount)}
              {p.billingId ? (
                <span className="text-teal-900/55"> · {p.billingId}</span>
              ) : null}
            </span>
            {p.proofUrl ? (
              <ProofReviewLink href={p.proofUrl} title={`Bukti ${p.kindLabel}`}>
                Bukti
              </ProofReviewLink>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
