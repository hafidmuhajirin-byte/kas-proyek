import {
  calcContractorBudgetAmount,
  CONTRACTOR_TARGET_PERCENT,
  mandorWorkEstimateMax,
} from "@/lib/contractor";
import { formatRupiah } from "@/lib/money";
import { tidyCase } from "@/lib/text";
import { ActionForm, Field, inputClass } from "@/components/ActionForm";
import { MandorAssignPanel } from "@/components/MandorAssignPanel";
import { MandorBoronganCalcTable } from "@/components/MandorBoronganCalcTable";
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

type MandorOption = { id: string; name: string; username?: string };

export type SpkManajemenPagu = {
  perencanaan: number;
  pengawasan: number;
  pengelolaan: number;
};

function ContractorForm({
  projectId,
  contractValue,
  contractor,
  submitLabel,
  suggestedBorongan,
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
  /** Estimasi dari rumus SPK — dipakai default jika belum ada nilai borongan. */
  suggestedBorongan?: number;
}) {
  const fallbackTarget = calcContractorBudgetAmount(
    contractValue,
    CONTRACTOR_TARGET_PERCENT,
  );
  const defaultAgreed =
    contractor?.agreedAmount && contractor.agreedAmount > 0
      ? contractor.agreedAmount
      : suggestedBorongan && suggestedBorongan > 0
        ? suggestedBorongan
        : fallbackTarget;

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
      <Field label="Nilai borongan">
        <RupiahInput
          name="agreedAmount"
          defaultValue={defaultAgreed}
          required
        />
        {suggestedBorongan && suggestedBorongan > 0 ? (
          <p className="mt-1 text-[11px] text-[var(--ink-faint)]">
            Saran dari rumus SPK: {formatRupiah(suggestedBorongan)}
          </p>
        ) : null}
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

/** Panel pemborong + Dana ke Mandor — ringkas. */
export function ContractorPanel({
  projectId,
  admin,
  projectCash: _projectCash,
  contractValue,
  sources,
  contractor,
  mandors = [],
  allMandors = [],
  mandorDisbursements = [],
  mandorOverspend,
  spkManajemen,
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
  /** Mandor yang sudah ditugaskan ke proyek ini. */
  mandors?: MandorOption[];
  /** Semua akun Mandor (untuk form penugasan). */
  allMandors?: MandorOption[];
  mandorDisbursements?: MandorDisbursementRow[];
  mandorOverspend?: { mandorName: string; amount: number }[];
  /** Pagu manajemen dari Ringkasan SPK (Admin). */
  spkManajemen?: SpkManajemenPagu;
}) {
  const mandorPayments = mandorDisbursements.filter(
    (r) => r.hasKasBesar !== false,
  );
  const mandorCairTotal = mandorPayments.reduce((s, r) => s + r.amount, 0);

  const estimate = mandorWorkEstimateMax({
    contractValue,
    perencanaan: spkManajemen?.perencanaan ?? 0,
    pengawasan: spkManajemen?.pengawasan ?? 0,
    pengelolaan: spkManajemen?.pengelolaan ?? 0,
  });

  const assignCard = (
    <Card>
      <MandorAssignPanel
        projectId={projectId}
        canEdit={admin}
        assigned={mandors}
        allMandors={allMandors}
      />
    </Card>
  );

  const showDisbursement =
    mandors.length > 0 || mandorDisbursements.length > 0;

  const disbursementSection = showDisbursement ? (
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

  const calcDetail = (
    <div className="mt-3">
      <p className="text-xs font-medium text-[var(--ink-muted)]">
        Detail perhitungan estimasi borongan Mandor
      </p>
      <MandorBoronganCalcTable estimate={estimate} />
    </div>
  );

  if (!contractor) {
    return (
      <div className="mt-4 space-y-4">
        {assignCard}
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-medium text-teal-950">Pemborong</h3>
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
                    suggestedBorongan={estimate.amount}
                  />
                </div>
              </details>
            ) : null}
          </div>
          {calcDetail}
          <p className="mt-2 text-xs text-teal-900/60">
            Tip: jika nama pemborong sama dengan akun Mandor, penugasan
            otomatis dibuat saat disimpan.
          </p>
        </Card>
        {disbursementSection}
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      {assignCard}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3 text-sm">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-medium text-teal-950">
              {tidyCase(contractor.name)}
            </h3>
            <p className="mt-1 text-teal-900/65">
              Borongan {formatRupiah(contractor.agreedAmount)} · Cair{" "}
              {formatRupiah(mandorCairTotal)}
            </p>
            {estimate.amount > 0 ? (
              <p className="mt-1 text-xs text-[var(--ink-faint)]">
                Estimasi rumus SPK: {formatRupiah(estimate.amount)}
              </p>
            ) : null}
            {calcDetail}
          </div>
          {admin ? (
            <details>
              <summary className="cursor-pointer text-sm text-teal-700 underline">
                Ubah
              </summary>
              <div className="mt-3 max-w-md">
                <ContractorForm
                  projectId={projectId}
                  contractValue={contractValue}
                  contractor={contractor}
                  submitLabel="Simpan"
                  suggestedBorongan={estimate.amount}
                />
              </div>
            </details>
          ) : null}
        </div>
      </Card>

      {disbursementSection}
    </div>
  );
}
