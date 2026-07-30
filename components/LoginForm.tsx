"use client";

import { useActionState } from "react";
import { loginAction, type AuthState } from "@/lib/actions/auth";
import { Alert, btnPrimaryClass, Field, inputClass } from "@/components/ui";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(
    loginAction,
    {} as AuthState,
  );

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert>{state.error}</Alert> : null}
      <Field label="Username" htmlFor="username">
        <input
          id="username"
          name="username"
          className={inputClass}
          autoComplete="username"
          required
        />
      </Field>
      <Field label="Password" htmlFor="password">
        <input
          id="password"
          name="password"
          type="password"
          className={inputClass}
          autoComplete="current-password"
          required
        />
      </Field>
      <button type="submit" className={`${btnPrimaryClass} w-full`} disabled={pending}>
        {pending ? "Masuk..." : "Masuk"}
      </button>
    </form>
  );
}
