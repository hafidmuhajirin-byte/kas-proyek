"use client";

import { useState } from "react";
import { Field, inputClass } from "@/components/ui";
import { RupiahInput } from "@/components/RupiahInput";

export function ProjectBillingFields({
  defaultBillingMode = "ON_REQUEST",
  defaultContractValue = 0,
  defaultOpeningBalance = 0,
  showOpeningBalance = true,
}: {
  defaultBillingMode?: "ON_REQUEST" | "TERMIN_PLAN" | "PAY_AT_END";
  defaultContractValue?: number;
  defaultOpeningBalance?: number;
  showOpeningBalance?: boolean;
}) {
  const [billingMode, setBillingMode] = useState(defaultBillingMode);
  const isPayAtEnd = billingMode === "PAY_AT_END";

  return (
    <>
      <Field label="Mode pembayaran">
        <select
          name="billingMode"
          className={inputClass}
          value={billingMode}
          onChange={(e) =>
            setBillingMode(
              e.target.value as "ON_REQUEST" | "TERMIN_PLAN" | "PAY_AT_END",
            )
          }
        >
          <option value="ON_REQUEST">Bayar sesuai permintaan</option>
          <option value="TERMIN_PLAN">Ada rencana termin</option>
          <option value="PAY_AT_END">Kerja dulu, bayar di akhir</option>
        </select>
      </Field>

      {isPayAtEnd ? (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-950/75">
          Mode ini <strong>tidak memakai nilai kontrak</strong>. Pembiayaan awal
          kosong — pengeluaran ambil dari <strong>kas besar</strong>. Jika kas
          besar habis/minus, wajib <strong>setor dana pribadi</strong>. Tagihan
          dihitung dari pekerjaan selesai, dibayar di akhir.
          <input type="hidden" name="contractValue" value="0" />
          {showOpeningBalance ? (
            <input type="hidden" name="openingBalance" value="0" />
          ) : null}
        </div>
      ) : (
        <>
          <Field label="Nilai kontrak">
            <RupiahInput
              name="contractValue"
              defaultValue={defaultContractValue}
              required
            />
          </Field>
          {showOpeningBalance ? (
            <Field
              label="Saldo awal kas (opsional)"
              hint="Kosongkan jika belum ada dana. Pengeluaran otomatis ambil dari kas besar."
            >
              <RupiahInput
                name="openingBalance"
                defaultValue={defaultOpeningBalance}
                placeholder="0"
              />
            </Field>
          ) : null}
        </>
      )}
    </>
  );
}
