"use client";

import {
  useCallback,
  useEffect,
  useState,
  type MouseEvent,
  type ReactNode,
  type WheelEvent,
} from "react";

type OpenFn = (url: string, title?: string) => void;

let openProofReview: OpenFn | null = null;

const PROOF_WIDTH_KEY = "kas-proof-panel-width";
const WIDTH_NARROW = 320;
const WIDTH_WIDE = 480;

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3] as const;
const ZOOM_DEFAULT = 1;

function isImageUrl(url: string) {
  return /\.(jpe?g|png|gif|webp|bmp|svg)(\?|$)/i.test(url);
}

function isPdfUrl(url: string) {
  return /\.pdf(\?|$)/i.test(url);
}

function nearestZoomIndex(zoom: number): number {
  let best = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < ZOOM_STEPS.length; i++) {
    const d = Math.abs(ZOOM_STEPS[i] - zoom);
    if (d < bestDiff) {
      bestDiff = d;
      best = i;
    }
  }
  return best;
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
  const [zoom, setZoom] = useState(ZOOM_DEFAULT);

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
      setZoom(ZOOM_DEFAULT);
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

  function zoomIn() {
    setZoom((z) => {
      const i = nearestZoomIndex(z);
      return ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, i + 1)];
    });
  }

  function zoomOut() {
    setZoom((z) => {
      const i = nearestZoomIndex(z);
      return ZOOM_STEPS[Math.max(0, i - 1)];
    });
  }

  function zoomReset() {
    setZoom(ZOOM_DEFAULT);
  }

  function onWheel(e: WheelEvent<HTMLDivElement>) {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    if (e.deltaY < 0) zoomIn();
    else if (e.deltaY > 0) zoomOut();
  }

  if (!desktop || !url) return null;

  const image = isImageUrl(url);
  const pdf = isPdfUrl(url);
  const zoomPct = Math.round(zoom * 100);
  const atMin = nearestZoomIndex(zoom) === 0;
  const atMax = nearestZoomIndex(zoom) === ZOOM_STEPS.length - 1;
  const btnZoom =
    "rounded-md border border-teal-900/15 px-2 py-1 text-[11px] text-teal-800 hover:bg-teal-950/[0.04] disabled:opacity-40";

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
            className={btnZoom}
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

      <div className="flex shrink-0 items-center justify-center gap-1.5 border-b border-teal-900/8 bg-teal-950/[0.02] px-3 py-1.5">
        <button
          type="button"
          onClick={zoomOut}
          disabled={atMin}
          className={btnZoom}
          title="Perkecil (Ctrl + scroll)"
          aria-label="Zoom out"
        >
          −
        </button>
        <button
          type="button"
          onClick={zoomReset}
          className="min-w-[3.25rem] rounded-md px-1.5 py-1 text-[11px] tabular-nums text-teal-900/70 hover:bg-teal-950/[0.04]"
          title="Reset 100%"
        >
          {zoomPct}%
        </button>
        <button
          type="button"
          onClick={zoomIn}
          disabled={atMax}
          className={btnZoom}
          title="Perbesar (Ctrl + scroll)"
          aria-label="Zoom in"
        >
          +
        </button>
      </div>

      <div
        className="relative min-h-0 flex-1 overflow-auto bg-teal-950/[0.03] p-3"
        onWheel={onWheel}
      >
        {!ready ? (
          <p className="text-center text-xs text-teal-900/50">Memuat…</p>
        ) : null}

        {image ? (
          <div
            className="mx-auto origin-top"
            style={{
              width: `${zoom * 100}%`,
              maxWidth: "none",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={title}
              className={`mx-auto block h-auto w-full object-contain ${
                ready ? "" : "invisible absolute"
              }`}
              onLoad={() => setReady(true)}
              onError={() => setReady(true)}
              draggable={false}
            />
          </div>
        ) : pdf ? (
          <div
            className="mx-auto"
            style={{
              width: `${zoom * 100}%`,
              height: `${Math.max(70, 70 * zoom)}vh`,
              minHeight: "70vh",
            }}
          >
            <iframe
              title={title}
              src={url}
              className="h-full w-full rounded border border-teal-900/10 bg-white"
              onLoad={() => setReady(true)}
            />
          </div>
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
