"use client";

import { useState } from "react";
import { formatNumberId, parseRupiahInput } from "@/lib/money";
import { inputClass } from "@/components/ui";

export function RupiahInput({
  name,
  id,
  defaultValue = 0,
  required,
  placeholder = "Ketik nominal, contoh 1000000",
  className = inputClass,
}: {
  name: string;
  id?: string;
  defaultValue?: number;
  required?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const initial = defaultValue > 0 ? formatNumberId(defaultValue) : "";
  const [display, setDisplay] = useState(initial);

  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3 z-10 -translate-y-1/2 text-sm font-medium text-teal-900/55">
        Rp
      </span>
      <input
        id={id}
        name={name}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        className={`${className} pl-10`}
        value={display}
        placeholder={placeholder.replace(/^Rp\s*/i, "")}
        required={required}
        onChange={(e) => {
          const amount = parseRupiahInput(e.target.value);
          setDisplay(amount > 0 ? formatNumberId(amount) : "");
        }}
      />
    </div>
  );
}
