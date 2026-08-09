"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/lib/actions/auth";
import type { SessionUser } from "@/lib/auth";

export function MandorShell({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const fotoOnly = Boolean(user.fotoOnly);

  const nav = fotoOnly
    ? [{ href: "/mandor/lokasi", label: "Foto Proyek", short: "Foto" }]
    : [
        { href: "/mandor", label: "Beranda", short: "Home" },
        { href: "/mandor/upload", label: "Upload", short: "Upload" },
        { href: "/mandor/lokasi", label: "Foto Proyek", short: "Foto" },
      ];

  const isActive = (href: string) =>
    href === "/mandor"
      ? pathname === "/mandor"
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="min-h-screen bg-[var(--paper)]">
      <header className="sticky top-0 z-30 border-b border-[var(--line-soft)] bg-[var(--paper)]/95 backdrop-blur">
        <div className="safe-top-bar flex items-center justify-between px-4 pb-3">
          <div className="min-w-0">
            <p className="font-serif text-xl text-[var(--ink)]">
              {fotoOnly ? "Foto Proyek" : "Kas Mandor"}
            </p>
            <p className="truncate text-xs text-[var(--ink-faint)]">
              {user.name}
              {fotoOnly ? " · hanya foto" : ""}
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

      <main className="mx-auto max-w-lg px-4 py-5 pb-28">{children}</main>

      <nav className="safe-bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-[var(--line-soft)] bg-[#fffcf7]/95 backdrop-blur">
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
    </div>
  );
}
