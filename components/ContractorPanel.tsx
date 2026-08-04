import {
  assessContractorBudget,
  calcContractorBudgetAmount,
  CONTRACTOR_MAX_SAFE_PERCENT,
  CONTRACTOR_TARGET_PERCENT,
  contractorStatusLabels,
  summarizeContractor,
} from "@/lib/contractor";
import { formatRupiah } from "@/lib/money";
import { tidyCase } from "@/lib/text";
import { ActionForm, Field, inputClass } from "@/components/ActionForm";
import { MandorDisbursementPanel } from "@/components/MandorDisbursementPanel";
import { RupiahInput } from "@/components/RupiahInput";
import { btnSecondaryClass, Card } from "@/components/ui";
import { upsertContractorAction } from "@/lib/actions/contractor";

type SourceOption = { id: string; name: string };

type ExpenseRow = {
  id: string;
  date: Date;
  amount: number;
  kind: string;
  description: string;
  proofUrl: string | null;
};

type MandorDisbursementRow = {
  id: string;
  date: string;
  label: string;
  amount: number;
  mandorName: string;
  proofUrl: string | null;
  hasKasBesar?: boolean;
};

type MandorOption = { id: string; name: string };

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

/**
 * Panel pemborong + Dana ke Mandor (satu saluran pembayaran).
 */
export function ContractorPanel({
  projectId,
  admin,
  projectCash,
  contractValue,
  sources,
  contractor,
  mandors = [],
  mandorDisbursements = [],
  mandorOverspend,
}: {
  projectId: string;
  admin: boolean;
  projectCash: number;
  contractValue: number;
  sources: SourceOption[];
  contractor: {
    name: string;
    phone: string | null;
    notes: string | null;
    agreedAmount: number;
    expenses?: ExpenseRow[];
  } | null;
  mandors?: MandorOption[];
  mandorDisbursements?: MandorDisbursementRow[];
  mandorOverspend?: { mandorName: string; amount: number }[];
}) {
  const mandorPayments = mandorDisbursements.filter(
    (r) => r.hasKasBesar !== false,
  );
  const mandorCairTotal = mandorPayments.reduce((s, r) => s + r.amount, 0);

  const summary = summarizeContractor({
    agreedAmount: contractor?.agreedAmount ?? 0,
    payments: mandorPayments,
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

  const showMandorBlock = mandors.length > 0 || mandorDisbursements.length > 0;

  const mandorSection = showMandorBlock ? (
    <Card>
      <MandorDisbursementPanel
        projectId={projectId}
        canEdit={admin}
        mandors={mandors}
        sources={sources}
        rows={mandorDisbursements}
        overspend={mandorOverspend}
        compact
      />
    </Card>
  ) : null;

  if (!contractor) {
    return (
      <div className="mt-4 space-y-4">
        <Card>
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
        {mandorSection}
      </div>
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
              Borongan {formatRupiah(summary.agreedAmount)} · Dana Mandor{" "}
              {formatRupiah(mandorCairTotal)} ·{" "}
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

      {mandorSection}
    </div>
  );
}
