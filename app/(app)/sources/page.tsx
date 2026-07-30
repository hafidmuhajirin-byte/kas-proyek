import Link from "next/link";
import {
  createCashSourceAction,
  deleteCashSourceAction,
  updateCashSourceAction,
} from "@/lib/actions/sources";
import { isOwner, requireSession } from "@/lib/auth";
import { getGlobalCashBreakdown } from "@/lib/balance";
import { formatRupiah } from "@/lib/money";
import { cashSourceTypeLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { ActionForm, Field, inputClass } from "@/components/ActionForm";
import { SourceTypeFields } from "@/components/SourceTypeFields";
import {
  Alert,
  btnDangerClass,
  btnSecondaryClass,
  Card,
  EmptyState,
  PageHeader,
  StatCard,
} from "@/components/ui";

export default async function SourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireSession();
  const admin = isOwner(user);
  const [sources, kasBesar] = await Promise.all([
    prisma.cashSource.findMany({
      orderBy: { name: "asc" },
    }),
    getGlobalCashBreakdown(),
  ]);
  const params = await searchParams;

  return (
    <div>
      <PageHeader
        title="Sumber Kas"
        description="Untuk Bank, isi nomor rekening. Kas besar terbagi Tunai & Bank."
        actions={
          <Link href="/transfers" className={btnSecondaryClass}>
            Transfer Tunai ↔ Bank
          </Link>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Kas besar (total)"
          value={formatRupiah(kasBesar.total)}
          tone="balance"
        />
        <StatCard
          label="Tunai"
          value={formatRupiah(kasBesar.cash)}
          hint="Jenis CASH / Lainnya + saldo awal"
          tone="balance"
        />
        <StatCard
          label="Bank"
          value={formatRupiah(kasBesar.bank)}
          hint="Jenis Bank / Transfer klien"
          tone="balance"
        />
      </div>

      {params.error ? (
        <div className="mb-4">
          <Alert>{params.error}</Alert>
        </div>
      ) : null}

      <div className={`grid gap-6 ${admin ? "lg:grid-cols-[1fr_360px]" : ""}`}>
        <Card className="overflow-x-auto">
          {sources.length === 0 ? (
            <EmptyState message="Belum ada sumber kas." />
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-teal-900/10 text-xs tracking-wide text-teal-900/55 uppercase">
                <tr>
                  <th className="pb-3 pr-3 font-medium">Nama</th>
                  <th className="pb-3 pr-3 font-medium">Jenis</th>
                  <th className="pb-3 pr-3 font-medium">No. Rekening</th>
                  <th className="pb-3 pr-3 font-medium">Catatan</th>
                  {admin ? <th className="pb-3 font-medium">Aksi</th> : null}
                </tr>
              </thead>
              <tbody>
                {sources.map((source) => (
                  <tr
                    key={source.id}
                    className="border-b border-teal-900/5 align-top"
                  >
                    <td className="py-3 pr-3 font-medium text-teal-950">
                      {source.name}
                      {admin ? (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs font-normal text-teal-700">
                            Edit
                          </summary>
                          <div className="mt-2 max-w-sm">
                            <ActionForm
                              action={updateCashSourceAction}
                              submitLabel="Update"
                            >
                              <input type="hidden" name="id" value={source.id} />
                              <Field label="Nama">
                                <input
                                  name="name"
                                  className={inputClass}
                                  defaultValue={source.name}
                                  required
                                />
                              </Field>
                              <SourceTypeFields
                                defaultType={source.type}
                                defaultAccountNumber={source.accountNumber}
                              />
                              <Field label="Catatan">
                                <textarea
                                  name="notes"
                                  className={inputClass}
                                  rows={2}
                                  defaultValue={source.notes ?? ""}
                                />
                              </Field>
                            </ActionForm>
                          </div>
                        </details>
                      ) : null}
                    </td>
                    <td className="py-3 pr-3 text-teal-900/75">
                      {cashSourceTypeLabels[source.type]}
                    </td>
                    <td className="py-3 pr-3 font-mono text-sm text-teal-900/80">
                      {source.accountNumber || "—"}
                    </td>
                    <td className="py-3 pr-3 text-teal-900/65">
                      {source.notes || "—"}
                    </td>
                    {admin ? (
                      <td className="py-3">
                        <form action={deleteCashSourceAction}>
                          <input type="hidden" name="id" value={source.id} />
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
        </Card>

        {admin ? (
          <Card>
            <h3 className="font-serif text-xl text-teal-950">Tambah sumber</h3>
            <div className="mt-4">
              <ActionForm
                action={createCashSourceAction}
                submitLabel="Tambah sumber"
              >
                <Field label="Nama">
                  <input
                    name="name"
                    className={inputClass}
                    placeholder="Contoh: Bank BNI, Kas Kantor"
                    required
                  />
                </Field>
                <SourceTypeFields defaultType="BANK" />
                <Field label="Catatan">
                  <textarea name="notes" className={inputClass} rows={3} />
                </Field>
              </ActionForm>
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
