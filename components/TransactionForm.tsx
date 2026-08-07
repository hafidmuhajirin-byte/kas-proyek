"use client";

import { useMemo, useState } from "react";
import { useActionState } from "react";
import type { FormState } from "@/lib/actions/projects";
import { RupiahInput } from "@/components/RupiahInput";
import { ProofCapture } from "@/components/ProofCapture";
import {
  Alert,
  btnPrimaryClass,
  Field,
  inputClass,
} from "@/components/ui";
import { formatRupiah } from "@/lib/money";
import type { ReceiptOcrSuggestion } from "@/lib/receipt-ocr";

type Option = { id: string; name: string; type?: string };
type ProjectOption = {
  id: string;
  name: string;
  billingMode?: "ON_REQUEST" | "TERMIN_PLAN" | "PAY_AT_END";
  contractValue?: number;
  paidIncome?: number;
  workCompletedValue?: number;
};
type StageOption = {
  id: string;
  name: string;
  projectId: string;
  percent: number;
  plannedAmount: number;
};

export function TransactionForm({
  action,
  projects,
  sources,
  categories,
  stages,
  globalCashBalance = 0,
  globalCashTunai = 0,
  globalCashBank = 0,
  defaults,
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  projects: ProjectOption[];
  sources: Option[];
  categories: Option[];
  stages: StageOption[];
  globalCashBalance?: number;
  globalCashTunai?: number;
  globalCashBank?: number;
  defaults?: {
    id?: string;
    date?: string;
    type?: "INCOME" | "EXPENSE";
    amount?: number;
    description?: string;
    projectId?: string;
    cashSourceId?: string;
    categoryId?: string;
    fundingStageId?: string | null;
    isOwnerPersonal?: boolean;
    isFromGlobalCash?: boolean;
    proofUrl?: string | null;
  };
  submitLabel: string;
}) {
  const [type, setType] = useState<"INCOME" | "EXPENSE">(
    defaults?.type ?? "EXPENSE",
  );
  const [projectId, setProjectId] = useState(defaults?.projectId ?? "");
  const [incomeMode, setIncomeMode] = useState<"REQUEST" | "TERMIN">(
    defaults?.fundingStageId ? "TERMIN" : "REQUEST",
  );
  const [isOwnerPersonal, setIsOwnerPersonal] = useState(
    Boolean(defaults?.isOwnerPersonal),
  );
  const [isFromGlobalCash, setIsFromGlobalCash] = useState(
    Boolean(defaults?.isFromGlobalCash),
  );
  const [amountKey, setAmountKey] = useState(0);
  const [amountDefault, setAmountDefault] = useState(defaults?.amount ?? 0);
  const [descriptionKey, setDescriptionKey] = useState(0);
  const [descriptionDefault, setDescriptionDefault] = useState(
    defaults?.description ?? "",
  );

  function applyOcrSuggestion(suggestion: ReceiptOcrSuggestion) {
    if (suggestion.amount != null && suggestion.amount > 0) {
      setAmountDefault(suggestion.amount);
      setAmountKey((k) => k + 1);
    }
    if (suggestion.descriptionHint) {
      setDescriptionDefault(suggestion.descriptionHint);
      setDescriptionKey((k) => k + 1);
    }
  }
  const [state, formAction, pending] = useActionState(action, {});

  const filteredCategories = useMemo(
    () => categories.filter((c) => c.type === type),
    [categories, type],
  );

  const projectStages = useMemo(
    () => stages.filter((s) => s.projectId === projectId),
    [stages, projectId],
  );

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === projectId),
    [projects, projectId],
  );
  const isPayAtEnd = selectedProject?.billingMode === "PAY_AT_END";
  const contractValue = selectedProject?.contractValue ?? 0;
  const paidIncome = selectedProject?.paidIncome ?? 0;
  const workCompletedValue = selectedProject?.workCompletedValue ?? 0;
  const remainingContract = Math.max(0, contractValue - paidIncome);
  const remainingWork = Math.max(0, workCompletedValue - paidIncome);
  const kasBesarHabis = globalCashBalance <= 0;

  return (
    <form action={formAction} className="space-y-4">
      {defaults?.id ? <input type="hidden" name="id" value={defaults.id} /> : null}
      {state.error ? <Alert>{state.error}</Alert> : null}

      {kasBesarHabis ? (
        <Alert>
          Kas besar {globalCashBalance < 0 ? "minus" : "habis"} (
          {formatRupiah(globalCashBalance)}). Wajib catat{" "}
          <strong>setoran dana pribadi</strong> sebelum pengeluaran baru.
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tanggal" htmlFor="date">
          <input
            id="date"
            name="date"
            type="date"
            className={inputClass}
            defaultValue={defaults?.date}
            required
          />
        </Field>
        <Field label="Jenis" htmlFor="type">
          <select
            id="type"
            name="type"
            className={inputClass}
            value={type}
            onChange={(e) => {
              const next = e.target.value as "INCOME" | "EXPENSE";
              setType(next);
              setIsOwnerPersonal(false);
              if (next === "INCOME") setIsFromGlobalCash(false);
            }}
          >
            <option value="INCOME">Pemasukan</option>
            <option value="EXPENSE">Pengeluaran</option>
          </select>
        </Field>
        <Field
          label={
            type === "EXPENSE" && isOwnerPersonal
              ? "Proyek (opsional)"
              : "Proyek"
          }
          htmlFor="projectId"
        >
          <select
            id="projectId"
            name="projectId"
            className={inputClass}
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            required={!(type === "EXPENSE" && isOwnerPersonal)}
          >
            <option value="">
              {type === "EXPENSE" && isOwnerPersonal
                ? "Tanpa proyek — pembukuan pribadi"
                : "Pilih proyek"}
            </option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Sumber kas" htmlFor="cashSourceId">
          <select
            id="cashSourceId"
            name="cashSourceId"
            className={inputClass}
            defaultValue={defaults?.cashSourceId}
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
        <Field label="Kategori" htmlFor="categoryId">
          <select
            key={type}
            id="categoryId"
            name="categoryId"
            className={inputClass}
            defaultValue={
              defaults?.type === type ? defaults?.categoryId : undefined
            }
            required
          >
            <option value="">Pilih kategori</option>
            {filteredCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Nominal" htmlFor="amount">
          <RupiahInput
            key={amountKey}
            id="amount"
            name="amount"
            defaultValue={amountDefault}
            required
            placeholder="0"
          />
        </Field>
      </div>

      <div className="rounded-xl border border-teal-900/10 bg-white/80 px-3 py-2.5 text-xs text-teal-900/70">
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          <span>
            Kas besar: <strong>{formatRupiah(globalCashBalance)}</strong>
          </span>
          <span>
            Tunai <strong>{formatRupiah(globalCashTunai)}</strong>
          </span>
          <span>
            Bank <strong>{formatRupiah(globalCashBank)}</strong>
          </span>
        </div>
      </div>

      {type === "INCOME" ? (
        <div className="space-y-3 rounded-2xl border border-teal-900/10 bg-teal-50/50 p-4">
          <p className="text-sm font-medium text-teal-950">Jenis pemasukan</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <label
              className={`cursor-pointer rounded-xl border px-3 py-3 text-sm ${
                !isOwnerPersonal
                  ? "border-teal-700 bg-white shadow-sm"
                  : "border-teal-900/10 bg-white/50"
              }`}
            >
              <input
                type="radio"
                name="incomeKindUi"
                className="mr-2"
                checked={!isOwnerPersonal}
                onChange={() => setIsOwnerPersonal(false)}
              />
              <span className="font-medium">Pembayaran klien</span>
              <span className="mt-1 block text-xs text-teal-900/60">
                Dihitung ke progress kontrak / pekerjaan.
              </span>
            </label>
            <label
              className={`cursor-pointer rounded-xl border px-3 py-3 text-sm ${
                isOwnerPersonal
                  ? "border-amber-600 bg-white shadow-sm"
                  : "border-teal-900/10 bg-white/50"
              }`}
            >
              <input
                type="radio"
                name="incomeKindUi"
                className="mr-2"
                checked={isOwnerPersonal}
                onChange={() => {
                  setIsOwnerPersonal(true);
                  setIncomeMode("REQUEST");
                }}
              />
              <span className="font-medium">Setoran dana pribadi</span>
              <span className="mt-1 block text-xs text-teal-900/60">
                Wajib jika kas besar habis/minus. Menambah kas besar.
              </span>
            </label>
          </div>
          {isOwnerPersonal ? (
            <input type="hidden" name="isOwnerPersonal" value="on" />
          ) : (
            <input type="hidden" name="isOwnerPersonal" value="" />
          )}
        </div>
      ) : null}

      {type === "INCOME" && projectId && !isOwnerPersonal ? (
        <div className="rounded-xl border border-teal-900/10 bg-white/80 px-3 py-2 text-xs text-teal-900/70">
          {isPayAtEnd ? (
            workCompletedValue > 0 ? (
              <>
                Proyek kerja-dulu (tanpa kontrak). Nilai pekerjaan selesai{" "}
                <strong>{formatRupiah(workCompletedValue)}</strong> · Sudah
                dibayar <strong>{formatRupiah(paidIncome)}</strong> · Sisa
                maksimal <strong>{formatRupiah(remainingWork)}</strong>.
              </>
            ) : (
              <>
                Proyek kerja-dulu tidak memakai nilai kontrak. Catat pekerjaan
                selesai dulu di detail proyek, baru catat pembayaran di akhir.
              </>
            )
          ) : contractValue > 0 ? (
            <>
              Nilai kontrak <strong>{formatRupiah(contractValue)}</strong> ·
              Sudah diterima <strong>{formatRupiah(paidIncome)}</strong> · Sisa
              maksimal <strong>{formatRupiah(remainingContract)}</strong>. Total
              pembayaran klien tidak boleh melebihi kontrak.
            </>
          ) : (
            <>
              Nilai kontrak belum diisi. Isi nilai kontrak di halaman proyek
              sebelum mencatat pembayaran dari klien.
            </>
          )}
        </div>
      ) : null}

      {type === "INCOME" && isOwnerPersonal ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950/80">
          Setoran dana pribadi menambah <strong>kas besar</strong> dan tidak
          dihitung sebagai pembayaran klien (tidak mengurangi sisa kontrak /
          piutang).
        </div>
      ) : null}

      {type === "EXPENSE" ? (
        <div className="space-y-3">
          {isOwnerPersonal ? (
            <>
              <input type="hidden" name="isFromGlobalCash" value="" />
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-950/80">
                Ambil pribadi owner: dana keluar dari <strong>kas besar</strong>
                , tanpa wajib proyek, dan tercatat di laporan dana pribadi
                owner.
                {projectId
                  ? " Proyek dipilih → juga mengurangi sisa target fee proyek itu."
                  : ""}
              </div>
            </>
          ) : (
            <>
              <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-950/75">
                Pengeluaran proyek: material/upah, di luar pemborong, atau pos
                dana operasional. Dana ke pemborong dicatat di detail proyek.
              </div>

              <div
                className={`rounded-2xl border p-4 ${
                  isFromGlobalCash
                    ? "border-teal-600 bg-teal-50/80"
                    : "border-teal-900/10 bg-white/80"
                }`}
              >
                <label className="flex cursor-pointer items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    name="isFromGlobalCash"
                    className="mt-1"
                    checked={isFromGlobalCash}
                    onChange={(e) => setIsFromGlobalCash(e.target.checked)}
                  />
                  <span>
                    <span className="font-medium text-teal-950">
                      Masuk ke kas besar
                    </span>
                    <span className="mt-1 block text-xs text-teal-900/65">
                      Kas proyek turun, kas besar tetap (mis. sisa dana save).
                    </span>
                  </span>
                </label>
              </div>
            </>
          )}

          <div className="rounded-2xl border border-rose-200/70 bg-rose-50/60 p-4">
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="checkbox"
                name="isOwnerPersonal"
                className="mt-1"
                checked={isOwnerPersonal}
                onChange={(e) => {
                  setIsOwnerPersonal(e.target.checked);
                  if (e.target.checked) {
                    setIsFromGlobalCash(false);
                    setProjectId("");
                  }
                }}
              />
              <span>
                <span className="font-medium text-rose-950">
                  Ambil pribadi owner (dari kas besar)
                </span>
                <span className="mt-1 block text-xs text-rose-900/65">
                  Bukan pengeluaran proyek. Proyek tidak wajib — masuk
                  pembukuan dana pribadi owner. Mengurangi kas besar
                  {projectId ? " dan sisa fee proyek (jika dipilih)" : ""}.
                </span>
              </span>
            </label>
          </div>
        </div>
      ) : (
        <input type="hidden" name="isFromGlobalCash" value="" />
      )}

      {type === "INCOME" && !isOwnerPersonal ? (
        <div className="space-y-3 rounded-2xl border border-teal-900/10 bg-teal-50/50 p-4">
          <p className="text-sm font-medium text-teal-950">
            Jenis pembayaran kas
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <label
              className={`cursor-pointer rounded-xl border px-3 py-3 text-sm ${
                incomeMode === "REQUEST"
                  ? "border-teal-700 bg-white shadow-sm"
                  : "border-teal-900/10 bg-white/50"
              }`}
            >
              <input
                type="radio"
                name="incomeModeUi"
                className="mr-2"
                checked={incomeMode === "REQUEST"}
                onChange={() => setIncomeMode("REQUEST")}
              />
              <span className="font-medium">Sesuai permintaan</span>
              <span className="mt-1 block text-xs text-teal-900/60">
                Nominal bebas, selama total tidak melebihi nilai kontrak.
              </span>
            </label>
            <label
              className={`cursor-pointer rounded-xl border px-3 py-3 text-sm ${
                incomeMode === "TERMIN"
                  ? "border-teal-700 bg-white shadow-sm"
                  : "border-teal-900/10 bg-white/50"
              }`}
            >
              <input
                type="radio"
                name="incomeModeUi"
                className="mr-2"
                checked={incomeMode === "TERMIN"}
                onChange={() => setIncomeMode("TERMIN")}
              />
              <span className="font-medium">Catat ke rencana termin</span>
              <span className="mt-1 block text-xs text-teal-900/60">
                Opsional untuk pantau rencana. Tetap dibatasi nilai kontrak.
              </span>
            </label>
          </div>

          {incomeMode === "REQUEST" ? (
            <input type="hidden" name="fundingStageId" value="" />
          ) : (
            <Field
              label="Rencana termin (opsional pelacakan)"
              htmlFor="fundingStageId"
            >
              <select
                key={projectId}
                id="fundingStageId"
                name="fundingStageId"
                className={inputClass}
                defaultValue={defaults?.fundingStageId ?? ""}
              >
                <option value="">Pilih termin untuk pelacakan</option>
                {projectStages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · rencana {s.percent}% (
                    {s.plannedAmount.toLocaleString("id-ID")})
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
      ) : type === "INCOME" && isOwnerPersonal ? (
        <input type="hidden" name="fundingStageId" value="" />
      ) : null}

      <Field
        label={
          type === "INCOME" && isOwnerPersonal
            ? "Keterangan setoran"
            : type === "EXPENSE" && isOwnerPersonal
              ? "Keterangan keperluan pribadi"
              : "Keterangan"
        }
        htmlFor="description"
      >
        <textarea
          key={descriptionKey}
          id="description"
          name="description"
          className={inputClass}
          rows={3}
          defaultValue={descriptionDefault}
          placeholder={
            type === "INCOME" && isOwnerPersonal
              ? "Contoh: Setor dana pribadi karena kas besar habis"
              : type === "EXPENSE" && isOwnerPersonal
                ? "Contoh: Ambil kas untuk keperluan pribadi"
                : "Contoh: Pembayaran termin dari klien"
          }
          required
        />
      </Field>

      <Field label="Bukti / nota (opsional)">
        <ProofCapture
          existingProofUrl={defaults?.proofUrl}
          onApplySuggestion={applyOcrSuggestion}
        />
      </Field>

      <button
        type="submit"
        className={`${btnPrimaryClass} w-full sm:w-auto`}
        disabled={pending}
      >
        {pending ? "Menyimpan..." : submitLabel}
      </button>
    </form>
  );
}
