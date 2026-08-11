import { prisma } from "@/lib/prisma";

export type UnitMemoryEntry = {
  nameKey: string;
  displayName: string;
  units: Array<{ unit: string; count: number }>;
  preferredUnit: string;
};

export type AssistantMemory = {
  /** Normalized material name → unit frequencies */
  unitsByName: Map<string, UnitMemoryEntry>;
};

export function normalizeMaterialName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s./-]/gi, "");
}

export function normalizeUnit(unit: string): string {
  return unit.trim().toLowerCase().replace(/\s+/g, "");
}

/** Bootstrap memory from existing expense lines + MaterialMaster. */
export async function buildInputMemory(projectId?: string): Promise<AssistantMemory> {
  const unitsByName = new Map<string, UnitMemoryEntry>();

  function add(name: string, unit: string | null | undefined) {
    const n = name?.trim();
    const u = unit?.trim();
    if (!n || !u) return;
    const key = normalizeMaterialName(n);
    if (key.length < 2) return;
    const unitKey = normalizeUnit(u);
    if (!unitKey) return;
    let entry = unitsByName.get(key);
    if (!entry) {
      entry = {
        nameKey: key,
        displayName: n,
        units: [],
        preferredUnit: u,
      };
      unitsByName.set(key, entry);
    }
    const hit = entry.units.find((x) => normalizeUnit(x.unit) === unitKey);
    if (hit) hit.count += 1;
    else entry.units.push({ unit: u, count: 1 });
    entry.units.sort((a, b) => b.count - a.count);
    entry.preferredUnit = entry.units[0]?.unit ?? u;
  }

  const [masters, lines] = await Promise.all([
    prisma.materialMaster.findMany({
      select: { name: true, unit: true },
      take: 2000,
    }),
    prisma.mandorExpenseLine.findMany({
      where: {
        kind: "MATERIAL",
        ...(projectId
          ? { transaction: { projectId } }
          : {}),
      },
      select: { description: true, unit: true },
      take: 5000,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  for (const m of masters) add(m.name, m.unit);
  for (const l of lines) add(l.description, l.unit);

  return { unitsByName };
}

export type UnitConsistencyCheck = {
  ok: boolean;
  name: string;
  currentUnit: string;
  preferredUnit: string;
  timesSeen: number;
  message: string;
};

/** Compare a draft material line against memory. */
export function checkUnitConsistency(
  memory: AssistantMemory,
  description: string,
  unit: string,
): UnitConsistencyCheck | null {
  const name = description.trim();
  const u = unit.trim();
  if (!name || !u) return null;
  const key = normalizeMaterialName(name);
  const entry = memory.unitsByName.get(key);
  if (!entry || entry.units.length === 0) {
    // fuzzy: token overlap (e.g. "besi 6" vs "besi 6 a")
    const tokens = key.split(" ").filter((t) => t.length > 2);
    if (tokens.length === 0) return null;
    let best: UnitMemoryEntry | null = null;
    let bestHits = 0;
    for (const [k, e] of memory.unitsByName) {
      const hits = tokens.filter((t) => k.includes(t)).length;
      if (hits >= Math.min(2, tokens.length) && hits > bestHits) {
        best = e;
        bestHits = hits;
      } else if (tokens.length === 1 && k.startsWith(tokens[0]!) && hits > bestHits) {
        best = e;
        bestHits = hits;
      }
    }
    if (!best) return null;
    return finishCheck(name, u, best);
  }
  return finishCheck(name, u, entry);
}

function finishCheck(
  name: string,
  currentUnit: string,
  entry: UnitMemoryEntry,
): UnitConsistencyCheck | null {
  const cur = normalizeUnit(currentUnit);
  const pref = normalizeUnit(entry.preferredUnit);
  if (cur === pref) return { ok: true, name, currentUnit, preferredUnit: entry.preferredUnit, timesSeen: entry.units[0]?.count ?? 0, message: "" };
  const times = entry.units.find((x) => normalizeUnit(x.unit) === pref)?.count ?? 0;
  return {
    ok: false,
    name,
    currentUnit,
    preferredUnit: entry.preferredUnit,
    timesSeen: times,
    message: `Sebelumnya “${entry.displayName}” memakai satuan **${entry.preferredUnit}** (${times}×). Sekarang **${currentUnit}**. Samakan satuan atau bedakan nama bahan jika memang jenis lain.`,
  };
}
