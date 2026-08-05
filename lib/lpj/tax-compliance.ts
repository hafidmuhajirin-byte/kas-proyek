/**
 * Mesin kepatuhan pajak LPJ Swakelola (bukan alat evasi).
 * Port aturan bisnis dari template BUKU KAS + flag material alam.
 */

export const TAX_THRESHOLD = 2_000_000;
export const PPN_RATE = 0.11;
export const PPH_RATE = 0.015;
export const PPH_FINAL_RATE = 0.035;
/** Plafon monitoring akumulasi pajak vs nilai SPK */
export const TAX_CEILING_OF_SPK = 0.035;

export type TaxLineInput = {
  amount: number;
  description?: string | null;
  /** Code uraian Excel (GaJ / MoP) — opsional */
  code?: string | null;
  isMaterialAlam?: boolean;
};

export type TaxLineResult = {
  ppn: number;
  pph: number;
  totalTax: number;
  kind: "NONE" | "PPN_PPH" | "PPH_FINAL" | "EXEMPT_ALAM" | "EXEMPT_CODE";
  label: string;
  overThreshold: boolean;
};

function startsWithCi(value: string | null | undefined, prefix: string) {
  if (!value) return false;
  return value.slice(0, prefix.length).toLowerCase() === prefix.toLowerCase();
}

function codeExempt(code: string | null | undefined) {
  if (!code) return false;
  const head = code.slice(0, 3).toLowerCase();
  return head === "mop" || head === "gaj";
}

/** Hitung pajak satu baris belanja (jumlah N). */
export function computeLineTax(input: TaxLineInput): TaxLineResult {
  const amount = Math.max(0, Math.round(input.amount || 0));
  const description = input.description ?? "";
  const overThreshold = amount > TAX_THRESHOLD;

  if (input.isMaterialAlam) {
    return {
      ppn: 0,
      pph: 0,
      totalTax: 0,
      kind: "EXEMPT_ALAM",
      label: "Bebas pajak — material alam",
      overThreshold,
    };
  }

  // Uraian diawali "Bayar" → PPh Final 3,5% (tanpa PPN + PPh 1,5%)
  if (amount > 1 && startsWithCi(description, "Bayar")) {
    const pph = Math.round(amount * PPH_FINAL_RATE);
    return {
      ppn: 0,
      pph,
      totalTax: pph,
      kind: "PPH_FINAL",
      label: "Terima PPh Pasal 4 ayat 2 (3,5 %)",
      overThreshold,
    };
  }

  if (overThreshold) {
    if (codeExempt(input.code)) {
      return {
        ppn: 0,
        pph: 0,
        totalTax: 0,
        kind: "EXEMPT_CODE",
        label: "Bebas — kode GaJ/MoP",
        overThreshold,
      };
    }
    const ppn = Math.round(amount * PPN_RATE);
    const pph = Math.round(amount * PPH_RATE);
    return {
      ppn,
      pph,
      totalTax: ppn + pph,
      kind: "PPN_PPH",
      label: "Bayar Pajak PPN (11 %) + PPH (1,5 %)",
      overThreshold,
    };
  }

  return {
    ppn: 0,
    pph: 0,
    totalTax: 0,
    kind: "NONE",
    label: "Di bawah ambang Rp 2.000.000",
    overThreshold: false,
  };
}

export type TaxCeilingStatus = {
  spkValue: number;
  ceiling: number;
  totalTax: number;
  percentOfCeiling: number;
  remaining: number;
  status: "ok" | "warn" | "over";
};

/** Status akumulasi pajak vs plafon 3,5% SPK (monitoring). */
export function getTaxCeilingStatus(
  totalTax: number,
  spkValue: number,
): TaxCeilingStatus {
  const ceiling = Math.round(Math.max(0, spkValue) * TAX_CEILING_OF_SPK);
  const tax = Math.max(0, Math.round(totalTax));
  const percentOfCeiling =
    ceiling > 0 ? Math.min(999, (tax / ceiling) * 100) : tax > 0 ? 100 : 0;
  const remaining = Math.max(0, ceiling - tax);
  let status: TaxCeilingStatus["status"] = "ok";
  if (tax > ceiling) status = "over";
  else if (percentOfCeiling >= 80) status = "warn";
  return {
    spkValue: Math.max(0, spkValue),
    ceiling,
    totalTax: tax,
    percentOfCeiling,
    remaining,
    status,
  };
}

export function aggregateLineTaxes(lines: TaxLineInput[]) {
  let totalTax = 0;
  let totalPpn = 0;
  let totalPph = 0;
  const results = lines.map((line) => {
    const r = computeLineTax(line);
    totalTax += r.totalTax;
    totalPpn += r.ppn;
    totalPph += r.pph;
    return r;
  });
  return { results, totalTax, totalPpn, totalPph };
}
