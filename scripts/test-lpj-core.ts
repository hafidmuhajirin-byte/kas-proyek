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

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll LPJ core checks passed.");
