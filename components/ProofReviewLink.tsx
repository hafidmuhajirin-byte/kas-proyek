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

const PROOF_WIDTH_KEY = "kas-proof-panel-width";
const WIDTH_NARROW = 320;
const WIDTH_WIDE = 480;

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

function applyProofOpenCss(widthPx: number | null) {
  const root = document.documentElement;
  if (widthPx == null) {
    root.classList.remove("proof-review-open");
    root.style.removeProperty("--proof-panel-w");
    return;
  }
  root.classList.add("proof-review-open");
  root.style.setProperty("--proof-panel-w", `${widthPx}px`);
}

/**
 * Host tunggal — pasang sekali di AppShell.
 * Panel kanan + dorong konten utama agar tabel pecah isi tidak tertutup.
 */
export function ProofReviewHost() {
  const desktop = useDesktopProofReview();
  const [url, setUrl] = useState<string | null>(null);
  const [title, setTitle] = useState<string>("Bukti");
  const [ready, setReady] = useState(false);
  const [width, setWidth] = useState(WIDTH_NARROW);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PROOF_WIDTH_KEY);
      if (raw === "wide") setWidth(WIDTH_WIDE);
      else if (raw === "narrow") setWidth(WIDTH_NARROW);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!desktop) {
      openProofReview = null;
      setUrl(null);
      applyProofOpenCss(null);
      return;
    }
    openProofReview = (next, t) => {
      setTitle(t?.trim() || "Bukti");
      setReady(false);
      setUrl(next);
    };
    return () => {
      openProofReview = null;
      applyProofOpenCss(null);
    };
  }, [desktop]);

  useEffect(() => {
    if (!desktop || !url) {
      applyProofOpenCss(null);
      return;
    }
    applyProofOpenCss(width);
    return () => applyProofOpenCss(null);
  }, [desktop, url, width]);

  const close = useCallback(() => setUrl(null), []);

  function toggleWidth() {
    setWidth((w) => {
      const next = w === WIDTH_NARROW ? WIDTH_WIDE : WIDTH_NARROW;
      try {
        localStorage.setItem(
          PROOF_WIDTH_KEY,
          next === WIDTH_WIDE ? "wide" : "narrow",
        );
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  if (!desktop || !url) return null;

  const image = isImageUrl(url);
  const pdf = isPdfUrl(url);

  return (
    <aside
      role="complementary"
      aria-label={title}
      style={{ width }}
      className="fixed inset-y-0 right-0 z-[80] hidden flex-col border-l border-teal-900/15 bg-[#fffcf7] shadow-xl lg:flex"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-teal-900/10 px-3 py-2.5">
        <p className="min-w-0 truncate text-sm font-medium text-teal-950">
          {title}
        </p>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={toggleWidth}
            className="rounded-md border border-teal-900/15 px-2 py-1 text-[11px] text-teal-800 hover:bg-teal-950/[0.04]"
            title="Lebarkan / sempitkan panel"
          >
            {width === WIDTH_NARROW ? "Lebar" : "Sempit"}
          </button>
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
            className="rounded-md bg-teal-800 px-2.5 py-1 text-sm font-medium text-white hover:bg-teal-900"
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
          // eslint-disable-next-line @next/next/no-img-element
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
