import Link from "next/link";
import {
  createProjectAction,
  deleteProjectAction,
  updateProjectAction,
} from "@/lib/actions/projects";
import { getProjectBalances } from "@/lib/balance";
import { isOwner, requireSession } from "@/lib/auth";
import { formatRupiah } from "@/lib/money";
import { billingModeLabels, projectStatusLabels } from "@/lib/labels";
import { tidyCase } from "@/lib/text";
import { ActionForm, Field, inputClass } from "@/components/ActionForm";
import { ProjectBillingFields } from "@/components/ProjectBillingFields";
import {
  Alert,
  btnDangerClass,
  btnSecondaryClass,
  Card,
  EmptyState,
  PageHeader,
} from "@/components/ui";

type StatusFilter = "ACTIVE" | "COMPLETED" | "ALL";

function parseStatus(value?: string): StatusFilter {
  if (value === "COMPLETED" || value === "ALL" || value === "ACTIVE") {
    return value;
  }
  return "ACTIVE";
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    status?: string;
    location?: string;
    hide?: string;
  }>;
}) {
  const user = await requireSession();
  const admin = isOwner(user);
  const balances = await getProjectBalances();
  const params = await searchParams;

  const statusFilter = parseStatus(params.status);
  const locationFilter = params.location?.trim() || "";
  const hideDetail = params.hide === "1";

  const locations = [
    ...new Set(balances.map((p) => p.location).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b, "id"));

  const filtered = balances.filter((project) => {
    if (statusFilter !== "ALL" && project.status !== statusFilter) {
      return false;
    }
    if (locationFilter && project.location !== locationFilter) {
      return false;
    }
    return true;
  });

  const hasCustomFilter =
    statusFilter !== "ACTIVE" || Boolean(locationFilter) || hideDetail;

  return (
    <div>
      <PageHeader
        title="Proyek"
        description="Pilih mode: bayar sesuai permintaan, rencana termin, atau kerja dulu bayar di akhir berdasarkan pekerjaan selesai."
      />

      {params.error ? (
        <div className="mb-4">
          <Alert>{params.error}</Alert>
        </div>
      ) : null}

      <form
        method="get"
        className="mb-4 flex flex-wrap items-end gap-2 rounded-xl border border-[var(--line-soft)] bg-[var(--surface)] p-3 sm:p-4"
      >
        <label className="min-w-[8rem] flex-1 space-y-1 sm:max-w-[11rem]">
          <span className="text-xs font-medium text-[var(--ink-faint)]">
            Status
          </span>
          <select
            name="status"
            defaultValue={statusFilter}
            className={inputClass}
          >
            <option value="ACTIVE">Aktif saja</option>
            <option value="COMPLETED">Selesai saja</option>
            <option value="ALL">Semua status</option>
          </select>
        </label>

        <label className="min-w-[9rem] flex-1 space-y-1">
          <span className="text-xs font-medium text-[var(--ink-faint)]">
            Lokasi
          </span>
          <select
            name="location"
            defaultValue={locationFilter}
            className={inputClass}
          >
            <option value="">Semua lokasi</option>
            {locations.map((loc) => (
              <option key={loc} value={loc}>
                {tidyCase(loc)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 pb-2.5 text-sm text-[var(--ink)]/85">
          <input
            type="checkbox"
            name="hide"
            value="1"
            defaultChecked={hideDetail}
            className="size-4 rounded border-[var(--line)] accent-[var(--accent)]"
          />
          Sembunyikan detail
        </label>

        <button type="submit" className={`${btnSecondaryClass} w-full sm:w-auto`}>
          Terapkan
        </button>

        {hasCustomFilter ? (
          <Link
            href="/projects"
            className="pb-2.5 text-sm text-[var(--ink-faint)] underline-offset-2 hover:underline"
          >
            Reset
          </Link>
        ) : null}

        <p className="w-full text-sm text-[var(--ink-faint)] sm:ml-auto sm:w-auto sm:pb-2.5">
          {filtered.length} dari {balances.length} proyek
        </p>
      </form>

      <div className={`grid gap-6 ${admin ? "lg:grid-cols-[1fr_320px]" : ""}`}>
        <Card className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
          {filtered.length === 0 ? (
            <EmptyState message="Tidak ada proyek untuk filter ini." />
          ) : (
            <table className="min-w-[640px] text-left text-sm">
              <thead className="border-b border-teal-900/10 text-xs tracking-wide text-teal-900/55 uppercase">
                <tr>
                  <th className="pb-3 pr-3 font-medium">Proyek</th>
                  <th className="pb-3 pr-3 font-medium">Lokasi</th>
                  {hideDetail ? null : (
                    <th className="pb-3 pr-3 font-medium">Progress bayar</th>
                  )}
                  <th className="pb-3 pr-3 font-medium text-right">Saldo</th>
                  <th className="pb-3 font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((project) => (
                  <tr
                    key={project.id}
                    className="border-b border-teal-900/5 align-top"
                  >
                    <td className="py-3 pr-3">
                      <Link
                        href={`/projects/${project.id}`}
                        className="font-medium text-teal-950 hover:underline"
                      >
                        {tidyCase(project.name)}
                      </Link>
                      <p className="text-xs text-teal-900/50">
                        {projectStatusLabels[project.status]} ·{" "}
                        {billingModeLabels[project.billingMode]}
                      </p>
                      {hideDetail ? null : project.billingMode ===
                        "PAY_AT_END" ? (
                        <p className="mt-0.5 text-xs font-medium text-sky-800">
                          Kerja {formatRupiah(project.workCompletedValue)} ·
                          tanpa kontrak & saldo awal
                        </p>
                      ) : (
                        <p className="mt-0.5 text-xs font-medium text-teal-800">
                          Kontrak {formatRupiah(project.contractValue)}
                        </p>
                      )}
                      {admin && !hideDetail ? (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs text-teal-700">
                            Edit cepat
                          </summary>
                          <div className="mt-2 max-w-md">
                            <ActionForm
                              action={updateProjectAction}
                              submitLabel="Update"
                            >
                              <input
                                type="hidden"
                                name="id"
                                value={project.id}
                              />
                              <Field label="Nama">
                                <input
                                  name="name"
                                  className={inputClass}
                                  defaultValue={project.name}
                                  required
                                />
                              </Field>
                              <Field label="Lokasi">
                                <input
                                  name="location"
                                  className={inputClass}
                                  defaultValue={project.location}
                                  required
                                />
                              </Field>
                              <Field label="Status">
                                <select
                                  name="status"
                                  className={inputClass}
                                  defaultValue={project.status}
                                >
                                  <option value="ACTIVE">Aktif</option>
                                  <option value="COMPLETED">Selesai</option>
                                </select>
                                <p className="mt-1 text-xs text-teal-900/50">
                                  Status Selesai hanya jika checklist di detail
                                  proyek lengkap dan kas proyek = Rp 0.
                                </p>
                              </Field>
                              <ProjectBillingFields
                                defaultBillingMode={project.billingMode}
                                defaultContractValue={project.contractValue}
                                defaultOpeningBalance={project.openingBalance}
                              />
                              <Field label="Catatan">
                                <textarea
                                  name="notes"
                                  className={inputClass}
                                  rows={2}
                                />
                              </Field>
                            </ActionForm>
                          </div>
                        </details>
                      ) : null}
                    </td>
                    <td className="py-3 pr-3 text-teal-900/75">
                      {tidyCase(project.location)}
                    </td>
                    {hideDetail ? null : (
                      <td className="py-3 pr-3">
                        <div className="min-w-[140px]">
                          {project.billingMode === "PAY_AT_END" ? (
                            <>
                              <div className="mb-1 flex justify-between text-xs text-teal-900/60">
                                <span>{project.workPaidPercent}% dibayar</span>
                                <span>
                                  Piutang {formatRupiah(project.receivable)}
                                </span>
                              </div>
                              <div className="h-2 overflow-hidden rounded-full bg-teal-900/10">
                                <div
                                  className="h-full rounded-full bg-teal-700"
                                  style={{
                                    width: `${project.workPaidPercent}%`,
                                  }}
                                />
                              </div>
                              <p className="mt-1 text-xs text-teal-900/55">
                                Kerja {formatRupiah(project.workCompletedValue)}{" "}
                                · Bayar {formatRupiah(project.income)}
                              </p>
                            </>
                          ) : (
                            <>
                              <div className="mb-1 flex justify-between text-xs text-teal-900/60">
                                <span>{project.fundingProgressPercent}%</span>
                                <span>
                                  {project.billingMode === "TERMIN_PLAN"
                                    ? `${project.stages.length} tahap`
                                    : "sesuai permintaan"}
                                </span>
                              </div>
                              <div className="h-2 overflow-hidden rounded-full bg-teal-900/10">
                                <div
                                  className="h-full rounded-full bg-teal-700"
                                  style={{
                                    width: `${project.fundingProgressPercent}%`,
                                  }}
                                />
                              </div>
                              <p className="mt-1 text-xs text-teal-900/55">
                                Masuk {formatRupiah(project.income)}
                              </p>
                            </>
                          )}
                        </div>
                      </td>
                    )}
                    <td className="py-3 pr-3 text-right font-medium text-teal-900">
                      {formatRupiah(project.balance)}
                    </td>
                    <td className="py-3">
                      <div className="flex flex-col gap-2">
                        <Link
                          href={`/projects/${project.id}`}
                          className="text-xs text-teal-700 underline"
                        >
                          {project.billingMode === "PAY_AT_END"
                            ? "Pekerjaan & tagihan"
                            : project.billingMode === "TERMIN_PLAN"
                              ? "Tahapan dana"
                              : "Detail proyek"}
                        </Link>
                        {admin ? (
                          <form action={deleteProjectAction}>
                            <input
                              type="hidden"
                              name="id"
                              value={project.id}
                            />
                            <button type="submit" className={btnDangerClass}>
                              Hapus
                            </button>
                          </form>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        {admin ? (
          <Card>
            <h3 className="font-serif text-xl text-teal-950">Tambah proyek</h3>
            <p className="mt-1 text-xs text-teal-900/55">
              Saldo awal opsional. Kosong = ambil dari kas besar. Jika kas besar
              habis/minus, wajib setor dana pribadi.
            </p>
            <div className="mt-4">
              <ActionForm
                action={createProjectAction}
                submitLabel="Tambah proyek"
              >
                <Field label="Nama proyek">
                  <input name="name" className={inputClass} required />
                </Field>
                <Field label="Lokasi">
                  <input
                    name="location"
                    className={inputClass}
                    placeholder="Contoh: Bandung, Jakarta Barat"
                    required
                  />
                </Field>
                <Field label="Status">
                  <select
                    name="status"
                    className={inputClass}
                    defaultValue="ACTIVE"
                  >
                    <option value="ACTIVE">Aktif</option>
                  </select>
                </Field>
                <ProjectBillingFields />
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
