"use client";

import { useActionState, useState } from "react";
import type { FormState } from "@/lib/actions/projects";
import {
  createUserAction,
  updateUserAction,
  deleteUserAction,
} from "@/lib/actions/users";
import {
  Alert,
  btnDangerClass,
  btnPrimaryClass,
  btnSecondaryClass,
  Field,
  inputClass,
} from "@/components/ui";

type ProjectOption = { id: string; name: string };
type UserRow = {
  id: string;
  username: string;
  name: string;
  role: string;
  projectIds: string[];
  fotoOnly?: boolean;
};

export function UserCreateForm({ projects }: { projects: ProjectOption[] }) {
  const [state, action, pending] = useActionState(createUserAction, {});
  const [role, setRole] = useState("MANDOR");

  return (
    <form action={action} className="space-y-3">
      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Username" htmlFor="username">
          <input
            id="username"
            name="username"
            className={inputClass}
            required
            autoComplete="off"
          />
        </Field>
        <Field label="Nama" htmlFor="name">
          <input id="name" name="name" className={inputClass} required />
        </Field>
        <Field label="Password" htmlFor="password">
          <input
            id="password"
            name="password"
            type="password"
            className={inputClass}
            required
            minLength={6}
          />
        </Field>
        <Field label="Role" htmlFor="role">
          <select
            id="role"
            name="role"
            className={inputClass}
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="OWNER">Owner</option>
            <option value="ADMIN">Admin</option>
            <option value="MANDOR">Mandor</option>
          </select>
        </Field>
      </div>
      {role === "MANDOR" ? (
        <>
          <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-lg border border-[var(--line-soft)] bg-[#fffcf7] px-3 py-3">
            <input
              type="checkbox"
              name="fotoOnly"
              value="1"
              className="mt-1 h-5 w-5 shrink-0 accent-teal-700"
            />
            <span className="text-sm text-[var(--ink)]">
              <span className="font-medium">Hanya foto proyek</span>
              <span className="mt-0.5 block text-xs text-[var(--ink-faint)]">
                Login hanya untuk ambil/unggah foto. Tidak melihat status dana,
                sisa, atau upload bukti belanja.
              </span>
            </span>
          </label>
          <Field
            label="Proyek ditugaskan"
            hint="Wajib pilih minimal 1 — tanpa ini Mandor tidak melihat proyek saat login"
          >
            <div className="max-h-40 space-y-2 overflow-auto rounded-lg border border-[var(--line)] p-3">
              {projects.length === 0 ? (
                <p className="text-sm text-[var(--ink-faint)]">
                  Belum ada proyek.
                </p>
              ) : (
                projects.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="projectIds" value={p.id} />
                    {p.name}
                  </label>
                ))
              )}
            </div>
          </Field>
        </>
      ) : null}
      <button type="submit" className={btnPrimaryClass} disabled={pending}>
        {pending ? "Menyimpan..." : "Tambah pengguna"}
      </button>
    </form>
  );
}

export function UserEditForm({
  user,
  projects,
}: {
  user: UserRow;
  projects: ProjectOption[];
}) {
  const [state, action, pending] = useActionState(updateUserAction, {});
  const [role, setRole] = useState(user.role);
  const assigned = new Set(user.projectIds);

  return (
    <form action={action} className="space-y-3 border-t border-[var(--line-soft)] pt-3">
      <input type="hidden" name="id" value={user.id} />
      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nama" htmlFor={`name-${user.id}`}>
          <input
            id={`name-${user.id}`}
            name="name"
            className={inputClass}
            defaultValue={user.name}
            required
          />
        </Field>
        <Field label="Role" htmlFor={`role-${user.id}`}>
          <select
            id={`role-${user.id}`}
            name="role"
            className={inputClass}
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="OWNER">Owner</option>
            <option value="ADMIN">Admin</option>
            <option value="MANDOR">Mandor</option>
          </select>
        </Field>
        <Field
          label="Password baru (opsional)"
          htmlFor={`password-${user.id}`}
          hint="Kosongkan jika tidak diganti"
        >
          <input
            id={`password-${user.id}`}
            name="password"
            type="password"
            className={inputClass}
            minLength={6}
          />
        </Field>
      </div>
      {role === "MANDOR" ? (
        <>
          <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-lg border border-[var(--line-soft)] bg-[#fffcf7] px-3 py-3">
            <input
              type="checkbox"
              name="fotoOnly"
              value="1"
              defaultChecked={Boolean(user.fotoOnly)}
              className="mt-1 h-5 w-5 shrink-0 accent-teal-700"
            />
            <span className="text-sm text-[var(--ink)]">
              <span className="font-medium">Hanya foto proyek</span>
              <span className="mt-0.5 block text-xs text-[var(--ink-faint)]">
                Login hanya untuk ambil/unggah foto. Tidak melihat status dana
                atau upload bukti.
              </span>
            </span>
          </label>
          <Field
            label="Proyek ditugaskan"
            hint="Wajib minimal 1 proyek. Centang ulang sebelum simpan."
          >
            <div className="max-h-40 space-y-2 overflow-auto rounded-lg border border-[var(--line)] p-3">
              {projects.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm">
                  <input type="hidden" name="formProjectIds" value={p.id} />
                  <input
                    type="checkbox"
                    name="projectIds"
                    value={p.id}
                    defaultChecked={assigned.has(p.id)}
                  />
                  {p.name}
                </label>
              ))}
            </div>
          </Field>
        </>
      ) : null}
      <button type="submit" className={btnSecondaryClass} disabled={pending}>
        {pending ? "Menyimpan..." : "Simpan perubahan"}
      </button>
    </form>
  );
}

export function DeleteUserButton({
  userId,
  username,
}: {
  userId: string;
  username: string;
}) {
  const [state, action, pending] = useActionState(deleteUserAction, {});
  const [reassign, setReassign] = useState(false);

  return (
    <form action={action} className="max-w-xs space-y-2 text-right">
      <input type="hidden" name="id" value={userId} />
      {reassign ? <input type="hidden" name="reassign" value="1" /> : null}
      <button
        type="submit"
        className={btnDangerClass}
        disabled={pending}
        onClick={(e) => {
          const msg = reassign
            ? `Pindahkan semua histori @${username} ke Owner yang sedang login, lalu hapus akun?`
            : `Hapus pengguna @${username}?`;
          if (!confirm(msg)) e.preventDefault();
        }}
      >
        {pending ? "Menghapus..." : "Hapus"}
      </button>
      <label className="flex items-start gap-2 text-left text-xs text-[var(--ink-muted)]">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={reassign}
          onChange={(e) => setReassign(e.target.checked)}
        />
        <span>
          Jika gagal karena masih ada transaksi: centang ini untuk{" "}
          <strong>pindahkan histori ke Owner</strong> lalu hapus.
        </span>
      </label>
      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
    </form>
  );
}
