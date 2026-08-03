"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { logoutAction } from "@/lib/actions/auth";
import type { SessionUser } from "@/lib/auth";
import { roleLabels } from "@/lib/labels";
import { ProofReviewHost } from "@/components/ProofReviewLink";

const AssistantKas = dynamic(
  () => import("@/components/AssistantKas").then((m) => m.AssistantKas),
  { ssr: false },
);

type NavItem = { href: string; label: string; short?: string };

function navForRole(role: SessionUser["role"]): {
  primary: NavItem[];
  secondary: NavItem[];
  mobile: NavItem[];
  showAssistant: boolean;
} {
  if (role === "ADMIN") {
    const primary = [
      { href: "/dashboard", label: "Dashboard", short: "Home" },
      { href: "/projects", label: "Proyek", short: "Proyek" },
      { href: "/transactions/project", label: "Kas Proyek", short: "Kas" },
    ];
    return { primary, secondary: [], mobile: primary, showAssistant: false };
  }

  if (role === "MANDOR") {
    return { primary: [], secondary: [], mobile: [], showAssistant: false };
  }

  const primary = [
    { href: "/dashboard", label: "Dashboard", short: "Home" },
    { href: "/projects", label: "Proyek", short: "Proyek" },
    { href: "/transactions", label: "Kas Besar", short: "Besar" },
    { href: "/transactions/project", label: "Kas Proyek", short: "Proyek" },
    { href: "/reports", label: "Laporan", short: "Lapor" },
  ];
  const secondary = [
    { href: "/users", label: "Pengguna" },
    { href: "/sources", label: "Sumber Kas" },
    { href: "/transfers", label: "Transfer Kas" },
    { href: "/categories", label: "Kategori" },
  ];
  return {
    primary,
    secondary,
    mobile: primary,
    showAssistant: true,
  };
}

function navLinkClass(active: boolean, nested = false) {
  return `block w-full rounded-lg text-sm transition ${
    nested ? "px-3 py-2" : "px-3 py-2.5"
  } ${
    active
      ? "bg-white/12 font-medium text-white"
      : nested
        ? "text-[#a8bbb4] hover:bg-white/6 hover:text-[#eef4f1]"
        : "text-[#c5d4cf] hover:bg-white/6 hover:text-white"
  }`;
}

export function AppShell({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const nav = useMemo(() => navForRole(user.role), [user.role]);

  const isActive = (href: string) => {
    if (href === "/transactions") {
      return pathname === "/transactions" || pathname.startsWith("/transactions/new") || /^\/transactions\/[^/]+\/edit/.test(pathname);
    }
    if (href === "/transactions/project") {
      return pathname === "/transactions/project" || pathname.startsWith("/transactions/project/");
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const secondaryActive = nav.secondary.some((item) => isActive(item.href));
  const [setupOpen, setSetupOpen] = useState(secondaryActive);

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [moreOpen]);

  const mobileCols = nav.mobile.length + (nav.secondary.length > 0 ? 1 : 0);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr] print:block">
      <aside className="relative z-[1] hidden flex-col bg-[var(--accent)] text-[#eef4f1] print:hidden lg:flex lg:min-h-screen">
        <div className="px-5 py-7">
          <p className="font-serif text-2xl tracking-tight text-[#f7f4ee]">
            Kas Proyek
          </p>
          <p className="mt-1 text-sm text-[#c5d4cf]">Buku kas multi lokasi</p>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 px-3 pb-4">
          {nav.primary.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={navLinkClass(isActive(item.href))}
            >
              {item.label}
            </Link>
          ))}

          {nav.secondary.length > 0 ? (
            <div className="mt-4 border-t border-white/10 pt-3">
              <button
                type="button"
                onClick={() => setSetupOpen((v) => !v)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[11px] font-medium tracking-[0.12em] text-[#8fa89f] uppercase transition hover:text-[#c5d4cf]"
                aria-expanded={setupOpen || secondaryActive}
              >
                <span>Pengaturan</span>
                <span
                  className={`text-[10px] normal-case tracking-normal transition-transform ${
                    setupOpen || secondaryActive ? "rotate-0" : "-rotate-90"
                  }`}
                  aria-hidden
                >
                  ▾
                </span>
              </button>

              {setupOpen || secondaryActive ? (
                <div className="mt-1 ml-2 flex flex-col gap-0.5 border-l border-white/10 pl-2">
                  {nav.secondary.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={navLinkClass(isActive(item.href), true)}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </nav>
        <div className="border-t border-white/10 px-5 py-4">
          <p className="text-sm font-medium text-white">{user.name}</p>
          <p className="text-xs text-[#a8bbb4]">
            {roleLabels[user.role] ?? user.role} · @{user.username}
          </p>
          <form action={logoutAction} className="mt-3">
            <button
              type="submit"
              className="text-xs text-[#c5d4cf] underline-offset-2 hover:text-white hover:underline"
            >
              Keluar
            </button>
          </form>
        </div>
      </aside>

      <div className="sticky top-0 z-30 border-b border-[var(--line-soft)] bg-[var(--paper)]/95 backdrop-blur print:hidden lg:hidden">
        <div className="safe-top-bar flex items-center justify-between pb-3">
          <div className="min-w-0">
            <p className="font-serif text-lg text-[var(--ink)]">Kas Proyek</p>
            <p className="truncate text-[11px] text-[var(--ink-faint)]">
              {user.name} · {roleLabels[user.role] ?? user.role}
            </p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-medium text-[var(--accent)]"
            >
              Keluar
            </button>
          </form>
        </div>
      </div>

      <main className="app-paper relative min-h-screen print:bg-white">
        <div className="mobile-main-pad relative z-[1] mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-7 lg:px-8 print:max-w-none print:px-0 print:py-0 print:pb-0">
          {children}
        </div>
      </main>

      <nav className="safe-bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-[var(--line-soft)] bg-[#fffcf7]/95 backdrop-blur print:hidden lg:hidden">
        <div
          className="mx-auto grid max-w-lg px-1 pt-1"
          style={{ gridTemplateColumns: `repeat(${Math.max(mobileCols, 1)}, minmax(0, 1fr))` }}
        >
          {nav.mobile.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 text-[11px] leading-tight ${
                  active
                    ? "font-semibold text-[var(--accent)]"
                    : "text-[var(--ink-faint)]"
                }`}
              >
                <span
                  className={`h-1 w-1 rounded-full ${
                    active ? "bg-[var(--accent)]" : "bg-transparent"
                  }`}
                />
                {item.short ?? item.label}
              </Link>
            );
          })}
          {nav.secondary.length > 0 ? (
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 text-[11px] leading-tight ${
                moreOpen || secondaryActive
                  ? "font-semibold text-[var(--accent)]"
                  : "text-[var(--ink-faint)]"
              }`}
            >
              <span
                className={`h-1 w-1 rounded-full ${
                  moreOpen || secondaryActive
                    ? "bg-[var(--accent)]"
                    : "bg-transparent"
                }`}
              />
              Lain
            </button>
          ) : null}
        </div>
      </nav>

      {moreOpen && nav.secondary.length > 0 ? (
        <div className="fixed inset-0 z-50 print:hidden lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-[var(--ink)]/25"
            aria-label="Tutup menu"
            onClick={() => setMoreOpen(false)}
          />
          <div className="safe-bottom-nav absolute inset-x-0 bottom-0 rounded-t-2xl border border-[var(--line-soft)] bg-[#fffcf7] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-lg">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="font-serif text-lg text-[var(--ink)]">
                  Pengaturan
                </p>
                <p className="text-xs text-[var(--ink-faint)]">
                  {user.name} · {roleLabels[user.role] ?? user.role}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="min-h-10 rounded-lg px-3 text-sm text-[var(--ink-muted)]"
              >
                Tutup
              </button>
            </div>
            <div className="grid gap-1">
              {nav.secondary.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={`rounded-lg px-3 py-3.5 text-sm ${
                    isActive(item.href)
                      ? "bg-[var(--paper-tint)] font-medium text-[var(--accent)]"
                      : "text-[var(--ink)]"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              <form
                action={logoutAction}
                className="mt-2 border-t border-[var(--line-soft)] pt-2"
              >
                <button
                  type="submit"
                  className="w-full rounded-lg px-3 py-3.5 text-left text-sm text-[var(--rose-ink)]"
                >
                  Keluar
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}

      {nav.showAssistant ? <AssistantKas /> : null}
      <ProofReviewHost />
    </div>
  );
}
