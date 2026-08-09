/**
 * Smart Estimator — target rasio upah vs material per kategori SPK.
 */

import {
  LABEL_BAYAR_JASA_PENGAWASAN,
  LABEL_BAYAR_JASA_PERENCANAAN,
  LABEL_DANA_PENGELOLAAN,
} from "@/lib/lpj/jasa-labels";

export type SpkCategoryKey =
  | "PERENCANAAN"
  | "PENGAWASAN"
  | "PENGELOLAAN"
  | "REHAB_FISIK"
  | "REHAB_MEBELAIR"
  | "PEMBANGUNAN_BARU"
  | "MEBELAIR_BARU"
  | "PEMBANGUNAN_APE_LUAR"
  | "PENGELOLAAN_LINGKUNGAN"
  | "SANITASI";

export const SPK_CATEGORY_LABELS: Record<SpkCategoryKey, string> = {
  PERENCANAAN: LABEL_BAYAR_JASA_PERENCANAAN,
  PENGAWASAN: LABEL_BAYAR_JASA_PENGAWASAN,
  PENGELOLAAN: "Pengelolaan",
  REHAB_FISIK: "Rehab Fisik",
  REHAB_MEBELAIR: "Rehab Mebelair",
  PEMBANGUNAN_BARU: "Pembangunan Baru",
  MEBELAIR_BARU: "Mebelair Baru",
  PEMBANGUNAN_APE_LUAR: "Pembangunan APE Luar",
  PENGELOLAAN_LINGKUNGAN: "Pengelolaan Lingkungan",
  SANITASI: "Sanitasi",
};

export const SPK_CATEGORIES = Object.keys(SPK_CATEGORY_LABELS) as SpkCategoryKey[];

/** Rasio default dikunci di plan */
export function defaultLaborMaterialPercent(
  category: SpkCategoryKey,
  isBeliBaru = false,
): { laborPercent: number; materialPercent: number } {
  switch (category) {
    case "REHAB_FISIK":
    case "PEMBANGUNAN_BARU":
      return { laborPercent: 40, materialPercent: 60 };
    case "REHAB_MEBELAIR":
      return isBeliBaru
        ? { laborPercent: 50, materialPercent: 50 }
        : { laborPercent: 70, materialPercent: 30 };
    case "MEBELAIR_BARU":
      return { laborPercent: 50, materialPercent: 50 };
    default:
      return { laborPercent: 50, materialPercent: 50 };
  }
}

export type SpkBudgetInput = {
  category: SpkCategoryKey;
  amount: number;
  laborPercent?: number;
  materialPercent?: number;
  isBeliBaru?: boolean;
};

export type SpkTargetLine = {
  category: SpkCategoryKey;
  label: string;
  amount: number;
  laborPercent: number;
  materialPercent: number;
  laborTarget: number;
  materialTarget: number;
};

export function computeSpkTargets(lines: SpkBudgetInput[]): {
  lines: SpkTargetLine[];
  totalAmount: number;
  totalLaborTarget: number;
  totalMaterialTarget: number;
} {
  const out: SpkTargetLine[] = [];
  let totalAmount = 0;
  let totalLaborTarget = 0;
  let totalMaterialTarget = 0;

  for (const line of lines) {
    const amount = Math.max(0, Math.round(line.amount || 0));
    const defaults = defaultLaborMaterialPercent(
      line.category,
      Boolean(line.isBeliBaru),
    );
    let laborPercent = line.laborPercent ?? defaults.laborPercent;
    let materialPercent = line.materialPercent ?? defaults.materialPercent;
    // Normalisasi agar total 100 jika keduanya diisi
    const sum = laborPercent + materialPercent;
    if (sum > 0 && sum !== 100) {
      laborPercent = Math.round((laborPercent / sum) * 100);
      materialPercent = 100 - laborPercent;
    }
    const laborTarget = Math.round((amount * laborPercent) / 100);
    const materialTarget = amount - laborTarget;
    totalAmount += amount;
    totalLaborTarget += laborTarget;
    totalMaterialTarget += materialTarget;
    out.push({
      category: line.category,
      label: SPK_CATEGORY_LABELS[line.category],
      amount,
      laborPercent,
      materialPercent,
      laborTarget,
      materialTarget,
    });
  }

  return { lines: out, totalAmount, totalLaborTarget, totalMaterialTarget };
}

export type ActualSpend = {
  category?: SpkCategoryKey | null;
  laborAmount: number;
  materialAmount: number;
};

export type VarianceLine = SpkTargetLine & {
  laborActual: number;
  materialActual: number;
  laborVariance: number;
  materialVariance: number;
  status: "ok" | "warn" | "over";
};

/** Bandingkan realisasi vs target (±10% = warn, di atas target = over). */
export function compareActualVsTarget(
  targets: SpkTargetLine[],
  actuals: ActualSpend[],
): VarianceLine[] {
  const byCat = new Map<SpkCategoryKey, { labor: number; material: number }>();
  for (const a of actuals) {
    if (!a.category) continue;
    const cur = byCat.get(a.category) ?? { labor: 0, material: 0 };
    cur.labor += Math.max(0, a.laborAmount);
    cur.material += Math.max(0, a.materialAmount);
    byCat.set(a.category, cur);
  }

  return targets.map((t) => {
    const act = byCat.get(t.category) ?? { labor: 0, material: 0 };
    const laborVariance = act.labor - t.laborTarget;
    const materialVariance = act.material - t.materialTarget;
    const laborRatio =
      t.laborTarget > 0 ? act.labor / t.laborTarget : act.labor > 0 ? 2 : 0;
    const materialRatio =
      t.materialTarget > 0
        ? act.material / t.materialTarget
        : act.material > 0
          ? 2
          : 0;
    const maxRatio = Math.max(laborRatio, materialRatio);
    let status: VarianceLine["status"] = "ok";
    if (maxRatio > 1) status = "over";
    else if (maxRatio >= 0.9) status = "warn";
    return {
      ...t,
      laborActual: act.labor,
      materialActual: act.material,
      laborVariance,
      materialVariance,
      status,
    };
  });
}

/** Rencana pagu awal dari nilai SPK (semua kategori 0 sampai Admin isi). */
export function emptySpkBudgetFromContract(contractValue: number): SpkBudgetInput[] {
  void contractValue;
  return SPK_CATEGORIES.map((category) => {
    const { laborPercent, materialPercent } =
      defaultLaborMaterialPercent(category);
    return {
      category,
      amount: 0,
      laborPercent,
      materialPercent,
      isBeliBaru: false,
    };
  });
}

/** Kelompok tabel ringkasan SPK (mirip rekap LPJ A / B / C). */
export type SpkRingkasanSectionKey = "FISIK" | "MANAJEMEN" | "MEBELAIR";

export const SPK_RINGKASAN_SECTIONS: Array<{
  key: SpkRingkasanSectionKey;
  letter: "A" | "B" | "C";
  title: string;
  categories: SpkCategoryKey[];
}> = [
  {
    key: "FISIK",
    letter: "A",
    title: "PEKERJAAN FISIK",
    categories: [
      "REHAB_FISIK",
      "PEMBANGUNAN_BARU",
      "PEMBANGUNAN_APE_LUAR",
      "SANITASI",
      "PENGELOLAAN_LINGKUNGAN",
    ],
  },
  {
    key: "MANAJEMEN",
    letter: "B",
    title: "BIAYA MANAJEMEN",
    categories: ["PERENCANAAN", "PENGAWASAN", "PENGELOLAAN"],
  },
  {
    key: "MEBELAIR",
    letter: "C",
    title: "MEBELAIR",
    categories: ["REHAB_MEBELAIR", "MEBELAIR_BARU"],
  },
];

export type SpkRingkasanRow = {
  kind: "item" | "subtotal" | "total" | "rounded";
  label: string;
  amount: number;
  laborTarget?: number;
  materialTarget?: number;
  percentOfSpk?: number | null;
};

export type SpkRingkasanTable = {
  sections: Array<{
    letter: "A" | "B" | "C";
    title: string;
    rows: SpkRingkasanRow[];
    subtotal: number;
  }>;
  total: number;
  rounded: number;
  totalLaborTarget: number;
  totalMaterialTarget: number;
};

/** Susun baris tabel ringkasan dari pagu yang sudah tersimpan (amount > 0). */
export function buildSpkRingkasanTable(
  lines: SpkTargetLine[],
  contractValue: number,
): SpkRingkasanTable {
  const byCat = new Map(lines.map((l) => [l.category, l]));
  const sections: SpkRingkasanTable["sections"] = [];
  let total = 0;
  let totalLaborTarget = 0;
  let totalMaterialTarget = 0;

  for (const sec of SPK_RINGKASAN_SECTIONS) {
    const rows: SpkRingkasanRow[] = [];
    let subtotal = 0;
    for (const cat of sec.categories) {
      const line = byCat.get(cat);
      if (!line || line.amount <= 0) continue;
      const percentOfSpk =
        contractValue > 0
          ? Math.round((line.amount / contractValue) * 10000) / 100
          : null;
      const label =
        sec.key === "MANAJEMEN" && percentOfSpk != null
          ? `${line.label} (${percentOfSpk.toLocaleString("id-ID")}%)`
          : line.label;
      rows.push({
        kind: "item",
        label,
        amount: line.amount,
        laborTarget: line.laborTarget,
        materialTarget: line.materialTarget,
        percentOfSpk,
      });
      subtotal += line.amount;
      totalLaborTarget += line.laborTarget;
      totalMaterialTarget += line.materialTarget;
    }
    if (rows.length === 0) continue;
    rows.push({
      kind: "subtotal",
      label: `SUBTOTAL ${sec.letter} (${sec.title})`,
      amount: subtotal,
    });
    sections.push({
      letter: sec.letter,
      title: sec.title,
      rows,
      subtotal,
    });
    total += subtotal;
  }

  const rounded = Math.round(total / 1000) * 1000;
  return {
    sections,
    total,
    rounded,
    totalLaborTarget,
    totalMaterialTarget,
  };
}
