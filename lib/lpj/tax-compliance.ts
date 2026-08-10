/**
 * Mesin kepatuhan pajak LPJ Swakelola (bukan alat evasi).
 *
 * Aturan:
 * - Nota Mandor / Admin-LPJ (isMandorExpense): pajak hanya setelah
 *   verifikasi AdminOK (breakdownStatus === APPROVED)
 * - Material alam → 0 pajak
 * - Gaji / upah pekerja → 0 pajak
 * - Dana perencanaan & pengawasan → PPh Final 3,5%
 * - Dana pengelolaan / ke sekolah → 0 pajak
 * - Pembelian manufaktur > Rp 2 jt → PPN 11% + PPh 1,5%
 *   (dibayar setelah nota pembelian)
 */

import { isDanaPengelolaanText } from "@/lib/lpj/jasa-labels";

export type MandorBreakdownStatus = "PENDING" | "APPROVED" | "REJECTED";

/** Pajak voucher Mandor hanya setelah AdminOK menyetujui pecahan. */
export function isMandorVoucherTaxEligible(input: {
  isMandorExpense?: boolean;
  breakdownStatus?: MandorBreakdownStatus | null;
}): boolean {
  if (!input.isMandorExpense) return true;
  return input.breakdownStatus === "APPROVED";
}

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
  /** Nama kategori transaksi (mis. Bayar jasa Pengawas, Upah) */
  categoryName?: string | null;
  /** MATERIAL | LABOR | … */
  lineKind?: string | null;
};

export type TaxLineResult = {
  ppn: number;
  pph: number;
  totalTax: number;
  kind:
    | "NONE"
    | "PPN_PPH"
    | "PPH_FINAL"
    | "EXEMPT_ALAM"
    | "EXEMPT_LABOR"
    | "EXEMPT_MANAGEMENT"
    | "EXEMPT_CODE";
  label: string;
  overThreshold: boolean;
};

function startsWithCi(value: string | null | undefined, prefix: string) {
  if (!value) return false;
  return value.slice(0, prefix.length).toLowerCase() === prefix.toLowerCase();
}

function combinedText(input: TaxLineInput) {
  return `${input.categoryName ?? ""} ${input.description ?? ""}`.trim();
}

function codeHead(code: string | null | undefined) {
  if (!code) return "";
  return code.slice(0, 3).toLowerCase();
}

/** Kode Excel GaJ = gaji; MoP = bebas khusus. */
function codeExempt(code: string | null | undefined) {
  const head = codeHead(code);
  return head === "mop" || head === "gaj";
}

/** Gaji / upah pekerja — tidak kena pajak. */
export function isLaborWageExempt(input: TaxLineInput): boolean {
  if (input.lineKind === "LABOR") return true;
  if (codeHead(input.code) === "gaj") return true;

  const text = combinedText(input).toLowerCase();
  if (!text) return false;

  // Jangan salah anggap perencanaan/pengawasan sebagai gaji
  if (isPlanningOrSupervision(input)) return false;

  return (
    /\b(upah|gaji|hok)\b/.test(text) ||
    /pekerja/.test(text) ||
    /tenaga\s*kerja/.test(text) ||
    /bayar\s*ongkos/.test(text) ||
    /pembayaran\s*pekerja/.test(text) ||
    startsWithCi(input.categoryName, "Upah")
  );
}

/** Hanya perencanaan & pengawasan yang dipungut PPh Final 3,5%. */
export function isPlanningOrSupervision(input: TaxLineInput): boolean {
  const text = combinedText(input).toLowerCase();
  if (!text) return false;
  if (isDanaPengelolaanText(text)) return false;
  // Cocok "perencana"/"Pengawas" dan bentuk lama perencanaan/pengawasan
  return /perencana|pengawas/.test(text);
}

/** Dana pengelolaan / diberikan ke sekolah — tidak kena pajak. */
export function isManagementFundExempt(input: TaxLineInput): boolean {
  return isDanaPengelolaanText(combinedText(input));
}

/** Hitung pajak satu baris belanja (jumlah N). */
export function computeLineTax(input: TaxLineInput): TaxLineResult {
  const amount = Math.max(0, Math.round(input.amount || 0));
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

  if (isLaborWageExempt(input)) {
    return {
      ppn: 0,
      pph: 0,
      totalTax: 0,
      kind: "EXEMPT_LABOR",
      label: "Bebas pajak — gaji/upah pekerja",
      overThreshold,
    };
  }

  if (isManagementFundExempt(input)) {
    return {
      ppn: 0,
      pph: 0,
      totalTax: 0,
      kind: "EXEMPT_MANAGEMENT",
      label: "Bebas pajak — dana pengelolaan",
      overThreshold,
    };
  }

  // Perencanaan & pengawasan → PPh Final 3,5% (tanpa PPN + PPh 1,5%)
  if (amount > 1 && isPlanningOrSupervision(input)) {
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
      label: "Bayar Pajak PPN (11 %) + PPH (1,5 %) — setelah nota",
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

/**
 * Hitung pajak satu voucher BKU (bisa banyak baris item).
 * - Upah pekerja tidak masuk dasar pajak
 * - Material alam tidak masuk dasar pajak
 * - Dasar PPN/PPH = total material kena pajak
 * - Perencanaan/pengawasan = PPh Final atas total voucher
 */
export function computeVoucherTax(input: {
  amount: number;
  description?: string | null;
  categoryName?: string | null;
  isMaterialAlam?: boolean;
  /** Nota Mandor / Admin-LPJ — pajak menunggu APPROVED. */
  isMandorExpense?: boolean;
  breakdownStatus?: MandorBreakdownStatus | null;
  lines?: Array<{
    amount: number;
    description?: string | null;
    kind?: string | null;
    isMaterialAlam?: boolean;
  }> | null;
}): TaxLineResult {
  const voucherAmount = Math.max(0, Math.round(input.amount || 0));
  const meta: TaxLineInput = {
    amount: voucherAmount,
    description: input.description,
    categoryName: input.categoryName,
    isMaterialAlam: input.isMaterialAlam,
  };

  if (!isMandorVoucherTaxEligible(input)) {
    return {
      ppn: 0,
      pph: 0,
      totalTax: 0,
      kind: "NONE",
      label:
        input.breakdownStatus === "REJECTED"
          ? "Tidak kena pajak — nota ditolak"
          : "Pajak menunggu verifikasi AdminOK",
      overThreshold: voucherAmount > TAX_THRESHOLD && !input.isMaterialAlam,
    };
  }

  if (isManagementFundExempt(meta)) {
    return computeLineTax(meta);
  }

  if (isPlanningOrSupervision(meta)) {
    const lines = input.lines ?? [];
    const fromLines =
      lines.length > 0
        ? lines.reduce((s, l) => s + Math.round(l.amount), 0)
        : 0;
    return computeLineTax({
      ...meta,
      amount: fromLines > 0 ? fromLines : voucherAmount,
    });
  }

  const lines = input.lines;
  if (lines && lines.length > 0) {
    let taxableMaterial = 0;
    let onlyLabor = true;
    for (const line of lines) {
      const labor = line.kind === "LABOR" || isLaborWageExempt({
        amount: line.amount,
        description: line.description,
        categoryName: input.categoryName,
        lineKind: line.kind,
      });
      if (labor) continue;
      onlyLabor = false;
      if (line.isMaterialAlam) continue;
      taxableMaterial += Math.round(line.amount);
    }
    if (onlyLabor) {
      return computeLineTax({
        amount: voucherAmount,
        description: input.description,
        categoryName: input.categoryName,
        lineKind: "LABOR",
      });
    }
    return computeLineTax({
      amount: taxableMaterial,
      description: input.description,
      categoryName: input.categoryName,
      isMaterialAlam: taxableMaterial === 0 && Boolean(input.isMaterialAlam),
      lineKind: "MATERIAL",
    });
  }

  return computeLineTax(meta);
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
