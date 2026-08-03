import { format } from "date-fns";
import {
  createContractorAdvanceAction,
  createContractorExpenseAction,
  deleteContractorAdvanceAction,
  deleteContractorExpenseAction,
  upsertContractorAction,
} from "@/lib/actions/contractor";
import {
  assessContractorBudget,
  calcContractorBudgetAmount,
  CONTRACTOR_MAX_SAFE_PERCENT,
  CONTRACTOR_TARGET_PERCENT,
  contractorExpenseKindLabels,
  contractorStatusLabels,
  summarizeContractor,
} from "@/lib/contractor";
import { formatRupiah } from "@/lib/money";
import { tidyCase } from "@/lib/text";
import { ActionForm, Field, inputClass } from "@/components/ActionForm";
import { ProofReviewLink } from "@/components/ProofReviewLink";
import { RupiahInput } from "@/components/RupiahInput";
import {
  btnSecondaryClass,
  Card,
  EmptyState,
} from "@/components/ui";

type SourceOption = { id: string; name: string };

type AdvanceRow = {
  id: string;
  date: Date;
  amount: number;
  fromProjectAmount: number;
  fromGlobalAmount: number;
  description: string;
  proofUrl: string | null;
  cashSource: { name: string };
};

type ExpenseRow = {
  id: string;
  date: Date;
  amount: number;
  kind: string;
  description: string;
  proofUrl: string | null;
};

function ContractorForm({
  projectId,
  contractValue,
  contractor,
  submitLabel,
}: {
  projectId: string;
  contractValue: number;
  contractor?: {
    name: string;
    phone: string | null;
    notes: string | null;
    agreedAmount: number;
  } | null;
  submitLabel: string;
}) {
  const targetAmount = calcContractorBudgetAmount(
    contractValue,
    CONTRACTOR_TARGET_PERCENT,
  );
  const maxSafeAmount = calcContractorBudgetAmount(
    contractValue,
    CONTRACTOR_MAX_SAFE_PERCENT,
  );
  const defaultAgreed =
    contractor?.agreedAmount && contractor.agreedAmount > 0
      ? contractor.agreedAmount
      : targetAmount;

  return (
    <ActionForm action={upsertContractorAction} submitLabel={submitLabel}>
      <input type="hidden" name="projectId" value={projectId} />
      <Field label="Nama pemborong">
        <input
          name="name"
          className={inputClass}
          defaultValue={contractor?.name ?? ""}
          required
        />
      </Field>
      <Field label="Telepon (opsional)">
        <input
          name="phone"
          className={inputClass}
          defaultValue={contractor?.phone ?? ""}
        />
      </Field>
      <Field
        label="Nilai borongan"
        hint={
          contractValue > 0
            ? `Target ${CONTRACTOR_TARGET_PERCENT}% = ${formatRupiah(targetAmount)} · maks aman ${CONTRACTOR_MAX_SAFE_PERCENT}% = ${formatRupiah(maxSafeAmount)}`
            : `Target ${CONTRACTOR_TARGET_PERCENT}% kontrak (aman s.d. ${CONTRACTOR_MAX_SAFE_PERCENT}%). Isi nilai kontrak dulu.`
        }
      >
        <RupiahInput
          name="agreedAmount"
          defaultValue={defaultAgreed}
          required
        />
      </Field>
      <Field label="Catatan">
        <textarea
          name="notes"
          className={inputClass}
          rows={2}
          defaultValue={contractor?.notes ?? ""}
        />
      </Field>
    </ActionForm>
  );
}

export function ContractorPanel({
  projectId,
  admin,
  projectCash,
  contractValue,
  sources,
  contractor,
}: {
  projectId: string;
  admin: boolean;
  projectCash: number;
  contractValue: number;
  globalCash?: number;
  globalCashTunai?: number;
  globalCashBank?: number;
  sources: SourceOption[];
  contractor: {
    name: string;
    phone: string | null;
    notes: string | null;
    agreedAmount: number;
    advances: AdvanceRow[];
    expenses: ExpenseRow[];
  } | null;
}) {
  const summary = summarizeContractor({
    agreedAmount: contractor?.agreedAmount ?? 0,
    advances: contractor?.advances ?? [],
    expenses: contractor?.expenses ?? [],
  });
  const budget = assessContractorBudget(
    contractor?.agreedAmount ?? 0,
    contractValue,
  );
  const budgetTone =
    budget.band === "ideal"
      ? "text-teal-800"
      : budget.band === "aman"
        ? "text-amber-800"
        : budget.band === "berisiko"
          ? "text-rose-700"
          : "text-teal-900/55";

  if (!contractor) {
    return (
      <Card className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-medium text-teal-950">Pemborong</h3>
            <p className="mt-0.5 text-sm text-teal-900/55">
              Belum ada data. Target borongan {CONTRACTOR_TARGET_PERCENT}%
              kontrak (aman {CONTRACTOR_TARGET_PERCENT}–
              {CONTRACTOR_MAX_SAFE_PERCENT}%).
            </p>
          </div>
          {admin ? (
            <details className="w-full max-w-md sm:w-auto">
              <summary
                className={`${btnSecondaryClass} cursor-pointer list-none`}
              >
                + Tambah pemborong
              </summary>
              <div className="mt-3">
                <ContractorForm
                  projectId={projectId}
                  contractValue={contractValue}
                  submitLabel="Simpan pemborong"
                />
              </div>
            </details>
          ) : null}
        </div>
      </Card>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3 text-sm">
          <div>
            <h3 className="text-base font-medium text-teal-950">
              {tidyCase(contractor.name)}
            </h3>
            <p className="mt-1 text-teal-900/65">
              Borongan {formatRupiah(summary.agreedAmount)} · Termin{" "}
              {formatRupiah(summary.totalAdvances)} · Bukti{" "}
              {formatRupiah(summary.totalExpenses)} ·{" "}
              {contractorStatusLabels[summary.status]}
              {contractor.phone ? ` · ${contractor.phone}` : ""}
            </p>
            <p className={`mt-1 ${budgetTone}`}>{budget.label}</p>
            <p className="mt-1 text-teal-900/55">
              Kas proyek {formatRupiah(projectCash)} · Sisa plafon{" "}
              {formatRupiah(summary.remainingCeiling)}
              {budget.targetAmount > 0
                ? ` · Target ${formatRupiah(budget.targetAmount)}`
                : ""}
            </p>
          </div>
          {admin ? (
            <details>
              <summary className="cursor-pointer text-sm text-teal-700 underline">
                Ubah data
              </summary>
              <div className="mt-3 max-w-md">
                <ContractorForm
                  projectId={projectId}
                  contractValue={contractValue}
                  contractor={contractor}
                  submitLabel="Simpan"
                />
              </div>
            </details>
          ) : null}
        </div>

        <div className="mt-3 h-2 overflow-hidden rounded-full bg-teal-900/10">
          <div
            className="h-full rounded-full bg-teal-700"
            style={{ width: `${summary.progressPercent}%` }}
          />
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="text-base font-medium text-teal-950">Termin</h3>
          {admin ? (
            <details className="mt-2">
              <summary className="cursor-pointer text-sm text-teal-700 underline">
                + Catat termin
              </summary>
              <div className="mt-3">
                <ActionForm
                  action={createContractorAdvanceAction}
                  submitLabel="Catat termin"
                >
                  <input type="hidden" name="projectId" value={projectId} />
                  <Field label="Tanggal">
                    <input
                      name="date"
                      type="date"
                      className={inputClass}
                      defaultValue={format(new Date(), "yyyy-MM-dd")}
                      required
                    />
                  </Field>
                  <Field label="Sumber kas">
                    <select name="cashSourceId" className={inputClass} required>
                      <option value="">Pilih sumber</option>
                      {sources.map((s) => (
                        <option key={s.id} value={s.id}>
                          {tidyCase(s.name)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Nominal">
                    <RupiahInput name="amount" defaultValue={0} required />
                  </Field>
                  <Field label="Keterangan">
                    <input name="description" className={inputClass} required />
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
            </details>
          ) : null}

          <div className="mt-3 space-y-2 text-sm">
            {contractor.advances.length === 0 ? (
              <EmptyState message="Belum ada termin." />
            ) : (
              contractor.advances.map((row) => (
                <div
                  key={row.id}
                  className="flex flex-wrap items-start justify-between gap-2 border-b border-teal-900/6 py-2 last:border-0"
                >
                  <div>
                    <p className="text-teal-950">{tidyCase(row.description)}</p>
                    <p className="text-teal-900/55">
                      {format(row.date, "dd/MM/yyyy")} ·{" "}
                      {tidyCase(row.cashSource.name)}
                      {row.proofUrl ? (
                        <>
                          {" "}
                          ·{" "}
                          <ProofReviewLink
                            href={row.proofUrl}
                            title={tidyCase(row.description)}
                          >
                            bukti
                          </ProofReviewLink>
                        </>
                      ) : null}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="tabular-nums text-rose-700">
                      {formatRupiah(row.amount)}
                    </p>
                    {admin ? (
                      <form action={deleteContractorAdvanceAction}>
                        <input type="hidden" name="id" value={row.id} />
                        <button
                          type="submit"
                          className="text-sm text-rose-700 underline"
                        >
                          Hapus
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <details>
            <summary className="cursor-pointer list-none">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-medium text-teal-950">
                    Bukti pengeluaran
                  </h3>
                  <p className="mt-0.5 text-sm text-teal-900/55">
                    {contractor.expenses.length} catatan ·{" "}
                    {formatRupiah(
                      contractor.expenses.reduce((s, e) => s + e.amount, 0),
                    )}
                  </p>
                </div>
                <span className="text-sm text-teal-700">Buka</span>
              </div>
            </summary>

            <div className="mt-3 border-t border-teal-900/10 pt-3">
              {admin ? (
                <details className="mt-0">
                  <summary className="cursor-pointer text-sm text-teal-700 underline">
                    + Catat bukti
                  </summary>
                  <div className="mt-3">
                    <ActionForm
                      action={createContractorExpenseAction}
                      submitLabel="Catat bukti"
                    >
                      <input type="hidden" name="projectId" value={projectId} />
                      <Field label="Tanggal">
                        <input
                          name="date"
                          type="date"
                          className={inputClass}
                          defaultValue={format(new Date(), "yyyy-MM-dd")}
                          required
                        />
                      </Field>
                      <Field label="Jenis">
                        <select
                          name="kind"
                          className={inputClass}
                          defaultValue="MATERIAL"
                          required
                        >
                          <option value="MATERIAL">
                            {contractorExpenseKindLabels.MATERIAL}
                          </option>
                          <option value="WAGES">
                            {contractorExpenseKindLabels.WAGES}
                          </option>
                          <option value="OTHER">
                            {contractorExpenseKindLabels.OTHER}
                          </option>
                        </select>
                      </Field>
                      <Field label="Nominal">
                        <RupiahInput name="amount" defaultValue={0} required />
                      </Field>
                      <Field label="Uraian">
                        <input
                          name="description"
                          className={inputClass}
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
                </details>
              ) : null}

              <div className="mt-3 space-y-2 text-sm">
                {contractor.expenses.length === 0 ? (
                  <EmptyState message="Belum ada bukti." />
                ) : (
                  contractor.expenses.map((row) => (
                    <div
                      key={row.id}
                      className="flex flex-wrap items-start justify-between gap-2 border-b border-teal-900/6 py-2 last:border-0"
                    >
                      <div>
                        <p className="text-teal-950">
                          {tidyCase(row.description)}
                        </p>
                        <p className="text-teal-900/55">
                          {format(row.date, "dd/MM/yyyy")} ·{" "}
                          {contractorExpenseKindLabels[row.kind] ?? row.kind}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="tabular-nums text-teal-950">
                          {formatRupiah(row.amount)}
                        </p>
                        {admin ? (
                          <form action={deleteContractorExpenseAction}>
                            <input type="hidden" name="id" value={row.id} />
                            <button
                              type="submit"
                              className="text-sm text-rose-700 underline"
                            >
                              Hapus
                            </button>
                          </form>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </details>
        </Card>
      </div>
    </div>
  );
}
