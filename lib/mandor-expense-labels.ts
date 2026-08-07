/** Pilihan keterangan upload bukti Mandor (bukan teks bebas). */
export const MANDOR_EXPENSE_DESCRIPTIONS = [
  "Belanja Bahan Bangunan",
  "Pembelian Material Alam",
  "Pembayaran Pekerja",
] as const;

export type MandorExpenseDescription =
  (typeof MANDOR_EXPENSE_DESCRIPTIONS)[number];

export function isMandorExpenseDescription(
  value: string,
): value is MandorExpenseDescription {
  return (MANDOR_EXPENSE_DESCRIPTIONS as readonly string[]).includes(value);
}

/** Material alam → bebas PPN/PPh di LPJ. */
export function isMaterialAlamDescription(description: string): boolean {
  return description === "Pembelian Material Alam";
}
