"use client";

import {
  useCallback,
  useEffect,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";

type OpenFn = (url: string, title?: string) => void;

let openProofReview: OpenFn | null = null;

function isImageUrl(url: string) {
  return /\.(jpe?g|png|gif|webp|bmp|svg)(\?|$)/i.test(url);
}

function isPdfUrl(url: string) {
  return /\.pdf(\?|$)/i.test(url);
}

/** Deteksi PC/laptop: layar lebar + pointer halus (bukan sentuh utama). */
function useDesktopProofReview() {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px) and (pointer: fine)");
    const sync = () => setDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return desktop;
}

/**
 * Host tunggal — pasang sekali di AppShell.
 * Hanya satu panel review aktif; media baru dimuat saat dibuka.
 */
export function ProofReviewHost() {
  const desktop = useDesktopProofReview();
  const [url, setUrl] = useState<string | null>(null);
  const [title, setTitle] = useState<string>("Bukti");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!desktop) {
      openProofReview = null;
      setUrl(null);
      return;
    }
    openProofReview = (next, t) => {
      setTitle(t?.trim() || "Bukti");
      setReady(false);
      setUrl(next);
    };
    return () => {
      openProofReview = null;
    };
  }, [desktop]);

  useEffect(() => {
    if (!url) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setUrl(null);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    // Jangan lock scroll penuh — user masih isi form di kiri
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [url]);

  const close = useCallback(() => setUrl(null), []);

  if (!desktop || !url) return null;

  const image = isImageUrl(url);
  const pdf = isPdfUrl(url);

  return (
    <div className="pointer-events-none fixed inset-0 z-[80] hidden lg:block">
      <button
        type="button"
        aria-label="Tutup overlay"
        className="pointer-events-auto absolute inset-0 bg-teal-950/25"
        onClick={close}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="pointer-events-auto absolute inset-y-0 right-0 flex w-[min(440px,42vw)] flex-col border-l border-teal-900/15 bg-[#fffcf7] shadow-xl"
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-teal-900/10 px-3 py-2.5">
          <p className="truncate text-sm font-medium text-teal-950">{title}</p>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-teal-700 underline"
            >
              Tab baru
            </a>
            <button
              type="button"
              onClick={close}
              className="rounded-md px-2 py-1 text-sm text-teal-900/70 hover:bg-teal-900/5"
            >
              Tutup
            </button>
          </div>
        </div>

        <div className="relative min-h-0 flex-1 overflow-auto bg-teal-950/[0.03] p-3">
          {!ready ? (
            <p className="text-center text-xs text-teal-900/50">Memuat…</p>
          ) : null}

          {image ? (
            // Media hanya dimuat saat panel dibuka
            <img
              src={url}
              alt={title}
              className={`mx-auto max-h-full max-w-full object-contain ${
                ready ? "" : "invisible absolute"
              }`}
              onLoad={() => setReady(true)}
              onError={() => setReady(true)}
            />
          ) : pdf ? (
            <iframe
              title={title}
              src={url}
              className="h-full min-h-[70vh] w-full rounded border border-teal-900/10 bg-white"
              onLoad={() => setReady(true)}
            />
          ) : (
            <div className="space-y-2 text-center text-sm">
              <p className="text-teal-900/70">Pratinjau tidak tersedia.</p>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="text-teal-700 underline"
                onClick={() => setReady(true)}
              >
                Buka file
              </a>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

/** Link bukti: di PC buka panel review; di HP tetap tab baru. */
export function ProofReviewLink({
  href,
  children = "Lihat bukti",
  className = "font-medium text-teal-700 underline",
  title,
}: {
  href: string;
  children?: ReactNode;
  className?: string;
  title?: string;
}) {
  const desktop = useDesktopProofReview();

  function onClick(e: MouseEvent<HTMLAnchorElement>) {
    if (!desktop || !openProofReview) return;
    e.preventDefault();
    openProofReview(href, title);
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={className}
      onClick={onClick}
    >
      {children}
    </a>
  );
}
