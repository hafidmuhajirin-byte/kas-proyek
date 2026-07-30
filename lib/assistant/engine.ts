import { formatRupiah } from "@/lib/money";
import type { AssistantContext, AssistantProjectSnap } from "@/lib/assistant/context";

export type AssistantBlock =
  | { type: "stat"; label: string; value: string; hint?: string }
  | { type: "list"; items: string[] }
  | { type: "link"; href: string; label: string };

export type AssistantReply = {
  text: string;
  blocks: AssistantBlock[];
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

function replyReminders(ctx: AssistantContext): AssistantReply {
  if (ctx.reminders.length === 0) {
    return {
      text: "Tidak ada pengingat mendesak hari ini. Kas dan proyek terlihat terkendali.",
      blocks: [{ type: "link", href: "/dashboard", label: "Ke dashboard" }],
    };
  }
  return {
    text: `Ada ${ctx.reminders.length} pengingat untuk Anda.`,
    blocks: [
      {
        type: "list",
        items: ctx.reminders.slice(0, 8).map((r) => r.text),
      },
      ...ctx.reminders
        .filter((r) => r.href)
        .slice(0, 3)
        .map((r) => ({
          type: "link" as const,
          href: r.href!,
          label: "Lihat terkait",
        })),
    ],
  };
}

function replyFee(ctx: AssistantContext, project: AssistantProjectSnap | null): AssistantReply {
  if (project) {
    return {
      text: `Fee ${ctx.feePercent}% untuk ${project.name}.`,
      blocks: [
        {
          type: "stat",
          label: "Target fee",
          value: formatRupiah(project.feeTarget),
        },
        {
          type: "stat",
          label: "Sudah ditransfer",
          value: formatRupiah(project.feeTransferred),
        },
        {
          type: "stat",
          label: "Sisa kuota",
          value: formatRupiah(project.feeRemaining),
        },
        {
          type: "link",
          href: `/projects/${project.id}`,
          label: "Buka proyek",
        },
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
      { type: "link", href: "/dashboard", label: "Dashboard keuntungan" },
    ],
  };
}

function replyProfit(ctx: AssistantContext, project: AssistantProjectSnap | null): AssistantReply {
  if (project) {
    return {
      text: `Estimasi keuntungan ${project.name}.`,
      blocks: [
        {
          type: "stat",
          label: "Realisasi",
          value: formatRupiah(project.realizedProfit),
        },
        {
          type: "stat",
          label: "Proyeksi maks",
          value: formatRupiah(project.maxProjectedProfit),
        },
        {
          type: "stat",
          label: `Target fee ${ctx.feePercent}%`,
          value: formatRupiah(project.feeTarget),
        },
        {
          type: "link",
          href: `/projects/${project.id}`,
          label: "Detail proyek",
        },
      ],
    };
  }
  const active = ctx.projects.filter((p) => p.status === "ACTIVE");
  const realized = active.reduce((s, p) => s + p.realizedProfit, 0);
  const max = active.reduce((s, p) => s + p.maxProjectedProfit, 0);
  const fee = active.reduce((s, p) => s + p.feeTarget, 0);
  return {
    text: "Gabungan keuntungan proyek aktif.",
    blocks: [
      { type: "stat", label: "Realisasi", value: formatRupiah(realized) },
      { type: "stat", label: "Proyeksi maks", value: formatRupiah(max) },
      { type: "stat", label: "Target fee", value: formatRupiah(fee) },
      { type: "link", href: "/dashboard", label: "Buka dashboard" },
    ],
  };
}

function replyCritical(ctx: AssistantContext): AssistantReply {
  const active = ctx.projects.filter((p) => p.status === "ACTIVE");
  const ranked = [...active].sort((a, b) => {
    const score = (p: AssistantProjectSnap) =>
      (p.balance < 0 ? 100 : 0) +
      (p.receivable > 0 ? 40 : 0) +
      (p.checklistPercent < 50 ? 20 : 0) +
      (p.realizedProfit < 0 ? 30 : 0);
    return score(b) - score(a);
  });
  const top = ranked.slice(0, 5);
  if (top.length === 0) {
    return { text: "Belum ada proyek aktif.", blocks: [] };
  }
  return {
    text: "Proyek yang perlu perhatian lebih dulu:",
    blocks: [
      {
        type: "list",
        items: top.map((p) => {
          const bits = [
            `kas ${formatRupiah(p.balance)}`,
            p.receivable > 0 ? `piutang ${formatRupiah(p.receivable)}` : null,
            `checklist ${p.checklistPercent}%`,
          ].filter(Boolean);
          return `${p.name} — ${bits.join(" · ")}`;
        }),
      },
      ...top.slice(0, 2).map((p) => ({
        type: "link" as const,
        href: `/projects/${p.id}`,
        label: p.name,
      })),
    ],
  };
}

function replyProject(ctx: AssistantContext, project: AssistantProjectSnap): AssistantReply {
  return {
    text: `Ringkasan ${project.name} (${project.location}).`,
    blocks: [
      { type: "stat", label: "Kas proyek", value: formatRupiah(project.balance) },
      {
        type: "stat",
        label: "Keuntungan realisasi",
        value: formatRupiah(project.realizedProfit),
      },
      {
        type: "stat",
        label: "Sisa fee",
        value: formatRupiah(project.feeRemaining),
      },
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

function replyHelp(): AssistantReply {
  return {
    text: "Saya Asisten Kas — baca data pembukuan Anda secara lokal. Coba minta:",
    blocks: [
      {
        type: "list",
        items: [
          "Kas besar / Tunai / Bank",
          "Pengingat hari ini",
          "Fee tersisa (atau sebut nama proyek)",
          "Keuntungan proyek",
          "Proyek mana kritis",
          "Transaksi terbaru",
          "Tampilkan ringkasan [nama proyek]",
        ],
      },
    ],
  };
}

export function localReplyEngine(
  message: string,
  ctx: AssistantContext,
): AssistantReply {
  const q = message.trim().toLowerCase();
  if (!q) return replyHelp();

  const project = findProject(ctx, message);

  if (
    /pengingat|ingat|reminder|peringatan|hari ini/.test(q)
  ) {
    return replyReminders(ctx);
  }
  if (/kas besar|saldo kas|tunai|bank\b|berapa kas/.test(q) && !/fee|transfer fee/.test(q)) {
    return replyKas(ctx);
  }
  if (/fee|kuota fee|transfer fee|bank pribadi/.test(q)) {
    return replyFee(ctx, project);
  }
  if (/untung|keuntungan|laba|margin|proyeksi/.test(q)) {
    return replyProfit(ctx, project);
  }
  if (/kritis|perhatian|masalah|risiko|prioritas/.test(q)) {
    return replyCritical(ctx);
  }
  if (/transaksi|riwayat|terbaru|baru saja/.test(q)) {
    return replyRecent(ctx);
  }
  if (project && (/tampil|ringkas|proyek|detail|status|checklist/.test(q) || q.includes(project.name.toLowerCase()))) {
    return replyProject(ctx, project);
  }
  if (/tampil|lihat|daftar proyek/.test(q)) {
    const active = ctx.projects.filter((p) => p.status === "ACTIVE");
    return {
      text: "Proyek aktif:",
      blocks: [
        {
          type: "list",
          items: active.map(
            (p) =>
              `${p.name} — kas ${formatRupiah(p.balance)} · fee sisa ${formatRupiah(p.feeRemaining)}`,
          ),
        },
        { type: "link", href: "/projects", label: "Semua proyek" },
      ],
    };
  }
  if (/bantu|help|perintah|bisa apa/.test(q)) {
    return replyHelp();
  }

  if (project) return replyProject(ctx, project);

  return {
    text: "Belum ketemu maksudnya. Saya bisa menampilkan kas, fee, keuntungan, pengingat, atau ringkasan proyek dari data Anda.",
    blocks: replyHelp().blocks,
  };
}
