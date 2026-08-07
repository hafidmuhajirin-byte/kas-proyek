import { formatRupiah } from "@/lib/money";

export type PencairanOption = {
  /** Prefixed key: "d:<id>" or "a:<id>" */
  key: string;
  kind: "disbursement" | "advance";
  id: string;
  label: string;
  amount: number;
  used: number;
  remaining: number;
  date: Date;
};

export function optionKey(kind: "disbursement" | "advance", id: string) {
  return kind === "disbursement" ? `d:${id}` : `a:${id}`;
}

export function parsePencairanKey(
  raw: string,
): { kind: "disbursement" | "advance"; id: string } | null {
  const v = raw.trim();
  if (v.startsWith("d:") && v.length > 2) {
    return { kind: "disbursement", id: v.slice(2) };
  }
  if (v.startsWith("a:") && v.length > 2) {
    return { kind: "advance", id: v.slice(2) };
  }
  return null;
}

export function formatPencairanLabel(
  opt: Pick<PencairanOption, "label" | "amount" | "remaining">,
) {
  const sisa =
    opt.remaining > 0
      ? `sisa ${formatRupiah(opt.remaining)}`
      : opt.remaining < 0
        ? `kelebihan ${formatRupiah(-opt.remaining)}`
        : "habis";
  return `${opt.label} · ${formatRupiah(opt.amount)} (${sisa})`;
}
