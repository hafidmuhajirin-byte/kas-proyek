import Link from "next/link";
import { formatRupiah } from "@/lib/money";
import { Card } from "@/components/ui";

/** Panel ringkas Buku Kas Tunai + unduh Excel / PDF. */
export function ProjectCashBookPanel({
  projectId,
  rowCount,
  cashBalance,
}: {
  projectId: string;
  rowCount: number;
  cashBalance: number;
}) {
  const base = `/api/projects/${projectId}/cash-book`;
  return (
    <Card className="mt-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium text-[var(--ink)]">
            Buku Kas Tunai
          </h3>
          <p className="mt-0.5 text-[11px] text-[var(--ink-faint)]">
            {rowCount} baris · saldo {formatRupiah(cashBalance)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <a
            href={`${base}?format=xlsx`}
            className="rounded-md border border-[var(--line)] px-2.5 py-1.5 text-[var(--ink)] hover:bg-[var(--paper-tint)]"
          >
            Excel
          </a>
          <a
            href={`${base}?format=csv`}
            className="rounded-md border border-[var(--line)] px-2.5 py-1.5 text-[var(--ink)] hover:bg-[var(--paper-tint)]"
          >
            CSV
          </a>
          <Link
            href={`/projects/${projectId}/cash-book/print`}
            className="rounded-md border border-[var(--line)] px-2.5 py-1.5 text-[var(--ink)] hover:bg-[var(--paper-tint)]"
          >
            PDF
          </Link>
          <Link
            href={`/transactions/project?projectId=${projectId}`}
            className="rounded-md border border-[var(--accent)]/30 px-2.5 py-1.5 text-[var(--accent)] hover:bg-[var(--paper-tint)]"
          >
            Buka kas
          </Link>
        </div>
      </div>
    </Card>
  );
}
