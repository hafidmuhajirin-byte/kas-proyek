"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

type Offset = { x: number; y: number };

type SignatureLayoutState = {
  insertTtd: boolean;
  insertStempel: boolean;
  ttdScale: number;
  stampScale: number;
  offsets: Record<string, Offset>;
  setInsertTtd: (v: boolean) => void;
  setInsertStempel: (v: boolean) => void;
  setTtdScale: (v: number) => void;
  setStampScale: (v: number) => void;
  setOffset: (id: string, offset: Offset) => void;
  interactive: boolean;
};

const DEFAULT: SignatureLayoutState = {
  insertTtd: true,
  insertStempel: true,
  ttdScale: 1,
  stampScale: 1,
  offsets: {},
  setInsertTtd: () => {},
  setInsertStempel: () => {},
  setTtdScale: () => {},
  setStampScale: () => {},
  setOffset: () => {},
  interactive: false,
};

const LpjSignatureContext = createContext<SignatureLayoutState>(DEFAULT);

const STORAGE_PREFIX = "lpj-sign-layout:";

type StoredLayout = {
  insertTtd: boolean;
  insertStempel: boolean;
  ttdScale: number;
  stampScale: number;
  offsets: Record<string, Offset>;
};

function clampScale(n: number) {
  return Math.min(2.5, Math.max(0.4, n));
}

export function LpjSignatureProvider({
  projectId,
  children,
}: {
  projectId?: string;
  children: ReactNode;
}) {
  const [insertTtd, setInsertTtd] = useState(true);
  const [insertStempel, setInsertStempel] = useState(true);
  const [ttdScale, setTtdScaleState] = useState(1);
  const [stampScale, setStampScaleState] = useState(1);
  const [offsets, setOffsets] = useState<Record<string, Offset>>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!projectId || typeof window === "undefined") {
      setReady(true);
      return;
    }
    try {
      const raw = localStorage.getItem(`${STORAGE_PREFIX}${projectId}`);
      if (raw) {
        const parsed = JSON.parse(raw) as StoredLayout;
        if (typeof parsed.insertTtd === "boolean") setInsertTtd(parsed.insertTtd);
        if (typeof parsed.insertStempel === "boolean") {
          setInsertStempel(parsed.insertStempel);
        }
        if (typeof parsed.ttdScale === "number") {
          setTtdScaleState(clampScale(parsed.ttdScale));
        }
        if (typeof parsed.stampScale === "number") {
          setStampScaleState(clampScale(parsed.stampScale));
        }
        if (parsed.offsets && typeof parsed.offsets === "object") {
          setOffsets(parsed.offsets);
        }
      }
    } catch {
      /* ignore corrupt storage */
    }
    setReady(true);
  }, [projectId]);

  useEffect(() => {
    if (!ready || !projectId || typeof window === "undefined") return;
    const payload: StoredLayout = {
      insertTtd,
      insertStempel,
      ttdScale,
      stampScale,
      offsets,
    };
    try {
      localStorage.setItem(
        `${STORAGE_PREFIX}${projectId}`,
        JSON.stringify(payload),
      );
    } catch {
      /* quota / private mode */
    }
  }, [ready, projectId, insertTtd, insertStempel, ttdScale, stampScale, offsets]);

  const setTtdScale = useCallback((v: number) => {
    setTtdScaleState(clampScale(v));
  }, []);
  const setStampScale = useCallback((v: number) => {
    setStampScaleState(clampScale(v));
  }, []);
  const setOffset = useCallback((id: string, offset: Offset) => {
    setOffsets((prev) => ({ ...prev, [id]: offset }));
  }, []);

  return (
    <LpjSignatureContext.Provider
      value={{
        insertTtd,
        insertStempel,
        ttdScale,
        stampScale,
        offsets,
        setInsertTtd,
        setInsertStempel,
        setTtdScale,
        setStampScale,
        setOffset,
        interactive: true,
      }}
    >
      {children}
    </LpjSignatureContext.Provider>
  );
}

export function LpjSignatureToolbar({
  className = "",
}: {
  className?: string;
}) {
  const ctx = useContext(LpjSignatureContext);
  if (!ctx.interactive) return null;

  return (
    <div
      className={`print:hidden rounded-xl border border-[var(--line-soft)] bg-[var(--surface)] p-3 text-sm ${className}`}
    >
      <p className="mb-2 font-medium text-[var(--ink)]">
        Tanda tangan &amp; stempel (cetak)
      </p>
      <div className="flex flex-wrap gap-4">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={ctx.insertTtd}
            onChange={(e) => ctx.setInsertTtd(e.target.checked)}
          />
          Sisipkan TTD
        </label>
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={ctx.insertStempel}
            onChange={(e) => ctx.setInsertStempel(e.target.checked)}
          />
          Sisipkan stempel (Kepala Sekolah)
        </label>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block text-[var(--ink-muted)]">
          Skala TTD ({ctx.ttdScale.toFixed(2)}×)
          <input
            type="range"
            min={0.4}
            max={2.5}
            step={0.05}
            value={ctx.ttdScale}
            onChange={(e) => ctx.setTtdScale(Number(e.target.value))}
            className="mt-1 w-full"
          />
        </label>
        <label className="block text-[var(--ink-muted)]">
          Skala stempel ({ctx.stampScale.toFixed(2)}×) — dasar 3,5 cm
          <input
            type="range"
            min={0.4}
            max={2.5}
            step={0.05}
            value={ctx.stampScale}
            onChange={(e) => ctx.setStampScale(Number(e.target.value))}
            className="mt-1 w-full"
          />
        </label>
      </div>
      <p className="mt-2 text-xs text-[var(--ink-muted)]">
        Di pratinjau, seret gambar TTD/stempel bila posisinya kurang pas. Pengaturan
        disimpan di browser untuk proyek ini.
      </p>
    </div>
  );
}

/** Gambar TTD atau stempel — ikut checklist, bisa digeser & diskalakan. */
export function LpjSignatureMark({
  kind,
  markId,
  src,
  alt,
  className = "",
}: {
  kind: "ttd" | "stamp";
  markId: string;
  src: string;
  alt: string;
  className?: string;
}) {
  const ctx = useContext(LpjSignatureContext);
  const reactId = useId();
  const id = markId || reactId;
  const visible = kind === "ttd" ? ctx.insertTtd : ctx.insertStempel;
  const scale = kind === "ttd" ? ctx.ttdScale : ctx.stampScale;
  const offset = ctx.offsets[id] ?? { x: 0, y: 0 };
  const dragging = useRef(false);
  const origin = useRef({ x: 0, y: 0, ox: 0, oy: 0 });

  const onPointerDown = (e: ReactPointerEvent<HTMLImageElement>) => {
    if (!ctx.interactive || !visible) return;
    e.preventDefault();
    dragging.current = true;
    origin.current = {
      x: e.clientX,
      y: e.clientY,
      ox: offset.x,
      oy: offset.y,
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLImageElement>) => {
    if (!dragging.current) return;
    const dx = e.clientX - origin.current.x;
    const dy = e.clientY - origin.current.y;
    ctx.setOffset(id, {
      x: origin.current.ox + dx,
      y: origin.current.oy + dy,
    });
  };

  const onPointerUp = () => {
    dragging.current = false;
  };

  if (!src || !visible) return null;

  const stampSize = `calc(3.5cm * ${scale})`;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      draggable={false}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className={`lpj-sign-mark absolute object-contain select-none ${
        ctx.interactive ? "cursor-grab active:cursor-grabbing print:cursor-default" : ""
      } ${className}`}
      style={
        kind === "stamp"
          ? {
              left: "0.15rem",
              top: 0,
              width: stampSize,
              height: stampSize,
              opacity: 0.92,
              transform: `translate(${offset.x}px, ${offset.y}px)`,
              zIndex: 2,
            }
          : {
              inset: 0,
              width: "100%",
              height: "100%",
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
              transformOrigin: "center center",
              zIndex: 1,
            }
      }
    />
  );
}
