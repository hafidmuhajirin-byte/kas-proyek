"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent,
} from "react";

type OpenFn = (url: string, title?: string) => void;

let openProofReview: OpenFn | null = null;

const PROOF_WIDTH_KEY = "kas-proof-panel-width-px";
const WIDTH_MIN = 280;
const WIDTH_MAX_RATIO = 0.72;
const WIDTH_DEFAULT = 360;

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

function clampWidth(px: number): number {
  const max = Math.max(
    WIDTH_MIN,
    Math.floor(window.innerWidth * WIDTH_MAX_RATIO),
  );
  return Math.min(max, Math.max(WIDTH_MIN, Math.round(px)));
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
 * Host tunggal — pasang di AppShell / MandorShell.
 * Panel kanan bisa di-drag; konten utama ikut via --proof-panel-w.
 */
export function ProofReviewHost() {
  const desktop = useDesktopProofReview();
  const [url, setUrl] = useState<string | null>(null);
  const [title, setTitle] = useState<string>("Bukti");
  const [ready, setReady] = useState(false);
  const [width, setWidth] = useState(WIDTH_DEFAULT);
  const [zoom, setZoom] = useState(ZOOM_DEFAULT);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PROOF_WIDTH_KEY);
      if (raw) {
        const n = Number(raw);
        if (Number.isFinite(n) && n >= WIDTH_MIN) {
          setWidth(clampWidth(n));
          return;
        }
      }
      // migrasi key lama narrow/wide
      const legacy = localStorage.getItem("kas-proof-panel-width");
      if (legacy === "wide") setWidth(480);
      else if (legacy === "narrow") setWidth(320);
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

  // Saat resize jendela, jaga panel tetap dalam batas
  useEffect(() => {
    if (!desktop) return;
    const onResize = () => {
      setWidth((w) => clampWidth(w));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [desktop]);

  const persistWidth = useCallback((px: number) => {
    try {
      localStorage.setItem(PROOF_WIDTH_KEY, String(px));
    } catch {
      /* ignore */
    }
  }, []);

  const close = useCallback(() => setUrl(null), []);

  const onResizePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      dragRef.current = { startX: e.clientX, startW: width };
      setDragging(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [width],
  );

  const onResizePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!dragRef.current) return;
      // Drag ke kiri = perbesar panel (panel di kanan)
      const delta = dragRef.current.startX - e.clientX;
      const next = clampWidth(dragRef.current.startW + delta);
      setWidth(next);
      applyProofOpenCss(next);
    },
    [],
  );

  const onResizePointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!dragRef.current) return;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      dragRef.current = null;
      setDragging(false);
      setWidth((w) => {
        const next = clampWidth(w);
        persistWidth(next);
        return next;
      });
    },
    [persistWidth],
  );

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
      className={`fixed inset-y-0 right-0 z-[80] hidden flex-col border-l border-teal-900/15 bg-[#fffcf7] shadow-xl lg:flex ${
        dragging ? "select-none" : ""
      }`}
    >
      {/* Handle drag di tepi kiri panel */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Seret untuk ubah lebar panel bukti"
        aria-valuenow={width}
        aria-valuemin={WIDTH_MIN}
        tabIndex={0}
        onPointerDown={onResizePointerDown}
        onPointerMove={onResizePointerMove}
        onPointerUp={onResizePointerUp}
        onPointerCancel={onResizePointerUp}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            setWidth((w) => {
              const next = clampWidth(w + 24);
              persistWidth(next);
              return next;
            });
          } else if (e.key === "ArrowRight") {
            e.preventDefault();
            setWidth((w) => {
              const next = clampWidth(w - 24);
              persistWidth(next);
              return next;
            });
          }
        }}
        className={`absolute inset-y-0 left-0 z-10 w-3 -translate-x-1/2 cursor-col-resize touch-none ${
          dragging ? "bg-teal-700/25" : "hover:bg-teal-700/15"
        }`}
      >
        <span
          className={`absolute top-1/2 left-1/2 h-10 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full ${
            dragging ? "bg-teal-700" : "bg-teal-900/25"
          }`}
          aria-hidden
        />
      </div>

      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-teal-900/10 px-3 py-2.5 pl-4">
        <p className="min-w-0 truncate text-sm font-medium text-teal-950">
          {title}
        </p>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="hidden text-[10px] text-teal-900/45 xl:inline">
            Seret tepi kiri
          </span>
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
