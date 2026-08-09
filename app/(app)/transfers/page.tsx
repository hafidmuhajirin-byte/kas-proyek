import Link from "next/link";
import { format } from "date-fns";
import {
  createCashTransferAction,
  deleteCashTransferAction,
} from "@/lib/actions/transfers";
import { isOwner, requireSession } from "@/lib/auth";
import {
  getGlobalCashBreakdown,
  isBankChannel,
} from "@/lib/balance";
import { formatRupiah } from "@/lib/money";
import { cashSourceTypeLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { ActionForm, Field, inputClass } from "@/components/ActionForm";
import { ProofReviewLink } from "@/components/ProofReviewLink";
import { RupiahInput } from "@/components/RupiahInput";
import {
  btnDangerClass,
  btnSecondaryClass,
  Card,
  EmptyState,
  PageHeader,
  StatCard,
} from "@/components/ui";

export default async function TransfersPage() {
  const user = await requireSession();
  const admin = isOwner(user);

  const [sources, transfers, kasBesar] = await Promise.all([
    prisma.cashSource.findMany({ orderBy: { name: "asc" } }),
    prisma.cashTransfer.findMany({
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 50,
      include: {
        fromCashSource: true,
        toCashSource: true,
        createdBy: { select: { name: true } },
      },
    }),
    getGlobalCashBreakdown(),
  ]);

  const cashSources = sources.filter((s) => !isBankChannel(s.type));
  const bankSources = sources.filter((s) => isBankChannel(s.type));

  return (
    <div>
      <PageHeader
        title="Transfer Kas"
        description="Pindahkan dana antar Tunai dan Bank. Total kas besar tidak berubah."
        actions={
          <Link href="/sources" className={btnSecondaryClass}>
            Sumber kas
          </Link>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Kas besar (total)"
          value={formatRupiah(kasBesar.total)}
          hint="Tidak berubah karena transfer"
          tone="balance"
        />
        <StatCard
          label="Tunai"
          value={formatRupiah(kasBesar.cash)}
          tone="balance"
        />
        <StatCard
          label="Bank"
          value={formatRupiah(kasBesar.bank)}
          tone="balance"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card className="overflow-x-auto">
          <h3 className="font-serif text-xl text-teal-950">Riwayat transfer</h3>
          <div className="mt-4">
            {transfers.length === 0 ? (
              <EmptyState message="Belum ada transfer Tunai ↔ Bank." />
            ) : (
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-teal-900/10 text-xs tracking-wide text-teal-900/55 uppercase">
                  <tr>
                    <th className="pb-3 pr-3 font-medium">Tanggal</th>
                    <th className="pb-3 pr-3 font-medium">Dari</th>
                    <th className="pb-3 pr-3 font-medium">Ke</th>
                    <th className="pb-3 pr-3 font-medium">Keterangan</th>
                    <th className="pb-3 pr-3 text-right font-medium">Nominal</th>
                    {admin ? <th className="pb-3 font-medium">Aksi</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {transfers.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-teal-900/5 align-top"
                    >
                      <td className="py-3 pr-3 whitespace-nowrap text-teal-900/70">
                        {format(row.date, "dd/MM/yyyy")}
                      </td>
                      <td className="py-3 pr-3">
                        <p className="font-medium text-teal-950">
                          {row.fromCashSource.name}
                        </p>
                        <p className="text-xs text-teal-900/50">
                          {cashSourceTypeLabels[row.fromCashSource.type]}
                          {row.fromCashSource.accountNumber
                            ? ` · ${row.fromCashSource.accountNumber}`
                            : ""}
                        </p>
                      </td>
                      <td className="py-3 pr-3">
                        <p className="font-medium text-teal-950">
                          {row.toCashSource.name}
                        </p>
                        <p className="text-xs text-teal-900/50">
                          {cashSourceTypeLabels[row.toCashSource.type]}
                          {row.toCashSource.accountNumber
                            ? ` · ${row.toCashSource.accountNumber}`
                            : ""}
                        </p>
                      </td>
                      <td className="py-3 pr-3 text-teal-900/75">
                        {row.description}
                        {row.proofUrl ? (
                          <ProofReviewLink
                            href={row.proofUrl}
                            title={row.description}
                            className="mt-1 block text-xs text-teal-700 underline"
                          >
                            Bukti
                          </ProofReviewLink>
                        ) : null}
                        <p className="mt-1 text-xs text-teal-900/45">
                          oleh {row.createdBy.name}
                        </p>
                      </td>
                      <td className="py-3 pr-3 text-right font-medium text-teal-900">
                        {formatRupiah(row.amount)}
                      </td>
                      {admin ? (
                        <td className="py-3">
                          <form action={deleteCashTransferAction}>
                            <input type="hidden" name="id" value={row.id} />
                            <button type="submit" className={btnDangerClass}>
                              Hapus
                            </button>
                          </form>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>

        <Card>
          <h3 className="font-serif text-xl text-teal-950">Buat transfer</h3>
          <p className="mt-1 text-xs text-teal-900/55">
            Contoh: setor Tunai ke rekening Bank, atau tarik Bank ke Tunai.
          </p>

          {sources.length < 2 ? (
            <p className="mt-4 text-sm text-rose-700">
              Butuh minimal dua sumber kas (Tunai dan Bank). Tambahkan di menu{" "}
              <Link href="/sources" className="underline">
                Sumber Kas
              </Link>
              , pastikan jenisnya benar: <strong>Tunai</strong> dan{" "}
              <strong>Bank</strong>.
            </p>
          ) : cashSources.length === 0 || bankSources.length === 0 ? (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-rose-700">
                Form transfer butuh sumber berjenis <strong>Tunai</strong> dan{" "}
                <strong>Bank</strong>. Saat ini{" "}
                {cashSources.length === 0
                  ? "belum ada sumber Tunai"
                  : "belum ada sumber Bank"}
                . Edit jenis sumber di{" "}
                <Link href="/sources" className="underline">
                  Sumber Kas
                </Link>{" "}
                (contoh: Bank BNI harus jenis <strong>Bank</strong>, bukan
                Lainnya).
              </p>
            </div>
          ) : (
            <div className="mt-4">
              <ActionForm
                action={createCashTransferAction}
                submitLabel="Simpan transfer"
              >
                <Field label="Tanggal">
                  <input
                    name="date"
                    type="date"
                    className={inputClass}
                    defaultValue={format(new Date(), "yyyy-MM-dd")}
                    required
                  />
                </Field>
                <Field label="Dari (asal)">
                  <select
                    name="fromCashSourceId"
                    className={inputClass}
                    required
                    defaultValue={cashSources[0]?.id}
                  >
                    <optgroup label="Tunai">
                      {cashSources.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Bank">
                      {bankSources.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                          {s.accountNumber ? ` · ${s.accountNumber}` : ""}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </Field>
                <Field label="Ke (tujuan)">
                  <select
                    name="toCashSourceId"
                    className={inputClass}
                    required
                    defaultValue={bankSources[0]?.id}
                  >
                    <optgroup label="Bank">
                      {bankSources.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                          {s.accountNumber ? ` · ${s.accountNumber}` : ""}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Tunai">
                      {cashSources.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </Field>
                <Field label="Nominal (Rp)">
                  <RupiahInput
                    name="amount"
                    defaultValue={0}
                    required
                    placeholder="0"
                  />
                </Field>
                <Field label="Keterangan">
                  <input
                    name="description"
                    className={inputClass}
                    placeholder="Contoh: Setor tunai ke rekening BCA"
                    required
                  />
                </Field>
                <Field label="Bukti (opsional)">
                  <input
                    name="proof"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    className={inputClass}
                  />
                </Field>
              </ActionForm>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
