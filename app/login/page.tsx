import { LoginForm } from "@/components/LoginForm";
import { PwaInstallPrompt } from "@/components/PwaInstallPrompt";

export default function LoginPage() {
  return (
    <div className="login-shell relative flex min-h-screen items-center justify-center px-4 py-10">
      <div className="relative z-[1] w-full max-w-md">
        <p className="text-center text-4xl font-medium tracking-tight text-[var(--ink)] drop-shadow-[0_1px_0_rgba(255,252,247,0.55)] sm:text-5xl">
          Kas Proyek
        </p>

        <div className="mt-8 rounded-xl border border-[var(--line-soft)] bg-[rgba(255,252,247,0.94)] p-6 shadow-[0_12px_40px_rgba(26,47,42,0.12)] backdrop-blur-sm sm:p-7">
          <h1 className="text-2xl font-medium text-[var(--ink)]">Masuk</h1>
          <div className="mt-5">
            <LoginForm />
          </div>
          <div className="mt-5">
            <PwaInstallPrompt />
          </div>
        </div>
      </div>
    </div>
  );
}
