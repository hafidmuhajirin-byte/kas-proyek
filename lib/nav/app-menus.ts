import type { SessionRole } from "@/lib/session";

export type AppMenuItem = {
  id: string;
  href: string;
  label: string;
  short?: string;
  /** Roles that see this menu */
  roles: SessionRole[];
  /** Parent menu id for LPJ submenu etc. */
  parentId?: string;
  keywords: string[];
  /** Secondary/settings nav (Owner) */
  group?: "primary" | "secondary" | "mobile" | "lpj" | "mandor";
};

/**
 * Single source of truth for all app menus.
 * Shells + Asisten must use this — do not hardcode parallel lists.
 */
export const APP_MENUS: AppMenuItem[] = [
  // ——— OWNER ———
  {
    id: "owner-dashboard",
    href: "/dashboard",
    label: "Dashboard",
    short: "Home",
    roles: ["OWNER"],
    keywords: ["dashboard", "home", "ringkasan"],
    group: "primary",
  },
  {
    id: "owner-adminok",
    href: "/admin/lpj",
    label: "AdminOK",
    short: "Admin",
    roles: ["OWNER"],
    keywords: ["adminok", "lpj", "admin"],
    group: "primary",
  },
  {
    id: "owner-projects",
    href: "/projects",
    label: "Proyek",
    short: "Proyek",
    roles: ["OWNER"],
    keywords: ["proyek", "project"],
    group: "primary",
  },
  {
    id: "owner-foto",
    href: "/foto-proyek",
    label: "Foto Proyek",
    short: "Foto",
    roles: ["OWNER"],
    keywords: ["foto", "lokasi"],
    group: "primary",
  },
  {
    id: "owner-kas-besar",
    href: "/transactions",
    label: "Kas Besar",
    short: "Besar",
    roles: ["OWNER"],
    keywords: ["kas besar", "transaksi", "tunai", "bank"],
    group: "primary",
  },
  {
    id: "owner-kas-proyek",
    href: "/transactions/project",
    label: "Kas Proyek",
    short: "Proyek",
    roles: ["OWNER"],
    keywords: ["kas proyek"],
    group: "primary",
  },
  {
    id: "owner-reports",
    href: "/reports",
    label: "Laporan",
    short: "Lapor",
    roles: ["OWNER"],
    keywords: ["laporan", "export"],
    group: "primary",
  },
  {
    id: "owner-users",
    href: "/users",
    label: "Pengguna",
    roles: ["OWNER"],
    keywords: ["pengguna", "user", "mandor", "assign"],
    group: "secondary",
  },
  {
    id: "owner-sources",
    href: "/sources",
    label: "Sumber Kas",
    roles: ["OWNER"],
    keywords: ["sumber kas"],
    group: "secondary",
  },
  {
    id: "owner-transfers",
    href: "/transfers",
    label: "Transfer Kas",
    roles: ["OWNER"],
    keywords: ["transfer"],
    group: "secondary",
  },
  {
    id: "owner-categories",
    href: "/categories",
    label: "Kategori",
    roles: ["OWNER"],
    keywords: ["kategori"],
    group: "secondary",
  },

  // ——— ADMIN (AdminOK) ———
  {
    id: "admin-lpj",
    href: "/admin/lpj",
    label: "Proyek LPJ",
    short: "LPJ",
    roles: ["ADMIN"],
    keywords: ["lpj", "proyek", "adminok"],
    group: "primary",
  },
  {
    id: "admin-foto",
    href: "/foto-proyek",
    label: "Foto Proyek",
    short: "Foto",
    roles: ["ADMIN"],
    keywords: ["foto"],
    group: "primary",
  },

  // ——— ADMIN_PROYEK ———
  {
    id: "ap-home",
    href: "/admin-proyek",
    label: "Proyek Saya",
    short: "Proyek",
    roles: ["ADMIN_PROYEK"],
    keywords: ["proyek saya"],
    group: "primary",
  },
  {
    id: "ap-lpj",
    href: "/admin/lpj",
    label: "LPJ",
    short: "LPJ",
    roles: ["ADMIN_PROYEK"],
    keywords: ["lpj"],
    group: "primary",
  },
  {
    id: "ap-kas",
    href: "/transactions/project",
    label: "Kas Proyek",
    short: "Kas",
    roles: ["ADMIN_PROYEK"],
    keywords: ["kas proyek"],
    group: "primary",
  },
  {
    id: "ap-foto",
    href: "/foto-proyek",
    label: "Foto Proyek",
    short: "Foto",
    roles: ["ADMIN_PROYEK"],
    keywords: ["foto"],
    group: "primary",
  },

  // ——— LPJ_VIEWER ———
  {
    id: "lv-lpj",
    href: "/admin/lpj",
    label: "LPJ",
    short: "LPJ",
    roles: ["LPJ_VIEWER"],
    keywords: ["lpj"],
    group: "primary",
  },
  {
    id: "lv-foto",
    href: "/foto-proyek",
    label: "Foto Proyek",
    short: "Foto",
    roles: ["LPJ_VIEWER"],
    keywords: ["foto"],
    group: "primary",
  },

  // ——— MANDOR ———
  {
    id: "mandor-home",
    href: "/mandor",
    label: "Beranda",
    short: "Home",
    roles: ["MANDOR"],
    keywords: ["beranda", "dana", "borongan"],
    group: "mandor",
  },
  {
    id: "mandor-upload",
    href: "/mandor/upload",
    label: "Upload",
    short: "Upload",
    roles: ["MANDOR"],
    keywords: ["upload", "bukti", "nota"],
    group: "mandor",
  },
  {
    id: "mandor-foto",
    href: "/mandor/lokasi",
    label: "Foto Proyek",
    short: "Foto",
    roles: ["MANDOR"],
    keywords: ["foto", "lokasi"],
    group: "mandor",
  },

  // ——— ADM_FOTO ———
  {
    id: "admfoto-home",
    href: "/mandor/lokasi",
    label: "Home",
    short: "Home",
    roles: ["ADM_FOTO"],
    keywords: ["foto", "lokasi", "home"],
    group: "mandor",
  },

  // ——— LPJ project submenu (all LPJ-capable roles) ———
  {
    id: "lpj-spk",
    href: "spk",
    label: "Ringkasan SPK",
    parentId: "lpj-project",
    roles: ["OWNER", "ADMIN", "ADMIN_PROYEK", "LPJ_VIEWER"],
    keywords: ["spk", "pagu", "kontrak"],
    group: "lpj",
  },
  {
    id: "lpj-bank",
    href: "bank",
    label: "Pencairan & Buku Bank",
    parentId: "lpj-project",
    roles: ["OWNER", "ADMIN", "ADMIN_PROYEK", "LPJ_VIEWER"],
    keywords: ["bank", "pencairan", "70", "30"],
    group: "lpj",
  },
  {
    id: "lpj-nota",
    href: "nota",
    label: "Review Nota Mandor",
    parentId: "lpj-project",
    roles: ["OWNER", "ADMIN", "ADMIN_PROYEK"],
    keywords: ["nota", "pecah", "split", "setujui", "approve"],
    group: "lpj",
  },
  {
    id: "lpj-absen",
    href: "absen",
    label: "Absen & Rekap Gaji",
    parentId: "lpj-project",
    roles: ["OWNER", "ADMIN", "ADMIN_PROYEK", "LPJ_VIEWER"],
    keywords: ["absen", "gaji", "hok"],
    group: "lpj",
  },
  {
    id: "lpj-pajak",
    href: "pajak",
    label: "Pajak",
    parentId: "lpj-project",
    roles: ["OWNER", "ADMIN", "ADMIN_PROYEK", "LPJ_VIEWER"],
    keywords: ["pajak", "ppn", "pph", "plafon"],
    group: "lpj",
  },
  {
    id: "lpj-export",
    href: "export",
    label: "Laporan LPJ",
    parentId: "lpj-project",
    roles: ["OWNER", "ADMIN", "ADMIN_PROYEK", "LPJ_VIEWER"],
    keywords: ["laporan", "cetak", "bku", "bkt", "bkk", "export"],
    group: "lpj",
  },
];

export function menusForRole(role: SessionRole): AppMenuItem[] {
  return APP_MENUS.filter(
    (m) => m.roles.includes(role) && m.group !== "lpj",
  );
}

export function primaryMenusForRole(role: SessionRole): AppMenuItem[] {
  return menusForRole(role).filter(
    (m) => m.group === "primary" || m.group === "mandor",
  );
}

export function secondaryMenusForRole(role: SessionRole): AppMenuItem[] {
  return menusForRole(role).filter((m) => m.group === "secondary");
}

export function lpjSubmenusForRole(role: SessionRole): AppMenuItem[] {
  return APP_MENUS.filter(
    (m) => m.group === "lpj" && m.roles.includes(role),
  );
}

export function ownerMobileMenus(): AppMenuItem[] {
  const ids = [
    "owner-dashboard",
    "owner-projects",
    "owner-foto",
    "owner-kas-besar",
    "owner-reports",
  ];
  return APP_MENUS.filter((m) => ids.includes(m.id));
}
