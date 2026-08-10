"use client";

import Link from "next/link";
import {
  markProjectCompletedAction,
  reopenProjectAction,
  updateProjectChecklistAction,
} from "@/lib/actions/projects";
import { releaseSaveFundToGlobalAction } from "@/lib/actions/project-funds";
import { formatRupiah } from "@/lib/money";
import {
  checklistProgressPercent,
  countCheckedChecklist,
  isChecklistComplete,
  projectChecklistKeys,
  projectChecklistLabels,
  type ProjectChecklistState,
} from "@/lib/project-completion";
import { ActionForm, Field, inputClass } from "@/components/ActionForm";
import { btnSecondaryClass, Card } from "@/components/ui";

export function ProjectCompletionPanel({
  projectId,
  admin,
  status,
  projectCash,
  checks,
  saveRemaining,
  sources,
}: {
  projectId: string;
  admin: boolean;
  status: "ACTIVE" | "COMPLETED";
  projectCash: number;
  checks: ProjectChecklistState;
  saveRemaining: number;
  sources: { id: string; name: string }[];
}) {
  const checkedCount = countCheckedChecklist(checks);
  const total = projectChecklistKeys.length;
  const progress = checklistProgressPercent(checks);
  const cashCleared = projectCash === 0;
  const canComplete =
    isChecklistComplete(checks) && cashCleared && status !== "COMPLETED";
  const canReleaseSave =
    checks.checkNoRetention && saveRemaining > 0 && projectCash > 0;

  return (
    <Card className="mt-2">
      <details>
        <summary className="cursor-pointer list-none">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-medium text-[var(--ink)]">
                Penyelesaian
              </h3>
              <p className="mt-0.5 text-[11px] text-[var(--ink-faint)]">
                Checklist {checkedCount}/{total} · kas {formatRupiah(projectCash)}
              </p>
            </div>
            <span className="text-xs text-[var(--accent)]">Buka</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-teal-900/10">
            <div
              className="h-full rounded-full bg-teal-700"
              style={{ width: `${progress}%` }}
            />
          </div>
        </summary>

        <div className="mt-2 border-t border-teal-900/10 pt-2">
          {admin ? (
            <ActionForm
              action={updateProjectChecklistAction}
              submitLabel="Simpan checklist"
              className="space-y-2"
            >
              <input type="hidden" name="id" value={projectId} />
              {projectChecklistKeys.map((key) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-start gap-3 rounded-xl border border-teal-900/10 bg-white/70 px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    name={key}
                    className="mt-0.5"
                    defaultChecked={checks[key]}
                  />
                  <span className="text-teal-950">
                    {projectChecklistLabels[key]}
                  </span>
                </label>
              ))}
            </ActionForm>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {projectChecklistKeys.map((key) => (
                <li key={key} className="flex items-center gap-2 text-teal-950">
                  <span
                    className={
                      checks[key] ? "text-teal-700" : "text-teal-900/35"
                    }
                  >
                    {checks[key] ? "✓" : "○"}
                  </span>
                  {projectChecklistLabels[key]}
                </li>
              ))}
            </ul>
          )}

          {admin && (canReleaseSave || checks.checkNoRetention) ? (
            <div className="mt-4 rounded-xl border border-teal-900/10 bg-teal-50/50 px-3 py-3 text-sm">
              <p className="font-medium text-teal-950">
                Sisa dana save → kas besar
              </p>
              <p className="mt-1 text-teal-900/65">
                Sisa {formatRupiah(saveRemaining)} · Kas proyek{" "}
                {formatRupiah(projectCash)}. Setelah 100% tanpa retensi, sisa
                masuk kas besar.
              </p>
              {canReleaseSave ? (
                <div className="mt-3 max-w-sm">
                  <ActionForm
                    action={releaseSaveFundToGlobalAction}
                    submitLabel="Masukkan sisa ke kas besar"
                  >
                    <input type="hidden" name="projectId" value={projectId} />
                    <Field label="Sumber kas">
                      <select
                        name="cashSourceId"
                        className={inputClass}
                        required
                      >
                        <option value="">Pilih sumber</option>
                        {sources.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </ActionForm>
                </div>
              ) : (
                <p className="mt-2 text-teal-900/55">
                  {saveRemaining <= 0
                    ? "Tidak ada sisa dana save."
                    : "Kas proyek sudah kosong."}
                </p>
              )}
            </div>
          ) : null}

          <div
            className={`mt-4 rounded-xl border px-3 py-3 text-sm ${
              cashCleared
                ? "border-teal-600/40 bg-teal-50 text-teal-950"
                : "border-amber-200 bg-amber-50 text-amber-950"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">
                {cashCleared ? "✓" : "○"} Kas proyek dikosongkan
              </span>
              <span className="tabular-nums font-medium">
                {formatRupiah(projectCash)}
              </span>
            </div>
        {!cashCleared ? (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-amber-900/70">
              Ambil pribadi mengurangi kas besar &amp; fee, bukan kas proyek.
              Untuk mengosongkan kas proyek gunakan sisa ke sekolah atau
              pengeluaran proyek.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
              href={`/transactions/new?type=EXPENSE&ownerPersonal=1`}
              className={btnSecondaryClass}
            >
              Ambil pribadi (kas besar)
            </Link>
              <Link
                href={`/transactions/new?projectId=${projectId}&type=EXPENSE&schoolResidual=1`}
                className={btnSecondaryClass}
              >
                Sisa ke sekolah
              </Link>
            </div>
          </div>
        ) : null}
          </div>

          {admin ? (
            <div className="mt-4">
              {status === "COMPLETED" ? (
                <ActionForm
                  action={reopenProjectAction}
                  submitLabel="Buka kembali (aktif)"
                >
                  <input type="hidden" name="id" value={projectId} />
                </ActionForm>
              ) : canComplete ? (
                <ActionForm
                  action={markProjectCompletedAction}
                  submitLabel="Tandai selesai"
                >
                  <input type="hidden" name="id" value={projectId} />
                </ActionForm>
              ) : (
                <p className="text-sm text-rose-700">
                  Lengkapi checklist dan pastikan kas proyek = Rp 0.
                </p>
              )}
            </div>
          ) : null}
        </div>
      </details>
    </Card>
  );
}
