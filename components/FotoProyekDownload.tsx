"use client";

import { useMemo, useState } from "react";
import { btnPrimaryClass, Field, inputClass } from "@/components/ui";

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

export function FotoProyekDownload({ projectId }: { projectId: string }) {
  const [from, setFrom] = useState(todayYmd);
  const [to, setTo] = useState(todayYmd);
  const [error, setError] = useState<string | null>(null);

  const href = useMemo(() => {
    const q = new URLSearchParams({
      projectId,
      from,
      to,
    });
    return `/api/foto-proyek/download?${q.toString()}`;
  }, [projectId, from, to]);

  return (
    <div className="space-y-3 rounded-xl border border-[var(--line-soft)] bg-[#fffcf7] p-3">
      <p className="text-sm font-medium text-[var(--ink)]">Download foto</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Dari tanggal" htmlFor="dl-from">
          <input
            id="dl-from"
            type="date"
            className={inputClass}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            required
          />
        </Field>
        <Field label="Sampai tanggal" htmlFor="dl-to">
          <input
            id="dl-to"
            type="date"
            className={inputClass}
            value={to}
            onChange={(e) => setTo(e.target.value)}
            required
          />
        </Field>
      </div>
      {error ? (
        <p className="text-sm text-[var(--rose-ink)]">{error}</p>
      ) : null}
      <a
        href={href}
        className={`${btnPrimaryClass} inline-flex min-h-12 items-center justify-center`}
        onClick={(e) => {
          if (!from || !to) {
            e.preventDefault();
            setError("Isi rentang tanggal.");
            return;
          }
          if (from > to) {
            e.preventDefault();
            setError("Dari tidak boleh setelah sampai.");
            return;
          }
          setError(null);
        }}
      >
        Download ZIP
      </a>
    </div>
  );
}
