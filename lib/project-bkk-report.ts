import { formatRupiah } from "@/lib/money";

/** Baris laporan proyek format BKK / spreadsheet lapangan. */
export type BkkReportRow = {
  id: string;
  date: Date;
  /** Mis. BKK.1, BKM.1, TRM.1 */
  buktiNo: string;
  /** Terima | Beli | Bayar | Termin | Keluar | … */
  status: string;
  quantity: number | null;
  unit: string | null;
  keterangan: string;
  unitPrice: number | null;
  penerimaan: number;
  pengeluaran: number;
  /** Tidak mengubah saldo kas (rincian bukti Mandor). */
  skipBalance?: boolean;
};

export function buildBkkRunningBalance(
  rows: BkkReportRow[],
  opening = 0,
): Array<BkkReportRow & { saldoDebet: number; saldoKredit: number }> {
  const sorted = [...rows].sort(
    (a, b) =>
      a.date.getTime() - b.date.getTime() || a.id.localeCompare(b.id),
  );
  let balance = opening;
  return sorted.map((row) => {
    if (!row.skipBalance) {
      balance += row.penerimaan - row.pengeluaran;
    }
    return {
      ...row,
      saldoDebet: balance >= 0 ? balance : 0,
      saldoKredit: balance < 0 ? Math.abs(balance) : 0,
    };
  });
}

export function sumBkkCash(rows: BkkReportRow[]) {
  return rows.reduce(
    (acc, r) => {
      if (r.skipBalance) return acc;
      return {
        penerimaan: acc.penerimaan + r.penerimaan,
        pengeluaran: acc.pengeluaran + r.pengeluaran,
      };
    },
    { penerimaan: 0, pengeluaran: 0 },
  );
}

export function formatQty(qty: number | null) {
  if (qty == null) return "—";
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(Math.round(qty));
}

export function formatUnitPrice(price: number | null) {
  if (price == null || price <= 0) return "—";
  return `@ ${formatRupiah(price)}`;
}

/** Pecah lokasi "KEC - KAB" / "KOTA, PROV" menjadi bagian header. */
export function parseProjectLocation(location: string) {
  const raw = location.trim();
  if (!raw) {
    return { alamat: "—", kecamatan: "—", kabupaten: "—", propinsi: "—" };
  }
  const dash = raw.split(/\s*[-–—]\s*/);
  if (dash.length >= 2) {
    return {
      alamat: raw,
      kecamatan: dash[0]?.trim() || "—",
      kabupaten: dash[1]?.trim() || "—",
      propinsi: dash[2]?.trim() || "JAWA TIMUR",
    };
  }
  const comma = raw.split(/\s*,\s*/);
  if (comma.length >= 2) {
    return {
      alamat: raw,
      kecamatan: comma[0]?.trim() || "—",
      kabupaten: comma[1]?.trim() || "—",
      propinsi: comma[2]?.trim() || "JAWA TIMUR",
    };
  }
  return {
    alamat: raw,
    kecamatan: "—",
    kabupaten: raw,
    propinsi: "JAWA TIMUR",
  };
}
