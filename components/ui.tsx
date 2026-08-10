import Link from "next/link";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h2 className="font-serif text-[1.65rem] leading-tight tracking-tight text-[var(--ink)] sm:text-3xl md:text-[2.15rem]">
          {title}
        </h2>
        {description ? (
          <p className="mt-1.5 max-w-xl text-sm text-[var(--ink-muted)]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end [&_a]:min-h-11 [&_a]:flex-1 sm:[&_a]:flex-none [&_button]:min-h-11 [&_button]:flex-1 sm:[&_button]:flex-none">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

export function Card({
  children,
  className = "",
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div
      id={id}
      className={`rounded-xl border border-[var(--line-soft)] bg-[var(--surface)] p-4 shadow-[0_1px_0_rgba(26,47,42,0.04)] sm:p-5 ${className}`}
    >
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
  href,
  compact = false,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "income" | "expense" | "balance";
  /** Jika diisi, kartu menjadi tautan (mis. rincian keuntungan) */
  href?: string;
  /** Ringkas untuk strip ringkasan di atas halaman */
  compact?: boolean;
}) {
  const tones = {
    neutral: "text-[var(--ink)]",
    income: "text-[var(--emerald-ink)]",
    expense: "text-[var(--rose-ink)]",
    balance: "text-[var(--accent)]",
  };

  const className = compact
    ? "flex min-w-0 flex-col justify-center px-3 py-2.5 sm:px-4 sm:py-3" +
      (href
        ? " transition hover:bg-[var(--paper-tint)]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/25"
        : "")
    : "flex h-full min-w-0 flex-col rounded-xl border border-[var(--line-soft)] bg-[var(--surface)] px-3 py-3 sm:px-5 sm:py-4" +
      (href
        ? " transition hover:border-[var(--accent)]/35 hover:bg-[var(--paper-tint)]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/25"
        : "");

  const body = (
    <>
      <p
        className={
          compact
            ? "text-[10px] font-medium tracking-[0.06em] text-[var(--ink-faint)] uppercase"
            : "text-[10px] font-medium tracking-[0.08em] text-[var(--ink-faint)] uppercase sm:text-[11px]"
        }
      >
        {label}
      </p>
      <p
        className={
          compact
            ? `mt-0.5 min-w-0 break-words text-sm font-semibold leading-snug tabular-nums sm:text-[0.95rem] ${tones[tone]}`
            : `mt-1.5 min-w-0 break-words font-serif text-[1.05rem] leading-snug tabular-nums sm:text-[1.35rem] xl:text-xl ${tones[tone]}`
        }
      >
        {value}
      </p>
      {hint ? (
        <p
          className={
            compact
              ? "mt-0.5 text-[11px] leading-snug text-[var(--ink-faint)]"
              : "mt-auto pt-1.5 text-xs leading-snug text-[var(--ink-faint)]"
          }
        >
          {hint}
        </p>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {body}
      </Link>
    );
  }

  return <div className={className}>{body}</div>;
}

/** Satu baris ringkasan keuangan — kecil, mudah dibaca, di atas halaman. */
export function FinanceStrip({
  items,
  progressPercent,
}: {
  items: {
    label: string;
    value: string;
    hint?: string;
    tone?: "neutral" | "income" | "expense" | "balance";
  }[];
  progressPercent?: number;
}) {
  return (
    <div className="mb-5 overflow-hidden rounded-xl border border-[var(--line-soft)] bg-[var(--surface)]">
      <div className="grid grid-cols-2 divide-x divide-y divide-[var(--line-soft)] lg:grid-cols-4 lg:divide-y-0">
        {items.map((item) => (
          <StatCard
            key={item.label}
            label={item.label}
            value={item.value}
            hint={item.hint}
            tone={item.tone}
            compact
          />
        ))}
      </div>
      {progressPercent != null ? (
        <div className="h-1 bg-[var(--line-soft)]">
          <div
            className="h-full bg-[var(--accent)] transition-all"
            style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

export function Field({
  label,
  children,
  htmlFor,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  htmlFor?: string;
  hint?: string;
}) {
  // Tanpa htmlFor pakai <div> — bungkus tombol/file picker dalam <label>
  // sering bentrok di Android (klik "Ambil foto" tidak membuka kamera).
  const className = "block space-y-1.5";
  const body = (
    <>
      <span className="text-sm font-medium text-[var(--ink)]/85">{label}</span>
      {children}
      {hint ? (
        <span className="block text-xs text-[var(--ink-faint)]">{hint}</span>
      ) : null}
    </>
  );

  if (htmlFor) {
    return (
      <label className={className} htmlFor={htmlFor}>
        {body}
      </label>
    );
  }

  return <div className={className}>{body}</div>;
}

export const inputClass =
  "w-full rounded-lg border border-[var(--line)] bg-[#fffcf7] px-3 py-3 text-base text-[var(--ink)] outline-none transition placeholder:text-[var(--ink-faint)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15 sm:py-2.5 sm:text-sm";

export const btnPrimaryClass =
  "inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-[#f7f4ee] transition hover:bg-[var(--accent-soft)] disabled:opacity-60";

export const btnSecondaryClass =
  "inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--line)] bg-[#fffcf7] px-4 py-2.5 text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--paper-tint)]";

export const btnDangerClass =
  "inline-flex min-h-10 items-center justify-center rounded-lg border border-rose-200/80 bg-[#fbf4f3] px-3 py-2 text-sm font-medium text-[var(--rose-ink)] transition hover:bg-rose-50";

export function Alert({
  tone = "error",
  children,
}: {
  tone?: "error" | "success";
  children: React.ReactNode;
}) {
  const styles =
    tone === "error"
      ? "border-rose-200/90 bg-[#fbf4f3] text-[var(--rose-ink)]"
      : "border-emerald-200/90 bg-[#f1f7f3] text-[var(--emerald-ink)]";
  return (
    <div className={`rounded-lg border px-3 py-2 text-sm ${styles}`}>
      {children}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--line)] px-4 py-10 text-center text-sm text-[var(--ink-faint)]">
      {message}
    </div>
  );
}
