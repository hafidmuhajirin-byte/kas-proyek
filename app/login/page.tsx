import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <div className="app-paper relative flex min-h-screen items-center justify-center px-4 py-10">
      <div className="relative z-[1] w-full max-w-md">
        <p className="font-serif text-4xl tracking-tight text-[var(--ink)] sm:text-5xl">
          Kas Proyek
        </p>
        <p className="mt-2 text-sm text-[var(--ink-muted)]">
          Pembukuan multi proyek — sederhana untuk HP, tablet, dan PC.
        </p>

        <div className="mt-8 rounded-xl border border-[var(--line-soft)] bg-[var(--surface)] p-6 shadow-[0_1px_0_rgba(26,47,42,0.04)] sm:p-7">
          <h1 className="font-serif text-2xl text-[var(--ink)]">Masuk</h1>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            Gunakan akun admin atau operator.
          </p>
          <div className="mt-5">
            <LoginForm />
          </div>
        </div>

        <p className="mt-5 text-center text-xs text-[var(--ink-faint)]">
          Default admin: admin / admin123
        </p>
      </div>
    </div>
  );
}
