"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/actions/projects";
import { Alert, btnPrimaryClass, Field, inputClass } from "@/components/ui";

type Action = (
  prev: FormState,
  formData: FormData,
) => Promise<FormState>;

export function ActionForm({
  action,
  children,
  submitLabel = "Simpan",
  className = "space-y-4",
}: {
  action: Action;
  children: React.ReactNode;
  submitLabel?: string;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className={className}>
      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      {children}
      <button
        type="submit"
        className={`${btnPrimaryClass} w-full sm:w-auto`}
        disabled={pending}
      >
        {pending ? "Menyimpan..." : submitLabel}
      </button>
    </form>
  );
}

export { Field, inputClass };
