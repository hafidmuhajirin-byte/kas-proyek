import type { BktMonthBlock, BktRow } from "@/lib/buku-kas/bkt";

export type BkkVoucherLine = {
  status: string;
  quantity: number | null;
  unit: string | null;
  description: string;
  unitPrice: number | null;
  amount: number;
};

export type BkkVoucher = {
  proofNo: string;
  seq: number;
  date: Date;
  lines: BkkVoucherLine[];
  total: number;
};

function lineFromRow(row: BktRow): BkkVoucherLine {
  return {
    status: row.status,
    quantity: row.quantity,
    unit: row.unit,
    description: row.description,
    unitPrice: row.unitPrice,
    amount: row.expense,
  };
}

/** Kelompokkan baris BKT menjadi satu kuitansi per No. Bukti BKK.n */
export function buildBkkVouchersFromBkt(blocks: BktMonthBlock[]): BkkVoucher[] {
  const vouchers: BkkVoucher[] = [];
  let current: BkkVoucher | null = null;

  const flush = () => {
    if (current && current.lines.length > 0) {
      current.total = current.lines.reduce((s, l) => s + l.amount, 0);
      vouchers.push(current);
    }
    current = null;
  };

  for (const block of blocks) {
    for (const row of block.rows) {
      if (row.isTaxRow) {
        flush();
        continue;
      }
      const m = /^BKK\.(\d+)$/i.exec(row.proofNo.trim());
      if (m) {
        flush();
        const seq = Number(m[1]);
        current = {
          proofNo: `BKK.${seq}`,
          seq,
          date: row.date ?? block.periodStart,
          lines: [lineFromRow(row)],
          total: 0,
        };
        continue;
      }
      if (current && !row.proofNo.trim() && row.expense > 0) {
        current.lines.push(lineFromRow(row));
        if (row.date) current.date = row.date;
        continue;
      }
      flush();
    }
  }
  flush();

  return vouchers.sort((a, b) => a.seq - b.seq);
}

/** Terbilang rupiah sederhana (Indonesia). */
export function terbilangRupiah(n: number): string {
  const num = Math.round(Math.abs(n));
  if (num === 0) return "Nol rupiah";

  const satuan = [
    "",
    "satu",
    "dua",
    "tiga",
    "empat",
    "lima",
    "enam",
    "tujuh",
    "delapan",
    "sembilan",
    "sepuluh",
    "sebelas",
  ];

  function toWords(x: number): string {
    if (x < 12) return satuan[x] ?? "";
    if (x < 20) return `${satuan[x - 10]} belas`;
    if (x < 100) {
      const d = Math.floor(x / 10);
      const r = x % 10;
      return `${satuan[d]} puluh${r ? ` ${satuan[r]}` : ""}`.trim();
    }
    if (x < 200) return `seratus${x - 100 ? ` ${toWords(x - 100)}` : ""}`;
    if (x < 1000) {
      const d = Math.floor(x / 100);
      const r = x % 100;
      return `${satuan[d]} ratus${r ? ` ${toWords(r)}` : ""}`.trim();
    }
    if (x < 2000) return `seribu${x - 1000 ? ` ${toWords(x - 1000)}` : ""}`;
    if (x < 1_000_000) {
      const d = Math.floor(x / 1000);
      const r = x % 1000;
      return `${toWords(d)} ribu${r ? ` ${toWords(r)}` : ""}`.trim();
    }
    if (x < 1_000_000_000) {
      const d = Math.floor(x / 1_000_000);
      const r = x % 1_000_000;
      return `${toWords(d)} juta${r ? ` ${toWords(r)}` : ""}`.trim();
    }
    const d = Math.floor(x / 1_000_000_000);
    const r = x % 1_000_000_000;
    return `${toWords(d)} miliar${r ? ` ${toWords(r)}` : ""}`.trim();
  }

  const words = toWords(num).replace(/\s+/g, " ").trim();
  const titled = words
    .split(" ")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
  return `${titled} Rupiah`;
}
