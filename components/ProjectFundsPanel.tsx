import {
  upsertProjectFundsAction,
} from "@/lib/actions/project-funds";
import { formatRupiah } from "@/lib/money";
import {
  calcProjectSaveAmount,
  PROJECT_SAVE_PERCENT,
  projectFundKinds,
  projectFundLabels,
  type ProjectFundKind,
} from "@/lib/project-funds";
import { ActionForm, Field, inputClass } from "@/components/ActionForm";
import { ManagementFundBreakdown } from "@/components/ManagementFundBreakdown";
import { RupiahInput } from "@/components/RupiahInput";
import { Card } from "@/components/ui";

type FundRow = {
  kind: string;
  plannedAmount: number;
  notes: string | null;
};

type MgmtExpense = {
  id: string;
  date: Date;
  amount: number;
  description: string;
};

export function ProjectFundsPanel({
  projectId,
  admin,
  canRecordManagement = false,
  contractValue,
  funds,
  spentByKind,
  managementExpenses = [],
}: {
  projectId: string;
  admin: boolean;
  /** Owner atau Admin — catat breakdown pengelolaan ke Kas Tunai */
  canRecordManagement?: boolean;
  contractValue: number;
  funds: FundRow[];
  spentByKind: Partial<Record<ProjectFundKind, number>>;
  managementExpenses?: MgmtExpense[];
}) {
  const byKind = new Map(funds.map((f) => [f.kind, f]));
  const suggestedSave = calcProjectSaveAmount(contractValue);

  function plannedOf(kind: ProjectFundKind) {
    if (byKind.has(kind)) return byKind.get(kind)!.plannedAmount;
    return kind === "SAVE" ? suggestedSave : 0;
  }

  const totalPlanned = projectFundKinds.reduce(
    (sum, kind) => sum + plannedOf(kind),
    0,
  );
  const totalSpent = projectFundKinds.reduce(
    (sum, kind) => sum + (spentByKind[kind] ?? 0),
    0,
  );

  return (
    <Card className="mt-2">
      <details>
        <summary className="cursor-pointer list-none">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-medium text-[var(--ink)]">
                Dana operasional
              </h3>
              <p className="mt-0.5 text-[11px] text-[var(--ink-faint)]">
                Rencana {formatRupiah(totalPlanned)} · Terpakai{" "}
                {formatRupiah(totalSpent)} · Sisa{" "}
                {formatRupiah(totalPlanned - totalSpent)}
              </p>
            </div>
            <span className="text-xs text-[var(--accent)]">Buka</span>
          </div>
        </summary>

        <div className="mt-2 space-y-3 border-t border-[var(--line-soft)] pt-2">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="border-b border-[var(--line-soft)] text-[var(--ink-faint)]">
                <tr>
                  <th className="pb-1.5 pr-2 font-medium">Pos</th>
                  <th className="pb-1.5 pr-2 text-right font-medium">Rencana</th>
                  <th className="pb-1.5 pr-2 text-right font-medium">Pakai</th>
                  <th className="pb-1.5 text-right font-medium">Sisa</th>
                </tr>
              </thead>
              <tbody>
                {projectFundKinds.map((kind) => {
                  const planned = plannedOf(kind);
                  const spent = spentByKind[kind] ?? 0;
                  const remaining = planned - spent;
                  return (
                    <tr key={kind} className="border-b border-[var(--line-soft)]">
                      <td className="py-1.5 pr-2 text-[var(--ink)]">
                        {projectFundLabels[kind]}
                        {kind === "SAVE" ? (
                          <span className="text-[var(--ink-faint)]">
                            {" "}
                            · {PROJECT_SAVE_PERCENT}%
                          </span>
                        ) : null}
                      </td>
                      <td className="py-1.5 pr-2 text-right tabular-nums whitespace-nowrap">
                        {formatRupiah(planned)}
                      </td>
                      <td className="py-1.5 pr-2 text-right tabular-nums whitespace-nowrap text-[var(--rose-ink)]">
                        {formatRupiah(spent)}
                      </td>
                      <td
                        className={`py-1.5 text-right tabular-nums whitespace-nowrap ${
                          remaining < 0
                            ? "text-[var(--rose-ink)]"
                            : "text-[var(--ink)]"
                        }`}
                      >
                        {formatRupiah(remaining)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ManagementFundBreakdown
            projectId={projectId}
            planned={plannedOf("MANAGEMENT")}
            spent={spentByKind.MANAGEMENT ?? 0}
            rows={managementExpenses}
            canEdit={canRecordManagement}
          />

          {admin ? (
            <details>
              <summary className="cursor-pointer text-xs text-[var(--accent)] underline">
                Atur rencana
              </summary>
              <div className="mt-2 max-w-xl">
                <ActionForm
                  action={upsertProjectFundsAction}
                  submitLabel="Simpan rencana"
                >
                  <input type="hidden" name="projectId" value={projectId} />
                  {projectFundKinds.map((kind) => {
                    const row = byKind.get(kind);
                    const defaultPlanned =
                      row?.plannedAmount ??
                      (kind === "SAVE" ? suggestedSave : 0);
                    return (
                      <div key={kind} className="mb-2 space-y-1.5">
                        <p className="text-xs font-medium text-[var(--ink)]">
                          {projectFundLabels[kind]}
                        </p>
                        <Field label="Rencana">
                          <RupiahInput
                            name={`planned_${kind}`}
                            defaultValue={defaultPlanned}
                          />
                        </Field>
                        <Field label="Catatan">
                          <input
                            name={`notes_${kind}`}
                            className={inputClass}
                            defaultValue={row?.notes ?? ""}
                          />
                        </Field>
                      </div>
                    );
                  })}
                </ActionForm>
              </div>
            </details>
          ) : null}
        </div>
      </details>
    </Card>
  );
}
