export type ReceiptOcrSuggestion = {
  amount?: number;
  descriptionHint?: string;
  rawText: string;
};

/** Angka yang terlalu kecil/besar biasanya bukan total nota. */
const MIN_AMOUNT = 1_000;
const MAX_AMOUNT = 2_000_000_000;

function parseAmountToken(token: string): number | null {
  let t = token.trim();
  if (!t) return null;

  t = t.replace(/rp\.?/gi, "").replace(/\s/g, "");
  // Hapus desimal ,00 / .00 di akhir
  t = t.replace(/[,.](\d{2})$/, "");
  // Hapus pemisah ribuan
  t = t.replace(/[.,]/g, "");
  t = t.replace(/[^\d]/g, "");
  if (!t) return null;

  const n = Number(t);
  if (!Number.isFinite(n) || n < MIN_AMOUNT || n > MAX_AMOUNT) return null;
  return Math.round(n);
}

function extractAmounts(text: string): number[] {
  const amounts: number[] = [];
  const patterns = [
    /(?:rp\.?|idr)\s*[\d.,]+/gi,
    /(?:total|jumlah|bayar|grand\s*total|tagihan|harga)\s*[:.]?\s*(?:rp\.?\s*)?[\d.,]+/gi,
    /\b\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?\b/g,
    /\b\d{4,12}\b/g,
  ];

  for (const re of patterns) {
    const matches = text.match(re) ?? [];
    for (const m of matches) {
      const n = parseAmountToken(m);
      if (n != null) amounts.push(n);
    }
  }

  return [...new Set(amounts)];
}

function pickAmount(amounts: number[]): number | undefined {
  if (amounts.length === 0) return undefined;
  // Prefer angka terbesar yang masuk akal (sering total nota)
  return Math.max(...amounts);
}

function pickDescriptionHint(text: string): string | undefined {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 3);

  const skip =
    /^(total|subtotal|jumlah|bayar|tunai|kembalian|pajak|ppn|qty|harga|rp\.?|tanggal|tgl|kasir|struk|nota|receipt|thank|terima\s*kasih)/i;

  for (const line of lines.slice(0, 8)) {
    if (skip.test(line)) continue;
    if (/^[\d\s.,RpIDR:-]+$/i.test(line)) continue;
    if (line.length > 80) continue;
    return line.slice(0, 120);
  }

  const first = lines[0];
  return first ? first.slice(0, 120) : undefined;
}

export function parseReceiptText(rawText: string): ReceiptOcrSuggestion {
  const cleaned = rawText.replace(/\u0000/g, "").trim();
  const amounts = extractAmounts(cleaned);
  return {
    amount: pickAmount(amounts),
    descriptionHint: pickDescriptionHint(cleaned),
    rawText: cleaned,
  };
}
