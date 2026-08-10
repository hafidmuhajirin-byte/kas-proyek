"use client";

import { useEffect, useState } from "react";
import { btnSecondaryClass } from "@/components/ui";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua);
  const iPadOs = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return iOS || iPadOs;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia("(display-mode: standalone)").matches;
  const nav = (navigator as Navigator & { standalone?: boolean }).standalone;
  return mq || Boolean(nav);
}

/**
 * Tombol ringan "Pasang di HP".
 * Android/Chrome: beforeinstallprompt. iOS: petunjuk Share → Add to Home Screen.
 */
export function PwaInstallPrompt({ compact = false }: { compact?: boolean }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [iosHint, setIosHint] = useState(false);
  const [hidden, setHidden] = useState(true);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    if (isStandalone()) {
      setHidden(true);
      return;
    }

    const ios = isIos();
    setIosHint(ios);
    setHidden(false);

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  if (hidden) return null;
  if (!iosHint && !deferred) return null;

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    try {
      await deferred.userChoice;
    } catch {
      // ignore
    }
    setDeferred(null);
  }

  return (
    <div
      className={
        compact
          ? "space-y-1"
          : "rounded-xl border border-[var(--line-soft)] bg-[#fffcf7]/90 px-3 py-2.5"
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        {deferred ? (
          <button
            type="button"
            className={`${btnSecondaryClass} min-h-11 text-sm`}
            onClick={() => void install()}
          >
            Pasang di HP
          </button>
        ) : null}
        {iosHint ? (
          <button
            type="button"
            className={`${btnSecondaryClass} min-h-11 text-sm`}
            onClick={() => setShowIosHelp((v) => !v)}
          >
            Pasang di iPhone
          </button>
        ) : null}
        {!compact ? (
          <p className="text-xs text-[var(--ink-faint)]">
            Seperti aplikasi — ringan, tanpa Play Store
          </p>
        ) : null}
      </div>
      {iosHint && showIosHelp ? (
        <p className="mt-1 text-xs leading-relaxed text-[var(--ink-muted)]">
          Safari → tombol Bagikan → <strong>Add to Home Screen</strong> /
          Tambah ke Layar Utama.
        </p>
      ) : null}
    </div>
  );
}
