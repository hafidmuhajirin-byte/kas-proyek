"use client";

import { useRouter } from "next/navigation";
import { inputClass } from "@/components/ui";

type ProjectOption = { id: string; name: string };

export function FotoProyekProjectFilter({
  projects,
  projectId,
}: {
  projects: ProjectOption[];
  projectId?: string;
}) {
  const router = useRouter();

  return (
    <label className="block text-sm">
      <span className="mb-1.5 block text-[var(--ink-faint)]">Proyek</span>
      <select
        className={`${inputClass} min-h-12`}
        value={projectId ?? ""}
        onChange={(e) => {
          const next = e.target.value;
          router.push(
            next ? `/foto-proyek?projectId=${encodeURIComponent(next)}` : "/foto-proyek",
          );
        }}
      >
        <option value="">Semua proyek</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  );
}
