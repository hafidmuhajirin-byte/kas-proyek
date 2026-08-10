/**
 * Uji pecahan kewajiban pajak (tanpa DB).
 */
import assert from "node:assert/strict";
import { computeVoucherTax } from "../lib/lpj/tax-compliance";
import { taxResultToObligationLines } from "../lib/tax-obligations";
import { buildBkuMonthBlocks } from "../lib/buku-kas/bku";

function ok(cond: unknown, msg: string) {
  assert.ok(cond, msg);
  console.log("ok:", msg);
}

const material = computeVoucherTax({
  amount: 5_000_000,
  description: "Besi beton",
  categoryName: "Material",
  isMandorExpense: true,
  breakdownStatus: "APPROVED",
  lines: [
    {
      amount: 5_000_000,
      description: "Besi",
      kind: "MATERIAL",
      isMaterialAlam: false,
    },
  ],
});
ok(material.kind === "PPN_PPH", "material >2jt → PPN_PPH");
const lines = taxResultToObligationLines(material, 5_000_000);
ok(lines.length === 2, "dua kewajiban: PPN + PPh");
ok(
  lines.some((l) => l.kind === "PPN_11" && l.taxAmount === Math.round(5e6 * 0.11)),
  "PPN 11%",
);
ok(
  lines.some((l) => l.kind === "PPH_15" && l.taxAmount === Math.round(5e6 * 0.015)),
  "PPh 1,5%",
);

const pending = computeVoucherTax({
  amount: 5_000_000,
  description: "Besi beton",
  categoryName: "Material",
  isMandorExpense: true,
  breakdownStatus: "PENDING",
});
ok(
  taxResultToObligationLines(pending, 5_000_000).length === 0,
  "PENDING → belum ada kewajiban",
);

// Default BKU: pajak belum potong kas sampai isTaxPayment
const bkuUnpaid = buildBkuMonthBlocks([
  {
    id: "n1",
    date: new Date("2026-03-10"),
    description: "Besi",
    type: "EXPENSE",
    amount: 5_000_000,
    isMandorExpense: true,
    breakdownStatus: "APPROVED",
    categoryName: "Material",
    expenseLines: [
      {
        amount: 5_000_000,
        description: "Besi",
        kind: "MATERIAL",
      },
    ],
  },
]);
ok(bkuUnpaid.length === 1, "satu bulan BKU");
ok(
  !bkuUnpaid[0]!.expenses.some((e) => e.isTaxRow),
  "default: tanpa baris pajak virtual",
);
ok(bkuUnpaid[0]!.totalExpense === 5_000_000, "hanya belanja, belum pajak");

const bkuPaid = buildBkuMonthBlocks([
  {
    id: "n1",
    date: new Date("2026-03-10"),
    description: "Besi",
    type: "EXPENSE",
    amount: 5_000_000,
    isMandorExpense: true,
    breakdownStatus: "APPROVED",
    categoryName: "Material",
    expenseLines: [
      {
        amount: 5_000_000,
        description: "Besi",
        kind: "MATERIAL",
      },
    ],
  },
  {
    id: "pay1",
    date: new Date("2026-03-15"),
    description: "Bayar Pajak PPN (11%) · billing ABC",
    type: "EXPENSE",
    amount: Math.round(5e6 * 0.11),
    isTaxPayment: true,
    categoryName: "Pembayaran Pajak",
  },
]);
ok(
  bkuPaid[0]!.expenses.some((e) => e.isTaxRow && /PPN/i.test(e.description)),
  "setelah bayar: baris isTaxPayment di BKU",
);
ok(
  bkuPaid[0]!.totalExpense === 5_000_000 + Math.round(5e6 * 0.11),
  "pengeluaran naik setelah pajak dibayar",
);

console.log("\nSemua uji tax-obligation lulus.");
