export function formatRupiah(amount: number): string {
  const formatted = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
  return formatted.replace(/\u00A0/g, " ");
}

export function formatNumberId(amount: number): string {
  return new Intl.NumberFormat("id-ID").format(amount);
}

export function parseRupiahInput(value: string): number {
  const digits = value.replace(/[^\d]/g, "");
  if (!digits) return 0;
  return Number.parseInt(digits, 10);
}

export function signedAmount(type: "INCOME" | "EXPENSE", amount: number): number {
  return type === "INCOME" ? amount : -amount;
}
