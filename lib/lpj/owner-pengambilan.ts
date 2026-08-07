/**
 * Penerimaan proyek dari User → Owner = pengambilan dana dari Buku Bank (LPJ).
 * Bukan setoran pribadi, fee, atau pemasukan di luar aliran User.
 */

export type LpjPengambilanTx = {
  date: Date;
  type: "INCOME" | "EXPENSE" | string;
  amount: number;
  description?: string | null;
  isOwnerPersonal?: boolean | null;
  isFeeTransfer?: boolean | null;
  categoryName?: string | null;
};

/** Pemasukan proyek yang dilaporkan sebagai Kredit / Pengambilan di Buku Bank. */
export function isOwnerPengambilanFromUser(tx: LpjPengambilanTx): boolean {
  if (tx.type !== "INCOME") return false;
  if (tx.isOwnerPersonal || tx.isFeeTransfer) return false;
  if (!(tx.amount > 0)) return false;

  const cat = (tx.categoryName ?? "").toLowerCase();
  const desc = (tx.description ?? "").toLowerCase();
  // Setoran pribadi sering tanpa flag — jangan masuk pengambilan bank
  if (/setoran|pribadi|modal\s*sendiri/.test(cat)) return false;
  if (/setoran\s*dana\s*pribadi|modal\s*sendiri/.test(desc)) return false;
  return true;
}

/** Label resmi LPJ untuk baris pengambilan. */
export function labelPengambilanKe(n: number, original?: string | null) {
  const base = `Pengambilan Ke-${n}`;
  const tip = original?.trim();
  if (!tip || /^pengambilan\s*ke[-\s]?\d+/i.test(tip)) return base;
  return `${base} (${tip})`;
}

export function collectOwnerPengambilan<T extends LpjPengambilanTx>(
  txs: T[],
): Array<T & { pengambilanIndex: number; pengambilanLabel: string }> {
  const sorted = [...txs]
    .filter(isOwnerPengambilanFromUser)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  return sorted.map((tx, i) => {
    const n = i + 1;
    return {
      ...tx,
      pengambilanIndex: n,
      pengambilanLabel: labelPengambilanKe(n, tx.description),
    };
  });
}
