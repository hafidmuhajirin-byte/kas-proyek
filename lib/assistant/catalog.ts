import { APP_MENUS, type AppMenuItem } from "@/lib/nav/app-menus";

export type MenuHelp = {
  summary: string;
  howTo: string[];
};

/** Help text keyed by menu id — must cover every APP_MENUS entry. */
export const MENU_HELP = {
  "owner-dashboard": {
    summary: "Ringkasan kas, fee, dan status proyek Owner.",
    howTo: [
      "Buka Dashboard untuk lihat kas besar dan proyek kritis.",
      "Pakai Asisten: tanya “pengingat” atau “kas besar”.",
    ],
  },
  "owner-adminok": {
    summary: "Pintasan Owner ke modul LPJ (AdminOK).",
    howTo: [
      "Masuk AdminOK untuk pantau LPJ semua proyek.",
      "Alur LPJ: SPK → Bank → Nota → Absen → Pajak → Cetak.",
    ],
  },
  "owner-projects": {
    summary: "Daftar dan detail proyek kas Owner.",
    howTo: [
      "Buat/atur proyek, checklist, fee, dan assign Mandor.",
      "Dari detail proyek bisa buka kas dan keuntungan.",
    ],
  },
  "owner-foto": {
    summary: "Arsip foto lokasi/pekerjaan per proyek.",
    howTo: ["Filter proyek lalu unduh atau tinjau foto yang diunggah Mandor/ADM Foto."],
  },
  "owner-kas-besar": {
    summary: "Mutasi kas besar Owner (tunai/bank).",
    howTo: [
      "Catat pemasukan/pengeluaran kas besar di sini.",
      "Pisahkan dari Kas Proyek agar buku tidak tercampur.",
    ],
  },
  "owner-kas-proyek": {
    summary: "Mutasi kas per proyek.",
    howTo: ["Pilih konteks proyek lalu catat transaksi proyek."],
  },
  "owner-reports": {
    summary: "Laporan dan ekspor.",
    howTo: ["Unduh/lihat rekap dari menu Laporan."],
  },
  "owner-users": {
    summary: "Kelola pengguna dan assign proyek.",
    howTo: [
      "Buat Mandor / Admin Proyek / LPJ Proyek / ADM Foto.",
      "Assign proyek agar mereka hanya melihat yang ditugaskan.",
    ],
  },
  "owner-sources": {
    summary: "Sumber kas (bank/tunai).",
    howTo: ["Tambah atau ubah sumber kas yang dipakai transaksi."],
  },
  "owner-transfers": {
    summary: "Transfer antar sumber kas.",
    howTo: ["Catat perpindahan tunai ↔ bank di menu Transfer."],
  },
  "owner-categories": {
    summary: "Kategori pemasukan/pengeluaran.",
    howTo: ["Kelola kategori agar laporan konsisten."],
  },
  "admin-lpj": {
    summary: "Daftar proyek LPJ untuk AdminOK.",
    howTo: [
      "Pilih proyek → kerjakan urutan SPK, Bank, Nota, Absen, Pajak, Cetak.",
      "Di Review Nota: pecah isi → split jika perlu → Setujui bila total sudah pas.",
    ],
  },
  "admin-foto": {
    summary: "Foto proyek dari sisi AdminOK.",
    howTo: ["Pantau foto lokasi yang diunggah Mandor/ADM Foto."],
  },
  "ap-home": {
    summary: "Beranda Admin Proyek (proyek mandiri).",
    howTo: ["Lihat proyek yang di-assign, lalu buka LPJ atau Kas Proyek."],
  },
  "ap-lpj": {
    summary: "LPJ untuk proyek yang di-assign.",
    howTo: ["Sama seperti AdminOK tetapi terbatas proyek Anda."],
  },
  "ap-kas": {
    summary: "Kas proyek mandiri.",
    howTo: ["Catat transaksi kas proyek dari menu ini."],
  },
  "ap-foto": {
    summary: "Foto proyek Anda.",
    howTo: ["Tinjau foto lokasi proyek assigned."],
  },
  "lv-lpj": {
    summary: "Akses LPJ terbatas (LPJ Proyek).",
    howTo: [
      "Buka Bank, Absen, Pajak, Laporan LPJ (edit terbatas Bank/Pajak).",
      "Absen hanya baca.",
    ],
  },
  "lv-foto": {
    summary: "Foto proyek untuk LPJ Proyek.",
    howTo: ["Lihat foto lokasi proyek yang di-assign."],
  },
  "mandor-home": {
    summary: "Beranda Mandor: dana dan estimasi borongan.",
    howTo: ["Cek dana cair, estimasi, lalu lanjut Upload bukti atau Foto."],
  },
  "mandor-upload": {
    summary: "Unggah bukti/nota belanja.",
    howTo: [
      "Foto nota jelas, isi nominal, kirim.",
      "Jika ditolak Admin, ganti bukti dari notifikasi.",
    ],
  },
  "mandor-foto": {
    summary: "Foto pekerjaan/lokasi di lapangan.",
    howTo: ["Ambil foto progres pekerjaan per proyek assigned."],
  },
  "admfoto-home": {
    summary: "Khusus ADM Foto: unggah/lihat foto lokasi.",
    howTo: ["Pilih proyek lalu unggah foto pekerjaan."],
  },
  "lpj-spk": {
    summary: "Pecah nilai kontrak ke pagu SPK.",
    howTo: [
      "Isi baris pagu (fisik, jasa, pengelolaan, dll.).",
      "Pastikan total mendekati nilai kontrak sebelum lanjut Bank/Nota.",
    ],
  },
  "lpj-bank": {
    summary: "Pencairan 70%/30% dan Buku Bank.",
    howTo: [
      "Catat cair tahap 70% lalu 30%.",
      "Pantau pengambilan agar tidak melebihi dana cair.",
    ],
  },
  "lpj-nota": {
    summary: "Review, pecah, split, dan setujui nota Mandor.",
    howTo: [
      "Pecah isi bahan/upah sampai total = nominal BKK.",
      "Nota besar: Split Nota bila perlu, lalu pecah tiap BKK.",
      "Jika total sudah pas → wajib Setujui (Approve).",
      "Pajak/plafon berlebih → split lagi agar beban pajak tersebar.",
    ],
  },
  "lpj-absen": {
    summary: "Daftar hadir dan rekap gaji mingguan.",
    howTo: ["Isi/acak kehadiran, cetak daftar hadir atau rekap."],
  },
  "lpj-pajak": {
    summary: "Plafon 3,5% SPK dan rekap PPN/PPh.",
    howTo: [
      "Pantau progress plafon setiap selesai nota.",
      "Bayar kewajiban pajak dari panel terhutang bila ada.",
    ],
  },
  "lpj-export": {
    summary: "Cetak Buku Bank, BKU, BKT, kuitansi BKK.",
    howTo: [
      "Cetak per buku (landscape) atau Kuitansi BKK (potret, Prev/Next).",
      "Centang sisip TTD/stempel sebelum cetak bila perlu.",
    ],
  },
} as const satisfies Record<(typeof APP_MENUS)[number]["id"], MenuHelp>;

/** Compile-time-ish runtime check: every menu has help. */
export function assertMenuHelpComplete(): void {
  for (const m of APP_MENUS) {
    if (!(m.id in MENU_HELP)) {
      throw new Error(`Asisten: menu ${m.id} belum punya help di catalog`);
    }
  }
}

export function helpForMenu(menu: AppMenuItem): MenuHelp {
  return MENU_HELP[menu.id as keyof typeof MENU_HELP];
}

export function findMenusByQuery(
  menus: AppMenuItem[],
  query: string,
): AppMenuItem[] {
  const q = query.toLowerCase();
  return menus.filter((m) => {
    if (m.label.toLowerCase().includes(q)) return true;
    if (m.href.toLowerCase().includes(q)) return true;
    return m.keywords.some((k) => q.includes(k) || k.includes(q));
  });
}
