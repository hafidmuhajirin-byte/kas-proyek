import { formatRupiah } from "@/lib/money";
import type { AssistantContext, AssistantProjectSnap } from "@/lib/assistant/context";
import type { AssistantGuard } from "@/lib/assistant/guards";
import {
  findMenusByQuery,
  helpForMenu,
} from "@/lib/assistant/catalog";
import {
  lpjSubmenusForRole,
  menusForRole,
} from "@/lib/nav/app-menus";
import type { SessionRole } from "@/lib/session";
import { roleLabels } from "@/lib/labels";

export type AssistantBlock =
  | { type: "stat"; label: string; value: string; hint?: string }
  | { type: "list"; items: string[] }
  | { type: "link"; href: string; label: string };

export type AssistantReply = {
  text: string;
  blocks: AssistantBlock[];
  /** Hint UI to open chat aggressively */
  urgent?: boolean;
};

export type EngineInput = {
  message: string;
  role: SessionRole;
  ctx: AssistantContext;
  guards: AssistantGuard[];
};

function findProject(
  ctx: AssistantContext,
  message: string,
): AssistantProjectSnap | null {
  const lower = message.toLowerCase();
  const active = ctx.projects.filter((p) => p.status === "ACTIVE");
  const pool = active.length ? active : ctx.projects;
  let best: AssistantProjectSnap | null = null;
  let bestScore = 0;
  for (const p of pool) {
    const name = p.name.toLowerCase();
    if (lower.includes(name) && name.length > bestScore) {
      best = p;
      bestScore = name.length;
    } else {
      const tokens = name.split(/\s+/).filter((t) => t.length > 2);
      const hits = tokens.filter((t) => lower.includes(t)).length;
      if (hits >= 2 && hits > bestScore) {
        best = p;
        bestScore = hits;
      }
    }
  }
  return best;
}

function replyFromGuards(
  guards: AssistantGuard[],
  opts?: { code?: AssistantGuard["code"]; limit?: number; title?: string },
): AssistantReply {
  let list = guards;
  if (opts?.code) list = list.filter((g) => g.code === opts.code);
  list = list.slice(0, opts?.limit ?? 8);
  if (list.length === 0) {
    return {
      text:
        opts?.title ??
        "Tidak ada peringatan mendesak dari data saat ini. Data terlihat terkendali — lanjutkan dengan cek plafon pajak berkala.",
      blocks: [{ type: "link", href: "/admin/lpj", label: "Proyek LPJ" }],
    };
  }
  const warnN = list.filter((g) => g.severity === "warn").length;
  const text =
    opts?.title ??
    (warnN > 0
      ? `Ada ${list.length} temuan (${warnN} perlu segera ditindak). Berikut yang salah dan apa yang harus dilakukan:`
      : `Ada ${list.length} saran agar data tetap benar dan kerja lebih cepat:`);
  const items = list.flatMap((g) => {
    const sols = g.solutions.map((s) => `   → ${s}`);
    return [`• ${g.title}: ${g.detail}`, ...sols];
  });
  const links = list
    .filter((g) => g.href)
    .slice(0, 4)
    .map((g) => ({
      type: "link" as const,
      href: g.href!,
      label: g.projectName ? `${g.code} · ${g.projectName}` : g.title,
    }));
  return {
    text,
    blocks: [{ type: "list", items }, ...links],
    urgent: warnN > 0,
  };
}

function replyMenus(role: SessionRole): AssistantReply {
  const menus = menusForRole(role);
  const lpj = lpjSubmenusForRole(role);
  const items = [
    ...menus.map((m) => `${m.label} → ${m.href}`),
    ...(lpj.length
      ? ["— Submenu LPJ (dalam proyek) —", ...lpj.map((m) => m.label)]
      : []),
  ];
  return {
    text: `Menu untuk role ${roleLabels[role] ?? role}. Teks cara pakai muncul jika Anda tanya “cara …” atau sebut nama menu.`,
    blocks: [
      { type: "list", items },
      ...menus.slice(0, 4).map((m) => ({
        type: "link" as const,
        href: m.href.startsWith("/") ? m.href : `/admin/lpj`,
        label: m.label,
      })),
    ],
  };
}

function replyHowTo(role: SessionRole, message: string): AssistantReply | null {
  const all = [...menusForRole(role), ...lpjSubmenusForRole(role)];
  const hits = findMenusByQuery(all, message);
  if (hits.length === 0) {
    // generic how-to without menu match
    if (!/cara|bagaimana|apa itu|kegunaan|tutorial|bantuan|langkah|alur|pakai/.test(message)) {
      return null;
    }
    return replyMenus(role);
  }
  const menu = hits[0]!;
  const help = helpForMenu(menu);
  const href = menu.href.startsWith("/")
    ? menu.href
    : `/admin/lpj`;
  return {
    text: `${menu.label}: ${help.summary}`,
    blocks: [
      { type: "list", items: help.howTo },
      { type: "link", href, label: `Buka ${menu.label}` },
    ],
  };
}

function replyKas(ctx: AssistantContext): AssistantReply {
  const { total, cash, bank } = ctx.kasBesar;
  return {
    text:
      total <= 0
        ? "Kas besar perlu perhatian. Setor dana pribadi dulu sebelum pengeluaran baru."
        : "Ini posisi kas besar saat ini.",
    blocks: [
      { type: "stat", label: "Kas besar", value: formatRupiah(total) },
      { type: "stat", label: "Tunai", value: formatRupiah(cash) },
      { type: "stat", label: "Bank", value: formatRupiah(bank) },
      { type: "link", href: "/dashboard", label: "Buka dashboard" },
    ],
  };
}

function replyReminders(ctx: AssistantContext, guards: AssistantGuard[]): AssistantReply {
  const fromGuards = replyFromGuards(guards, {
    limit: 6,
    title: "Pengingat & temuan dari data Anda:",
  });
  if (ctx.reminders.length === 0) return fromGuards;
  const items = [
    ...ctx.reminders.slice(0, 6).map((r) => r.text),
    ...((fromGuards.blocks.find((b) => b.type === "list") as { items: string[] } | undefined)
      ?.items ?? []),
  ].slice(0, 12);
  return {
    text: `Ada pengingat dari kas/proyek dan pantauan LPJ.`,
    blocks: [
      { type: "list", items },
      ...ctx.reminders
        .filter((r) => r.href)
        .slice(0, 2)
        .map((r) => ({ type: "link" as const, href: r.href!, label: "Lihat terkait" })),
    ],
    urgent: ctx.reminders.some((r) => r.severity === "warn") || fromGuards.urgent,
  };
}

function replyFee(ctx: AssistantContext, project: AssistantProjectSnap | null): AssistantReply {
  if (project) {
    return {
      text: `Fee ${ctx.feePercent}% untuk ${project.name}.`,
      blocks: [
        { type: "stat", label: "Target fee", value: formatRupiah(project.feeTarget) },
        { type: "stat", label: "Sudah ditransfer", value: formatRupiah(project.feeTransferred) },
        { type: "stat", label: "Sisa kuota", value: formatRupiah(project.feeRemaining) },
        { type: "link", href: `/projects/${project.id}`, label: "Buka proyek" },
      ],
    };
  }
  const active = ctx.projects.filter((p) => p.status === "ACTIVE");
  return {
    text: `Ringkasan fee ${ctx.feePercent}% proyek aktif.`,
    blocks: [
      {
        type: "list",
        items: active.map(
          (p) =>
            `${p.name}: sisa ${formatRupiah(p.feeRemaining)} dari ${formatRupiah(p.feeTarget)}`,
        ),
      },
      { type: "link", href: "/dashboard", label: "Dashboard" },
    ],
  };
}

function replyProfit(ctx: AssistantContext, project: AssistantProjectSnap | null): AssistantReply {
  if (project) {
    return {
      text: `Estimasi keuntungan ${project.name}.`,
      blocks: [
        { type: "stat", label: "Realisasi", value: formatRupiah(project.realizedProfit) },
        { type: "stat", label: "Proyeksi maks", value: formatRupiah(project.maxProjectedProfit) },
        { type: "link", href: `/projects/${project.id}`, label: "Detail proyek" },
      ],
    };
  }
  const active = ctx.projects.filter((p) => p.status === "ACTIVE");
  const realized = active.reduce((s, p) => s + p.realizedProfit, 0);
  return {
    text: "Gabungan keuntungan proyek aktif.",
    blocks: [
      { type: "stat", label: "Realisasi", value: formatRupiah(realized) },
      { type: "link", href: "/dashboard", label: "Buka dashboard" },
    ],
  };
}

function replyCritical(ctx: AssistantContext, guards: AssistantGuard[]): AssistantReply {
  const g = replyFromGuards(
    guards.filter((x) => x.severity === "warn"),
    { title: "Prioritas yang perlu perhatian:", limit: 8 },
  );
  if (g.blocks.length > 1 || (g.blocks[0] && g.blocks[0].type === "list" && (g.blocks[0] as { items: string[] }).items.length > 1)) {
    return g;
  }
  const active = ctx.projects.filter((p) => p.status === "ACTIVE");
  const ranked = [...active].sort((a, b) => {
    const score = (p: AssistantProjectSnap) =>
      (p.balance < 0 ? 100 : 0) +
      (p.receivable > 0 ? 40 : 0) +
      (p.checklistPercent < 50 ? 20 : 0);
    return score(b) - score(a);
  });
  return {
    text: "Proyek yang perlu perhatian:",
    blocks: [
      {
        type: "list",
        items: ranked.slice(0, 5).map(
          (p) =>
            `${p.name} — kas ${formatRupiah(p.balance)} · checklist ${p.checklistPercent}%`,
        ),
      },
    ],
  };
}

function replyProject(project: AssistantProjectSnap): AssistantReply {
  return {
    text: `Ringkasan ${project.name} (${project.location}).`,
    blocks: [
      { type: "stat", label: "Kas proyek", value: formatRupiah(project.balance) },
      { type: "stat", label: "Keuntungan realisasi", value: formatRupiah(project.realizedProfit) },
      { type: "stat", label: "Sisa fee", value: formatRupiah(project.feeRemaining) },
      {
        type: "stat",
        label: "Checklist",
        value: `${project.checklistDone}/${project.checklistTotal}`,
        hint: `${project.checklistPercent}%`,
      },
      { type: "link", href: `/projects/${project.id}`, label: "Buka detail" },
    ],
  };
}

function replyRecent(ctx: AssistantContext): AssistantReply {
  if (ctx.recentTransactions.length === 0) {
    return { text: "Belum ada transaksi.", blocks: [] };
  }
  return {
    text: "Transaksi terbaru:",
    blocks: [
      {
        type: "list",
        items: ctx.recentTransactions.map((tx) => {
          const sign = tx.type === "INCOME" ? "+" : "−";
          return `${tx.projectName}: ${sign}${formatRupiah(tx.amount)} — ${tx.description}`;
        }),
      },
      { type: "link", href: "/transactions", label: "Semua transaksi" },
    ],
  };
}

function replyFaster(guards: AssistantGuard[]): AssistantReply {
  const tips = guards.filter((g) => g.code === "FASTER_WORKFLOW");
  const work = replyFromGuards(guards, {
    limit: 6,
    title: "Evaluasi kerja: lakukan ini agar lebih cepat dan data tetap benar:",
  });
  if (tips.length) {
    return replyFromGuards(tips, {
      title: "Saran cara kerja lebih cepat:",
      limit: 5,
    });
  }
  return work;
}

function replyHelp(role: SessionRole): AssistantReply {
  const isAdminOk = role === "ADMIN" || role === "OWNER";
  return {
    text: `Saya Asisten Kas untuk ${roleLabels[role] ?? role} — baca data lokal, pantau kesalahan, dan saran perbaikan. Coba:`,
    blocks: [
      {
        type: "list",
        items: isAdminOk
          ? [
              "Prioritas hari ini / pengingat",
              "Nota menunggu approve?",
              "Pajak berlebih? / split",
              "Proyek tanpa foto?",
              "Cara lebih cepat?",
              "Menu saya / cara pakai Nota",
              "Kas besar / fee / keuntungan (Owner)",
            ]
          : [
              "Menu saya",
              "Cara upload nota / foto",
              "Pengingat",
              "Bantuan",
            ],
      },
    ],
  };
}

export function suggestionsForRole(role: SessionRole): string[] {
  if (role === "ADMIN") {
    return [
      "Prioritas hari ini",
      "Nota menunggu approve?",
      "Pajak berlebih?",
      "Proyek tanpa foto?",
      "Cara lebih cepat?",
      "Menu saya",
    ];
  }
  if (role === "OWNER") {
    return [
      "Pengingat hari ini",
      "Kas besar?",
      "Prioritas LPJ",
      "Fee tersisa?",
      "Cara lebih cepat?",
      "Menu saya",
    ];
  }
  if (role === "MANDOR") {
    return ["Cara upload nota?", "Menu saya", "Cara foto lokasi?"];
  }
  if (role === "ADM_FOTO") {
    return ["Cara foto lokasi?", "Menu saya"];
  }
  if (role === "LPJ_VIEWER" || role === "ADMIN_PROYEK") {
    return [
      "Menu saya",
      "Cara pakai Pajak?",
      "Cara cetak BKK?",
      "Pengingat",
    ];
  }
  return ["Menu saya", "Bantuan"];
}

export function welcomeForRole(role: SessionRole): string {
  if (role === "ADMIN") {
    return "Saya Asisten AdminOK — memantau nota, split, pajak, dan foto dari data yang sudah ada. Kalau ada yang salah, saya buka chat dengan penyebab + langkah perbaikan.";
  }
  if (role === "OWNER") {
    return "Saya Asisten Kas — pengingat kas/fee dan pantauan LPJ. Tanya menu, pengingat, atau prioritas kerja.";
  }
  return `Saya Asisten Kas untuk ${roleLabels[role] ?? role}. Tanya “menu saya” atau “cara …” untuk panduan fitur.`;
}

export function localReplyEngine(input: EngineInput): AssistantReply {
  const { message, role, ctx, guards } = input;
  const q = message.trim().toLowerCase();
  if (!q) return replyHelp(role);

  const project = findProject(ctx, message);
  const canOwnerData = role === "OWNER";
  const canLpjGuards =
    role === "ADMIN" ||
    role === "OWNER" ||
    role === "ADMIN_PROYEK" ||
    role === "LPJ_VIEWER";

  // Unit inconsistency from form / chat
  if (
    q.startsWith("unit-check:") ||
    /satuan.*(beda|tidak|inkonsisten)|sebelumnya.*satuan/.test(q)
  ) {
    const unitGuards = guards.filter((g) => g.code === "UNIT_INCONSISTENT");
    if (unitGuards.length) {
      return replyFromGuards(unitGuards, {
        title: "Satuan tidak konsisten dengan riwayat:",
      });
    }
  }

  if (
    /prioritas|hari ini|kerjaan saya|yang salah|temuan|evaluasi/.test(q)
  ) {
    return canLpjGuards
      ? replyFromGuards(guards, {
          title: "Prioritas dari data Anda (salah dulu, lalu saran cepat):",
          limit: 10,
        })
      : replyReminders(ctx, guards);
  }

  if (/lebih cepat|cara cepat|efisien|percepat/.test(q)) {
    return replyFaster(guards);
  }

  if (
    /setujui|approve|menunggu approve|siap setujui|pending.*nota|nota.*pending/.test(
      q,
    )
  ) {
    return replyFromGuards(guards, { code: "NOTA_READY_APPROVE" });
  }

  if (/split|selisih|tidak sama|≠|berlebih.*nota|total.*nota/.test(q)) {
    const m = replyFromGuards(guards, { code: "SPLIT_TOTAL_MISMATCH" });
    if (m.text.includes("Tidak ada")) {
      return replyFromGuards(guards, { code: "TAX_OVER_SPLIT" });
    }
    return m;
  }

  if (
    /pajak berlebih|plafon pajak/.test(q) ||
    (/pajak|plafon|ppn|pph/.test(q) &&
      /berlebih|melebih|split|plafon|peringatan/.test(q))
  ) {
    return replyFromGuards(guards, { code: "TAX_OVER_SPLIT" });
  }

  if (/tanpa foto|belum.*foto|foto bukti|foto (kerja|pekerjaan|lokasi)/.test(q)) {
    const a = replyFromGuards(guards, { code: "MANDOR_NO_PROOF", limit: 5 });
    const b = replyFromGuards(guards, { code: "MANDOR_NO_SITE_PHOTO", limit: 5 });
    const items = [
      ...(((a.blocks[0] as { items?: string[] })?.items) ?? []),
      ...(((b.blocks[0] as { items?: string[] })?.items) ?? []),
    ];
    if (!items.length) {
      return {
        text: "Semua proyek aktif yang dipantau sudah punya indikasi bukti/foto, atau belum ada aktivitas Mandor.",
        blocks: [{ type: "link", href: "/foto-proyek", label: "Foto Proyek" }],
      };
    }
    return {
      text: "Proyek yang perlu foto:",
      blocks: [
        { type: "list", items },
        { type: "link", href: "/foto-proyek", label: "Foto Proyek" },
      ],
      urgent: true,
    };
  }

  if (/sisa spk|spk belum|nota admin|habiskan spk/.test(q)) {
    return replyFromGuards(guards, { code: "SPK_REMAINING" });
  }

  if (/menu saya|daftar (menu|fitur)|fitur saya|apa saja menu/.test(q)) {
    return replyMenus(role);
  }

  const how = replyHowTo(role, q);
  if (how) return how;

  if (/pengingat|ingat|reminder|peringatan/.test(q)) {
    return replyReminders(ctx, guards);
  }

  if (canOwnerData) {
    if (/kas besar|saldo kas|tunai|bank\b|berapa kas/.test(q) && !/fee|transfer fee/.test(q)) {
      return replyKas(ctx);
    }
    if (/fee|kuota fee|transfer fee|bank pribadi/.test(q)) {
      return replyFee(ctx, project);
    }
    if (/untung|keuntungan|laba|margin|proyeksi/.test(q)) {
      return replyProfit(ctx, project);
    }
    if (/transaksi|riwayat|terbaru|baru saja/.test(q)) {
      return replyRecent(ctx);
    }
  }

  if (/kritis|perhatian|masalah|risiko|prioritas/.test(q)) {
    return replyCritical(ctx, guards);
  }

  if (project && canOwnerData && (/tampil|ringkas|proyek|detail|status|checklist/.test(q) || q.includes(project.name.toLowerCase()))) {
    return replyProject(project);
  }

  if (/bantu|help|perintah|bisa apa/.test(q)) {
    return replyHelp(role);
  }

  // Default: surface live guards for AdminOK, else help
  if (canLpjGuards && guards.some((g) => g.severity === "warn")) {
    return replyFromGuards(guards.filter((g) => g.severity === "warn"), {
      title: "Saya temukan isu dari data Anda. Perbaiki ini dulu:",
      limit: 6,
    });
  }

  return replyHelp(role);
}

/** Preset reply when form detects unit inconsistency — open chat immediately. */
export function replyUnitInconsistency(message: string): AssistantReply {
  return {
    text: message,
    blocks: [
      {
        type: "list",
        items: [
          "→ Samakan satuan dengan riwayat agar LPJ konsisten.",
          "→ Atau bedakan nama bahan (mis. Besi 6 vs Besi 10) jika memang jenis lain.",
        ],
      },
    ],
    urgent: true,
  };
}
