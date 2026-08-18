import Link from "next/link";
import { Card } from "@/components/ui";

type ProjectOption = { id: string; name: string };

/** Daftar proyek — pilih dulu sebelum ambil foto / upload bukti. */
export function MandorProjectPicker({
  title,
  hint,
  projects,
  hrefFor,
}: {
  title: string;
  hint?: string;
  projects: ProjectOption[];
  hrefFor: (projectId: string) => string;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-serif text-2xl text-[var(--ink)]">{title}</h1>
        {hint ? (
          <p className="mt-1 text-sm text-[var(--ink-muted)]">{hint}</p>
        ) : null}
      </div>

      <Card className="!p-0 overflow-hidden">
        <ul className="divide-y divide-[var(--line-soft)]">
          {projects.map((p) => (
            <li key={p.id}>
              <Link
                href={hrefFor(p.id)}
                className="flex min-h-14 items-center justify-between gap-3 px-4 py-3 text-[var(--ink)] active:bg-[var(--paper-tint)]"
              >
                <span className="font-medium">{p.name}</span>
                <span className="text-sm text-[var(--accent)]">Pilih ›</span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

export function MandorLockedProjectHeader({
  projectName,
  homeHref,
  homeLabel = "Home",
}: {
  projectName: string;
  homeHref: string;
  homeLabel?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-[var(--ink-faint)]">
          Proyek
        </p>
        <h1 className="truncate font-serif text-xl text-[var(--ink)] sm:text-2xl">
          {projectName}
        </h1>
      </div>
      <Link
        href={homeHref}
        className="shrink-0 rounded-lg border border-[var(--line)] bg-[#fffcf7] px-3 py-2 text-sm font-medium text-[var(--accent)]"
      >
        {homeLabel}
      </Link>
    </div>
  );
}
