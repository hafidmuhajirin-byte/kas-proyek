"use client";

import { useActionState } from "react";
import {
  assignMandorToProjectAction,
  unassignMandorFromProjectAction,
} from "@/lib/actions/project-assignments";
import {
  Alert,
  btnDangerClass,
  btnPrimaryClass,
  Field,
  inputClass,
} from "@/components/ui";

type MandorOption = {
  id: string;
  name: string;
  username?: string;
  role?: string;
};

function AssignForm({
  projectId,
  available,
}: {
  projectId: string;
  available: MandorOption[];
}) {
  const [state, action, pending] = useActionState(
    assignMandorToProjectAction,
    {},
  );

  if (available.length === 0) {
    return (
      <p className="text-sm text-[var(--ink-faint)]">
        Semua sudah ditugaskan, atau belum ada akun. Buat di{" "}
        <a href="/users" className="underline">
          Pengguna
        </a>
        .
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="projectId" value={projectId} />
      <div className="min-w-[12rem] flex-1">
        <Field label="Pilih Mandor / Pelaksana / ADM Foto">
          <select name="userId" className={inputClass} required defaultValue="">
            <option value="" disabled>
              — pilih —
            </option>
            {available.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.role === "ADM_FOTO"
                  ? " · ADM Foto"
                  : m.role === "PELAKSANA"
                    ? " · Pelaksana"
                    : ""}
                {m.username ? ` (@${m.username})` : ""}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <button type="submit" className={btnPrimaryClass} disabled={pending}>
        {pending ? "Menyimpan..." : "Tugaskan"}
      </button>
      {state.error ? (
        <div className="w-full">
          <Alert>{state.error}</Alert>
        </div>
      ) : null}
      {state.success ? (
        <div className="w-full">
          <Alert tone="success">{state.success}</Alert>
        </div>
      ) : null}
    </form>
  );
}

function UnassignButton({
  projectId,
  userId,
  name,
}: {
  projectId: string;
  userId: string;
  name: string;
}) {
  const [state, action, pending] = useActionState(
    unassignMandorFromProjectAction,
    {},
  );

  return (
    <form action={action} className="inline">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="userId" value={userId} />
      <button
        type="submit"
        className={btnDangerClass}
        disabled={pending}
        onClick={(e) => {
          if (!confirm(`Lepas ${name} dari proyek ini?`)) e.preventDefault();
        }}
      >
        {pending ? "..." : "Lepas"}
      </button>
      {state.error ? (
        <p className="mt-1 text-xs text-rose-700">{state.error}</p>
      ) : null}
    </form>
  );
}

/**
 * Panel penugasan Mandor di halaman proyek.
 * Ini yang membuat proyek muncul di login Mandor (bukan data Pemborong).
 */
export function MandorAssignPanel({
  projectId,
  canEdit,
  assigned,
  allMandors,
}: {
  projectId: string;
  canEdit: boolean;
  assigned: MandorOption[];
  allMandors: MandorOption[];
}) {
  const assignedIds = new Set(assigned.map((m) => m.id));
  const available = allMandors.filter((m) => !assignedIds.has(m.id));

  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-medium text-[var(--ink)]">
          Mandor / Pelaksana / ADM Foto ditugaskan
        </h3>
        <p className="text-xs text-[var(--ink-faint)]">
          Yang ditugaskan di sini melihat proyek ini saat login.
        </p>
      </div>

      {assigned.length === 0 ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Belum ada yang ditugaskan — proyek tidak muncul di login Mandor /
          Pelaksana / ADM Foto.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--line-soft)] rounded-lg border border-[var(--line)]">
          {assigned.map((m) => (
            <li
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
            >
              <span className="font-medium text-[var(--ink)]">
                {m.name}
                {m.role === "ADM_FOTO" ? (
                  <span className="font-normal text-teal-800"> · ADM Foto</span>
                ) : m.role === "PELAKSANA" ? (
                  <span className="font-normal text-teal-800"> · Pelaksana</span>
                ) : null}
                {m.username ? (
                  <span className="font-normal text-[var(--ink-faint)]">
                    {" "}
                    @{m.username}
                  </span>
                ) : null}
              </span>
              {canEdit ? (
                <UnassignButton
                  projectId={projectId}
                  userId={m.id}
                  name={m.name}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canEdit ? (
        <AssignForm projectId={projectId} available={available} />
      ) : null}
    </div>
  );
}
