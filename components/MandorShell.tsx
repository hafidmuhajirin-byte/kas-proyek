"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/lib/actions/auth";
import { PwaInstallPrompt } from "@/components/PwaInstallPrompt";
import { ProofReviewHost } from "@/components/ProofReviewLink";
import type { SessionUser } from "@/lib/session";
import { primaryMenusForRole } from "@/lib/nav/app-menus";

const AssistantKas = dynamic(
  () => import("@/components/AssistantKas").then((m) => m.AssistantKas),
  { ssr: false },
);

export function MandorShell({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const admFoto = user.role === "ADM_FOTO";
  const pelaksana = user.role === "PELAKSANA";
  const shellTitle = admFoto ? "ADM Foto" : pelaksana ? "Pelaksana" : "Kas Mandor";

  const nav = primaryMenusForRole(user.role).map((m) => ({
    href: m.href,
    label: m.label,
    short: m.short ?? m.label,
  }));

  const isActive = (href: string) => {
    if (href === "/mandor") return pathname === "/mandor";
    if (href === "/mandor/lokasi") return pathname.startsWith("/mandor/lokasi");
    if (href === "/mandor/upload") return pathname.startsWith("/mandor/upload");
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <div className="min-h-screen bg-[var(--paper)]">
      <header className="sticky top-0 z-30 border-b border-[var(--line-soft)] bg-[var(--paper)]/95 backdrop-blur">
        <div className="safe-top-bar flex items-center justify-between px-4 pb-3">
          <div className="min-w-0">
            <p className="font-serif text-xl text-[var(--ink)]">
              {shellTitle}
            </p>
            <p className="truncate text-xs text-[var(--ink-faint)]">
              {user.name}
            </p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="min-h-11 rounded-lg px-3 text-sm font-medium text-[var(--accent)]"
            >
              Keluar
            </button>
          </form>
        </div>
      </header>

      <main className="mobile-main-pad mx-auto max-w-lg px-4 py-5 pb-28 lg:max-w-none">
        <div className="mb-3">
          <PwaInstallPrompt compact />
        </div>
        {children}
      </main>

      <nav className="safe-bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-[var(--line-soft)] bg-[#fffcf7]/95 backdrop-blur lg:hidden">
        <div
          className={`mx-auto grid max-w-lg px-2 pt-1 ${
            nav.length === 1 ? "grid-cols-1" : "grid-cols-3"
          }`}
        >
          {nav.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-14 flex-col items-center justify-center text-sm ${
                  active
                    ? "font-semibold text-[var(--accent)]"
                    : "text-[var(--ink-faint)]"
                }`}
              >
                {item.short}
              </Link>
            );
          })}
        </div>
      </nav>

      {user.role === "MANDOR" || user.role === "PELAKSANA" ? (
        <AssistantKas />
      ) : null}
      <ProofReviewHost />
    </div>
  );
}
