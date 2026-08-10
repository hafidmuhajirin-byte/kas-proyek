export const cashSourceTypeLabels: Record<string, string> = {
  BANK: "Bank",
  CASH: "Tunai",
  CLIENT_TRANSFER: "Transfer Klien",
  OTHER: "Lainnya",
};

export const categoryTypeLabels: Record<string, string> = {
  INCOME: "Pemasukan",
  EXPENSE: "Pengeluaran",
};

export const projectStatusLabels: Record<string, string> = {
  ACTIVE: "Aktif",
  COMPLETED: "Selesai",
};

export const roleLabels: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MANDOR: "Mandor",
  ADM_FOTO: "ADM Foto",
};

export const fundingStatusLabels: Record<string, string> = {
  BELUM: "Belum cair",
  SEBAGIAN: "Sebagian",
  LUNAS: "Lunas",
  LEBIH: "Lebih dari rencana",
};

export const billingModeLabels: Record<string, string> = {
  ON_REQUEST: "Bayar sesuai permintaan",
  TERMIN_PLAN: "Ada rencana termin",
  PAY_AT_END: "Kerja dulu, bayar di akhir",
};

export const billingModeHints: Record<string, string> = {
  ON_REQUEST:
    "Pembayaran bebas sesuai permintaan. Saldo awal opsional; tanpa dana awal ambil dari kas besar.",
  TERMIN_PLAN:
    "Ada acuan DP/Termin. Saldo awal opsional; tanpa dana awal ambil dari kas besar.",
  PAY_AT_END:
    "Tanpa kontrak. Pengeluaran dari kas besar; jika habis wajib setor dana pribadi. Bayar di akhir dari pekerjaan selesai.",
};

export { SPK_CATEGORY_LABELS as spkCategoryLabels } from "@/lib/lpj/smart-estimator";
