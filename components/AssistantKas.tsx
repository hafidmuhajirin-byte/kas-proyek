"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import type { AssistantBlock, AssistantReply } from "@/lib/assistant/engine";

type ChatItem = {
  id: string;
  role: "user" | "assistant";
  text: string;
  blocks?: AssistantBlock[];
};

export const ASSISTANT_OPEN_EVENT = "kas-assistant-open";

export type AssistantOpenDetail = {
  message?: string;
  reply?: AssistantReply;
  /** If true, show as assistant message without calling API again */
  preset?: boolean;
};

function Blocks({ blocks }: { blocks: AssistantBlock[] }) {
  if (!blocks.length) return null;
  return (
    <div className="mt-2 space-y-2">
      <div className="grid gap-1.5 sm:grid-cols-2">
        {blocks
          .filter((b): b is Extract<AssistantBlock, { type: "stat" }> => b.type === "stat")
          .map((b, i) => (
            <div
              key={`s-${i}`}
              className="rounded-lg border border-[var(--line-soft)] bg-[#fffcf7] px-2.5 py-2"
            >
              <p className="text-[10px] tracking-wide text-[var(--ink-faint)] uppercase">
                {b.label}
              </p>
              <p className="font-serif text-base tabular-nums text-[var(--ink)]">
                {b.value}
              </p>
              {b.hint ? (
                <p className="text-[11px] text-[var(--ink-faint)]">{b.hint}</p>
              ) : null}
            </div>
          ))}
      </div>
      {blocks
        .filter((b): b is Extract<AssistantBlock, { type: "list" }> => b.type === "list")
        .map((b, i) => (
          <ul
            key={`l-${i}`}
            className="space-y-1 rounded-lg border border-[var(--line-soft)] bg-[#fffcf7] px-3 py-2 text-xs text-[var(--ink-muted)]"
          >
            {b.items.map((item, j) => (
              <li key={j} className="leading-snug">
                · {item}
              </li>
            ))}
          </ul>
        ))}
      <div className="flex flex-wrap gap-2">
        {blocks
          .filter((b): b is Extract<AssistantBlock, { type: "link" }> => b.type === "link")
          .map((b, i) => (
            <Link
              key={`a-${i}`}
              href={b.href}
              className="rounded-md border border-[var(--line)] bg-[#fffcf7] px-2.5 py-1 text-xs font-medium text-[var(--accent)]"
            >
              {b.label}
            </Link>
          ))}
      </div>
    </div>
  );
}

/** Open Asisten chat from anywhere (forms, guards). */
export function openAssistantChat(detail: AssistantOpenDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(ASSISTANT_OPEN_EVENT, { detail }),
  );
}

export function AssistantKas() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([
    "Pengingat hari ini",
    "Menu saya",
    "Bantuan",
  ]);
  const [items, setItems] = useState<ChatItem[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Saya Asisten Kas — memuat data Anda…",
    },
  ]);
  const [pending, startTransition] = useTransition();
  const [badge, setBadge] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const bootstrapped = useRef(false);

  useEffect(() => {
    if (!open) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [items, open]);

  useEffect(() => {
    function onOpen(ev: Event) {
      const detail = (ev as CustomEvent<AssistantOpenDetail>).detail ?? {};
      setOpen(true);
      if (detail.preset && detail.reply) {
        setItems((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            text: detail.reply!.text,
            blocks: detail.reply!.blocks,
          },
        ]);
        return;
      }
      if (detail.message) {
        ask(detail.message);
      }
    }
    window.addEventListener(ASSISTANT_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(ASSISTANT_OPEN_EVENT, onOpen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    fetch("/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "prioritas hari ini", bootstrap: true }),
    })
      .then((r) => r.json())
      .then(
        (data: {
          reply?: AssistantReply;
          reminderCount?: number;
          openChat?: boolean;
          suggestions?: string[];
          welcome?: string;
        }) => {
          if (data.welcome) {
            setItems([
              {
                id: "welcome",
                role: "assistant",
                text: data.welcome,
              },
            ]);
          }
          if (Array.isArray(data.suggestions) && data.suggestions.length) {
            setSuggestions(data.suggestions);
          }
          if (typeof data.reminderCount === "number") {
            setBadge(data.reminderCount);
          }
          if (data.openChat && data.reply) {
            setOpen(true);
            setItems((prev) => [
              ...prev,
              {
                id: `boot-${Date.now()}`,
                role: "assistant",
                text: data.reply!.text,
                blocks: data.reply!.blocks,
              },
            ]);
          }
        },
      )
      .catch(() => {});
  }, []);

  function ask(message: string) {
    const text = message.trim();
    if (!text || pending) return;
    const userItem: ChatItem = {
      id: `u-${Date.now()}`,
      role: "user",
      text,
    };
    setItems((prev) => [...prev, userItem]);
    setInput("");

    startTransition(async () => {
      try {
        const res = await fetch("/api/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text }),
        });
        const data = (await res.json()) as {
          reply?: AssistantReply;
          reminderCount?: number;
          suggestions?: string[];
          error?: string;
        };
        if (typeof data.reminderCount === "number") {
          setBadge(data.reminderCount);
        }
        if (Array.isArray(data.suggestions) && data.suggestions.length) {
          setSuggestions(data.suggestions);
        }
        if (!res.ok || !data.reply) {
          setItems((prev) => [
            ...prev,
            {
              id: `e-${Date.now()}`,
              role: "assistant",
              text: data.error ?? "Gagal membaca data. Coba lagi.",
            },
          ]);
          return;
        }
        setItems((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            text: data.reply!.text,
            blocks: data.reply!.blocks,
          },
        ]);
      } catch {
        setItems((prev) => [
          ...prev,
          {
            id: `e-${Date.now()}`,
            role: "assistant",
            text: "Koneksi gagal. Pastikan aplikasi berjalan.",
          },
        ]);
      }
    });
  }

  return (
    <div className="print:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed left-4 z-40 flex h-12 min-w-12 items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-3.5 text-sm font-medium text-[#f7f4ee] shadow-md transition hover:bg-[var(--accent-soft)] bottom-[calc(4.25rem+env(safe-area-inset-bottom,0px))] lg:right-6 lg:bottom-6 lg:left-auto lg:px-4"
        aria-label="Buka Asisten Kas"
      >
        <span className="lg:hidden">AI</span>
        <span className="hidden lg:inline">Asisten</span>
        {badge > 0 ? (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#f7f4ee] px-1 text-[11px] font-semibold text-[var(--accent)]">
            {badge > 9 ? "9+" : badge}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-end sm:items-end sm:p-4 lg:items-end">
          <button
            type="button"
            className="absolute inset-0 bg-[var(--ink)]/30"
            aria-label="Tutup asisten"
            onClick={() => setOpen(false)}
          />
          <div className="safe-pb relative flex h-[min(82vh,640px)] w-full flex-col rounded-t-2xl border border-[var(--line-soft)] bg-[#fffcf7] shadow-xl sm:max-w-md sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-[var(--line-soft)] px-4 py-3">
              <div>
                <p className="font-serif text-lg text-[var(--ink)]">Asisten Kas</p>
                <p className="text-[11px] text-[var(--ink-faint)]">
                  Pantau data · saran perbaikan · menu
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md px-2 py-1 text-sm text-[var(--ink-muted)] hover:bg-[var(--paper-tint)]"
              >
                Tutup
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 border-b border-[var(--line-soft)] px-3 py-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={pending}
                  onClick={() => ask(s)}
                  className="min-h-9 rounded-full border border-[var(--line)] px-3 py-1.5 text-xs text-[var(--ink-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className={`flex ${
                    item.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[92%] rounded-xl px-3 py-2 text-sm ${
                      item.role === "user"
                        ? "bg-[var(--accent)] text-[#f7f4ee]"
                        : "border border-[var(--line-soft)] bg-[var(--paper)] text-[var(--ink)]"
                    }`}
                  >
                    <p className="leading-snug whitespace-pre-wrap">{item.text}</p>
                    {item.blocks ? <Blocks blocks={item.blocks} /> : null}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            <form
              className="flex gap-2 border-t border-[var(--line-soft)] p-3"
              onSubmit={(e) => {
                e.preventDefault();
                ask(input);
              }}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Tanya menu, nota, pajak, pengingat…"
                className="min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15"
                disabled={pending}
              />
              <button
                type="submit"
                disabled={pending || !input.trim()}
                className="rounded-lg bg-[var(--accent)] px-3 py-2.5 text-sm font-medium text-[#f7f4ee] disabled:opacity-50"
              >
                {pending ? "…" : "Kirim"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
