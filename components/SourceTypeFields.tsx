"use client";

import { useState } from "react";
import { Field, inputClass } from "@/components/ui";

export function SourceTypeFields({
  defaultType = "BANK",
  defaultAccountNumber = "",
}: {
  defaultType?: string;
  defaultAccountNumber?: string | null;
}) {
  const [type, setType] = useState(defaultType);
  const showAccount = type === "BANK" || type === "CLIENT_TRANSFER";

  return (
    <>
      <Field label="Jenis">
        <select
          name="type"
          className={inputClass}
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="BANK">Bank</option>
          <option value="CASH">Tunai</option>
          <option value="CLIENT_TRANSFER">Transfer Klien</option>
          <option value="OTHER">Lainnya</option>
        </select>
      </Field>
      {showAccount ? (
        <Field
          label="Nomor rekening"
          hint="Opsional, untuk memudahkan transfer ke rekening ini."
        >
          <input
            name="accountNumber"
            className={inputClass}
            defaultValue={defaultAccountNumber ?? ""}
            placeholder="Contoh: 1234567890"
            inputMode="numeric"
          />
        </Field>
      ) : (
        <input type="hidden" name="accountNumber" value="" />
      )}
    </>
  );
}
