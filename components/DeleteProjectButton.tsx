"use client";

import { useFormStatus } from "react-dom";
import { deleteProjectAction } from "@/lib/actions/projects";

function SubmitButton({ projectName }: { projectName: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="text-xs text-[var(--ink-faint)] underline-offset-2 hover:text-rose-700 hover:underline disabled:opacity-60"
      onClick={(e) => {
        const ok = confirm(
          `Yakin hapus proyek "${projectName}"?\n\nData tidak bisa dikembalikan.`,
        );
        if (!ok) e.preventDefault();
      }}
    >
      {pending ? "Menghapus..." : "Hapus proyek"}
    </button>
  );
}

export function DeleteProjectButton({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  return (
    <form action={deleteProjectAction}>
      <input type="hidden" name="id" value={projectId} />
      <SubmitButton projectName={projectName} />
    </form>
  );
}
