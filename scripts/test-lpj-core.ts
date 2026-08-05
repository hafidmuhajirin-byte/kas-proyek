/**
 * Unit checks (tanpa jest) — jalankan: npx tsx scripts/test-lpj-core.ts
 */
import {
  computeLineTax,
  getTaxCeilingStatus,
  TAX_CEILING_OF_SPK,
} from "../lib/lpj/tax-compliance";
import {
  computeSpkTargets,
  defaultLaborMaterialPercent,
} from "../lib/lpj/smart-estimator";
import {
  buildBankMonthBlocks,
  buildBankMutationsFromProject,
  plannedTranchesFromContract,
  validatePhase1Spend,
} from "../lib/buku-kas/bank";
import {
  buildBkuMonthBlocks,
  mapExpenseCostType,
} from "../lib/buku-kas/bku";

let failed = 0;

function assert(cond: boolean, msg: string) {
  if (!cond) {
    failed += 1;
    console.error("FAIL:", msg);
  } else {
    console.log("ok:", msg);
  }
}

// Tax — material alam
{
  const r = computeLineTax({
    amount: 2_663_000,
    description: "Pasir Cor L300",
    isMaterialAlam: true,
  });
  assert(r.totalTax === 0 && r.kind === "EXEMPT_ALAM", "material alam → 0 pajak");
}

// Tax — manufaktur > 2jt
{
  const r = computeLineTax({
    amount: 2_663_000,
    description: "Pasir Cor L300",
    isMaterialAlam: false,
  });
  assert(r.ppn === 292_930, `PPN 11% = 292930 got ${r.ppn}`);
  assert(r.pph === 39_945, `PPh 1.5% = 39945 got ${r.pph}`);
}

// Tax — Bayar → Final 3.5%
{
  const r = computeLineTax({
    amount: 2_761_410,
    description: "Bayar Dana Perencanaan",
  });
  assert(r.kind === "PPH_FINAL", "Bayar → PPH_FINAL");
  assert(r.pph === 96_649, `3.5% = 96649 got ${r.pph}`);
  assert(r.ppn === 0, "Final tanpa PPN");
}

// Tax — GaJ exempt
{
  const r = computeLineTax({
    amount: 5_110_000,
    description: "Pembayaran Pekerja",
    code: "Gaj1",
  });
  assert(r.totalTax === 0 && r.kind === "EXEMPT_CODE", "GaJ exempt");
}

// Ceiling
{
  const spk = 100_000_000;
  const ceiling = Math.round(spk * TAX_CEILING_OF_SPK);
  const st = getTaxCeilingStatus(ceiling * 0.85, spk);
  assert(st.status === "warn", "85% ceiling → warn");
  const over = getTaxCeilingStatus(ceiling + 1, spk);
  assert(over.status === "over", "over ceiling");
}

// Estimator Rehab Fisik
{
  const d = defaultLaborMaterialPercent("REHAB_FISIK");
  assert(d.laborPercent === 40 && d.materialPercent === 60, "Rehab Fisik 40/60");
  const t = computeSpkTargets([
    { category: "REHAB_FISIK", amount: 100_000_000 },
  ]);
  assert(t.totalLaborTarget === 40_000_000, "labor target 40jt");
  assert(t.totalMaterialTarget === 60_000_000, "material target 60jt");
}

// Bank 70/30 + pengambilan dari penerimaan Owner
{
  const p = plannedTranchesFromContract(100_000_000);
  assert(p.phase70 === 70_000_000 && p.phase30 === 30_000_000, "70/30 split");
  const v = validatePhase1Spend(70_000_000, 84_000_000);
  assert(!v.ok && v.overspend === 14_000_000, "phase1 overspend");

  const { mutations, totalPengambilan } = buildBankMutationsFromProject({
    tranches: [
      {
        phase: "PHASE_70",
        receivedAmount: 84_748_671,
        receivedAt: new Date(2025, 7, 13),
      },
    ],
    ownerReceipts: [
      {
        date: new Date(2025, 8, 2),
        amount: 84_000_000,
        description: "PEMBAYARAN 1",
      },
    ],
  });
  assert(totalPengambilan === 84_000_000, "total pengambilan dari receipt");
  assert(mutations.some((m) => m.credit === 84_000_000), "kredit pengambilan");
  assert(mutations.some((m) => m.debit === 84_748_671), "debet pencairan");
  assert(mutations[0].proofNo === "01" && mutations[1].proofNo === "02", "no bukti berurutan 01,02");

  const blocks = buildBankMonthBlocks(mutations);
  assert(blocks.length === 2, "dua bulan");
  assert(blocks[0].closingBalance === 84_748_671, "agu closing");
  assert(blocks[1].closingBalance === 748_671, "sep closing after withdrawal");
}

{
  assert(mapExpenseCostType("Upah") === "A", "jenis A upah");
  assert(mapExpenseCostType("Material") === "B", "jenis B material");
  assert(mapExpenseCostType("Operasional") === "D", "jenis D ops");

  const bankBlocks = buildBankMonthBlocks([
    {
      date: new Date(2025, 9, 1),
      description: "Uang Masuk",
      proofNo: "01",
      debit: 100_000_000,
      credit: 0,
    },
    {
      date: new Date(2025, 9, 5),
      description: "Pengambilan Ke-1",
      proofNo: "02",
      debit: 0,
      credit: 40_000_000,
    },
  ]);

  const bku = buildBkuMonthBlocks(
    [
      {
        id: "inc1",
        date: new Date(2025, 9, 5),
        description: "Terima pengambilan",
        type: "INCOME",
        amount: 40_000_000,
        categoryName: "Transfer Owner",
      },
      {
        id: "ex1",
        date: new Date(2025, 9, 10),
        description: "Nota material",
        type: "EXPENSE",
        amount: 5_000_000,
        isMandorExpense: true,
        categoryName: "Belanja Mandor",
        expenseLines: [
          {
            description: "Semen 3 Roda",
            quantity: 10,
            unit: "Sak",
            amount: 3_000_000,
            kind: "MATERIAL",
          },
          {
            description: "Pasir Cor",
            quantity: 2,
            unit: "Pik Up",
            amount: 2_000_000,
            kind: "MATERIAL",
          },
        ],
      },
      {
        id: "ex2",
        date: new Date(2025, 9, 12),
        description: "Bayar Dana Pengawasan",
        type: "EXPENSE",
        amount: 3_000_000,
        categoryName: "Dana Pengawasan",
      },
      {
        id: "disb",
        date: new Date(2025, 9, 8),
        description: "Pencairan Mandor",
        type: "EXPENSE",
        amount: 10_000_000,
        isMandorDisbursement: true,
        categoryName: "Pencairan ke Mandor",
      },
    ],
    { openingCashBalance: 0, bankBlocks },
  );

  assert(bku.length === 1, "bku satu bulan");
  // 2 material lines + 1 pengawasan + tax rows for both vouchers
  assert(bku[0].expenses[0].proofNo === "BKK.1", "bukti BKK.1");
  assert(bku[0].expenses[0].status === "Beli", "status Beli");
  assert(bku[0].expenses[1].proofNo === "", "baris lanjut tanpa nomor");
  assert(bku[0].expenses[2].proofNo === "BKK.2", "bukti BKK.2");
  assert(bku[0].expenses[0].costType === "B", "semen = B");

  const taxPay = bku[0].expenses.filter((e) => e.isTaxRow);
  const taxRecv = bku[0].incomes.filter((e) => e.isTaxRow);
  assert(taxPay.length >= 2, "ada baris bayar pajak");
  assert(
    taxRecv.some((r) => /Terima PPh Pasal 4/i.test(r.description)),
    "ada terima PPh Final",
  );
  assert(
    taxPay.some((r) => /Bayar Pajak PPN/i.test(r.description)),
    "ada bayar PPN material >2jt",
  );
  assert(
    !bku[0].expenses.some((e) => /Pencairan Mandor/i.test(e.description)),
    "pencairan mandor tidak masuk BKU",
  );
  // kas: 40jt − 5jt material − pajak PPN/PPH material − 3jt pengawasan (− PPh final + terima = 0)
  const materialTaxPpn = Math.round(5_000_000 * 0.11);
  const materialTaxPph = Math.round(5_000_000 * 0.015);
  const expectedCash =
    40_000_000 - 5_000_000 - materialTaxPpn - materialTaxPph - 3_000_000;
  assert(bku[0].cashBalance === expectedCash, `kas tunai ${expectedCash}`);
  assert(bku[0].bankBalance === 60_000_000, "saldo bank dari buku bank");
}

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll LPJ core checks passed.");
