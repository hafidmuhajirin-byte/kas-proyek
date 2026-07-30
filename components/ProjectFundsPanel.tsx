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
import { RupiahInput } from "@/components/RupiahInput";
import { Card } from "@/components/ui";

type FundRow = {
  kind: string;
  plannedAmount: number;
  notes: string | null;
};

export function ProjectFundsPanel({
  projectId,
  admin,
  contractValue,
  funds,
  spentByKind,
}: {
  projectId: string;
  admin: boolean;
  contractValue: number;
  funds: FundRow[];
  spentByKind: Partial<Record<ProjectFundKind, number>>;
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
  const savePlanned = plannedOf("SAVE");
  const saveSpent = spentByKind.SAVE ?? 0;
  const saveRemaining = savePlanned - saveSpent;

  return (
    <Card className="mt-4">
      <details>
        <summary className="cursor-pointer list-none">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-base font-medium text-teal-950">
                Dana operasional
              </h3>
              <p className="mt-0.5 text-sm text-teal-900/55">
                Rencana {formatRupiah(totalPlanned)} · Terpakai{" "}
                {formatRupiah(totalSpent)} · Sisa{" "}
                {formatRupiah(totalPlanned - totalSpent)}
                {saveRemaining > 0
                  ? ` · save ${formatRupiah(saveRemaining)}`
                  : ""}
              </p>
            </div>
            <span className="text-sm text-teal-700">Buka</span>
          </div>
        </summary>

        <div className="mt-3 border-t border-teal-900/10 pt-3">
          <p className="text-sm text-teal-900/55">
            Termasuk dana save {PROJECT_SAVE_PERCENT}%. Pengeluaran lewat Buku
            Kas dengan kategori yang sesuai.
          </p>

          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-teal-900/10 text-teal-900/55">
                <tr>
                  <th className="pb-2 pr-3 font-medium">Pos</th>
                  <th className="pb-2 pr-3 text-right font-medium">Rencana</th>
                  <th className="pb-2 pr-3 text-right font-medium">Terpakai</th>
                  <th className="pb-2 text-right font-medium">Sisa</th>
                </tr>
              </thead>
              <tbody>
                {projectFundKinds.map((kind) => {
                  const planned = plannedOf(kind);
                  const spent = spentByKind[kind] ?? 0;
                  const remaining = planned - spent;
                  return (
                    <tr key={kind} className="border-b border-teal-900/6">
                      <td className="py-2 pr-3 text-teal-950">
                        {projectFundLabels[kind]}
                        {kind === "SAVE" ? (
                          <span className="text-teal-900/55">
                            {" "}
                            · {PROJECT_SAVE_PERCENT}%
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums whitespace-nowrap">
                        {formatRupiah(planned)}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums whitespace-nowrap text-rose-700">
                        {formatRupiah(spent)}
                      </td>
                      <td
                        className={`py-2 text-right tabular-nums whitespace-nowrap ${
                          remaining < 0 ? "text-rose-700" : "text-teal-950"
                        }`}
                      >
                        {formatRupiah(remaining)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-teal-900/15">
                  <td className="py-2.5 pr-3 font-medium text-teal-950">
                    Total
                  </td>
                  <td className="py-2.5 pr-3 text-right font-medium tabular-nums whitespace-nowrap">
                    {formatRupiah(totalPlanned)}
                  </td>
                  <td className="py-2.5 pr-3 text-right font-medium tabular-nums whitespace-nowrap text-rose-700">
                    {formatRupiah(totalSpent)}
                  </td>
                  <td className="py-2.5 text-right font-medium tabular-nums whitespace-nowrap text-teal-950">
                    {formatRupiah(totalPlanned - totalSpent)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {admin ? (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-teal-700 underline">
                Atur rencana dana
              </summary>
              <div className="mt-3 max-w-xl">
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
                      <div key={kind} className="mb-3 space-y-2">
                        <p className="text-sm font-medium text-teal-950">
                          {projectFundLabels[kind]}
                          {kind === "SAVE" && contractValue > 0 ? (
                            <span className="font-normal text-teal-900/55">
                              {" "}
                              (saran {formatRupiah(suggestedSave)})
                            </span>
                          ) : null}
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
