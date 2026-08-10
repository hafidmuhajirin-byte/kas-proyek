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
  ADMIN: "AdminOK",
  ADMIN_PROYEK: "Admin Proyek",
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

/** Hint mode pembayaran untuk proyek mandiri (kas terpisah). */
export const standaloneBillingModeHints: Record<string, string> = {
  ON_REQUEST:
    "Proyek mandiri: kas terpisah dari Owner. Saldo awal = dana di proyek ini saja.",
  TERMIN_PLAN:
    "Proyek mandiri: kas terpisah. Rencana termin hanya di buku proyek ini.",
  PAY_AT_END:
    "Proyek mandiri: tidak mengambil dari kas besar Owner. Danai dari saldo proyek.",
};

export { SPK_CATEGORY_LABELS as spkCategoryLabels } from "@/lib/lpj/smart-estimator";
