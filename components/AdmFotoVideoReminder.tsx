import Link from "next/link";

export function AdmFotoVideoReminder({
  projects,
}: {
  projects: { id: string; name: string }[];
}) {
  if (projects.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-3 text-amber-950">
      <p className="font-medium">Tanggal 20 — unggah video progres bulan ini.</p>
      <p className="mt-1 text-sm">Belum ada video bulan ini untuk:</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
        {projects.map((p) => (
          <li key={p.id}>
            <Link
              href={`/mandor/lokasi?projectId=${encodeURIComponent(p.id)}`}
              className="underline"
            >
              {p.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
