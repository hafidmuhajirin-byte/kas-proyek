/**
 * Unit checks (tanpa jest) — jalankan: npx tsx scripts/test-lpj-core.ts
 */
import {
  computeLineTax,
  getTaxCeilingStatus,
  TAX_CEILING_OF_SPK,
} from "../lib/lpj/tax-compliance";
import {
  buildSpkRingkasanTable,
  computeSpkTargets,
  defaultLaborMaterialPercent,
} from "../lib/lpj/smart-estimator";
import {
  mandorWorkEstimateMax,
  roundDownToThousand,
} from "../lib/contractor";
import {
  LABEL_BAYAR_JASA_PENGAWASAN,
  LABEL_BAYAR_JASA_PERENCANAAN,
  rewriteJasaPerencanaanPengawasan,
} from "../lib/lpj/jasa-labels";
import {
  buildBankMonthBlocks,
  buildBankMutationsFromProject,
  plannedTranchesFromContract,
  validatePhase1Spend,
  validatePengambilanAgainstBank,
} from "../lib/buku-kas/bank";
import {
  buildBkuMonthBlocks,
  mapExpenseCostType,
} from "../lib/buku-kas/bku";
import {
  buildBktMonthBlocks,
} from "../lib/buku-kas/bkt";
import {
  collectOwnerPengambilan,
  isOwnerPengambilanFromUser,
} from "../lib/lpj/owner-pengambilan";

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

// Tax — perencanaan / pengawasan → Final 3.5%
{
  const r = computeLineTax({
    amount: 2_761_410,
    description: "Bayar Dana Perencanaan",
    categoryName: "Dana Perencanaan",
  });
  assert(r.kind === "PPH_FINAL", "perencanaan → PPH_FINAL");
  assert(r.pph === 96_649, `3.5% = 96649 got ${r.pph}`);
  assert(r.ppn === 0, "Final tanpa PPN");

  const r2 = computeLineTax({
    amount: 3_404_630,
    description: "Bayar Dana Pengawasan",
    categoryName: "Dana Pengawasan",
  });
  assert(r2.kind === "PPH_FINAL", "pengawasan → PPH_FINAL");
  assert(r2.pph === Math.round(3_404_630 * 0.035), "pengawasan 3.5%");
}

// Tax — gaji pekerja bebas (bukan perencanaan)
{
  const r = computeLineTax({
    amount: 5_110_000,
    description: "Pembayaran Pekerja Minggu Ke 7",
    categoryName: "Upah",
  });
  assert(r.totalTax === 0 && r.kind === "EXEMPT_LABOR", "gaji pekerja bebas");

  const r2 = computeLineTax({
    amount: 5_225_000,
    description: "Bayar Ongkos pekerja",
    lineKind: "LABOR",
  });
  assert(r2.totalTax === 0 && r2.kind === "EXEMPT_LABOR", "LABOR kind bebas");

  const r3 = computeLineTax({
    amount: 5_110_000,
    description: "Pembayaran Pekerja",
    code: "Gaj1",
  });
  assert(r3.totalTax === 0 && r3.kind === "EXEMPT_LABOR", "kode GaJ bebas");
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

// Tabel ringkasan SPK A/B/C
{
  const t = computeSpkTargets([
    { category: "REHAB_FISIK", amount: 200_000_000 },
    { category: "PERENCANAAN", amount: 5_000_000, laborPercent: 100, materialPercent: 0 },
    { category: "PENGAWASAN", amount: 6_000_000, laborPercent: 100, materialPercent: 0 },
    { category: "MEBELAIR_BARU", amount: 10_000_500 },
  ]);
  const table = buildSpkRingkasanTable(t.lines, 276_200_000);
  assert(table.sections.length === 3, "3 section A/B/C");
  assert(table.sections[0].letter === "A", "fisik = A");
  assert(table.sections[1].letter === "B", "manajemen = B");
  assert(table.sections[2].letter === "C", "mebelair = C");
  assert(table.total === 221_000_500, "total pagu");
  assert(table.rounded === 221_001_000, "dibulatkan ke ribuan");
  assert(
    table.sections[1].rows[0].label.includes("%"),
    "manajemen tampilkan % dari SPK",
  );
}

// Label Bayar jasa perencana / Pengawas (+ hapus CV)
{
  assert(
    rewriteJasaPerencanaanPengawasan("Penyerahan ke perencanaan CV") ===
      `Penyerahan ke ${LABEL_BAYAR_JASA_PERENCANAAN}`,
    "rewrite perencanaan tanpa CV",
  );
  assert(
    rewriteJasaPerencanaanPengawasan("Penyerahn Ke Pengawasan CV") ===
      `Penyerahn Ke ${LABEL_BAYAR_JASA_PENGAWASAN}`,
    "rewrite pengawasan tanpa CV",
  );
  assert(
    rewriteJasaPerencanaanPengawasan(LABEL_BAYAR_JASA_PERENCANAAN) ===
      LABEL_BAYAR_JASA_PERENCANAAN,
    "idempotent perencanaan",
  );
}

// Estimasi borongan Mandor: ROUNDDOWN((kontrak−manajemen)×70%; -3)
{
  assert(roundDownToThousand(177_278_777.9) === 177_278_000, "rounddown -3");
  const missing = mandorWorkEstimateMax({
    contractValue: 276_200_000,
    perencanaan: 6_230_323,
    pengawasan: 0,
    pengelolaan: 9_032_717,
  });
  assert(missing.source === "none" && missing.amount === 0, "blok jika manajemen kosong");

  const ok = mandorWorkEstimateMax({
    contractValue: 276_200_000,
    perencanaan: 6_230_323,
    pengawasan: 7_681_563,
    pengelolaan: 9_032_717,
  });
  // base = 253_255_397; ×70% = 177_278_777.9 → ROUNDDOWN -3 = 177_278_000
  assert(ok.source === "spk70", "sumber spk70");
  assert(ok.baseAmount === 253_255_397, "dasar setelah potong manajemen");
  assert(ok.amount === 177_278_000, "estimasi borongan Mandor");
}

// Bank 70/30 + pengambilan dari penerimaan Owner
{
  const p = plannedTranchesFromContract(100_000_000);
  assert(p.phase70 === 70_000_000 && p.phase30 === 30_000_000, "70/30 split");
  const v = validatePhase1Spend(70_000_000, 84_000_000);
  assert(!v.ok && v.overspend === 14_000_000, "phase1 overspend");
  const vb = validatePengambilanAgainstBank(100_000_000, 84_000_000);
  assert(vb.ok && vb.remaining === 16_000_000, "pengambilan vs total bank ok");

  assert(
    isOwnerPengambilanFromUser({
      date: new Date(),
      type: "INCOME",
      amount: 70_000_000,
      description: "PEMBAYARAN 1",
      categoryName: "Pembayaran Kas (Permintaan)",
    }),
    "pembayaran user → pengambilan",
  );
  assert(
    !isOwnerPengambilanFromUser({
      date: new Date(),
      type: "INCOME",
      amount: 5_000_000,
      description: "Setor",
      isOwnerPersonal: true,
      categoryName: "Setoran Dana Pribadi",
    }),
    "setoran pribadi bukan pengambilan",
  );

  const collected = collectOwnerPengambilan([
    {
      date: new Date(2025, 6, 25),
      type: "INCOME",
      amount: 70_000_000,
      description: "PEMBAYARAN 1",
      categoryName: "Pembayaran Kas (Permintaan)",
    },
    {
      date: new Date(2025, 7, 3),
      type: "INCOME",
      amount: 70_000_000,
      description: "Termin ke 2",
      categoryName: "Termin / DP",
    },
  ]);
  assert(collected.length === 2, "dua pengambilan");
  assert(
    collected[0].pengambilanLabel === "Pengambilan Ke-1 (PEMBAYARAN 1)",
    "label pengambilan 1",
  );

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
  assert(
    mutations.some((m) => /Pengambilan Ke-1/.test(m.description ?? "")),
    "uraian kredit = Pengambilan",
  );
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
  const bkk1 = bku[0].expenses.find((e) => e.proofNo === "BKK.1");
  assert(Boolean(bkk1), "bukti BKK.1");
  assert(bkk1?.status === "Beli", "status Beli");
  assert(bkk1?.costType === "B", "semen = B");
  const bkk1Idx = bku[0].expenses.findIndex((e) => e.proofNo === "BKK.1");
  assert(
    bkk1Idx >= 0 && bku[0].expenses[bkk1Idx + 1]?.proofNo === "",
    "baris lanjut tanpa nomor",
  );
  assert(
    bku[0].expenses.some((e) => e.proofNo === "BKK.2"),
    "bukti BKK.2",
  );

  const taxPay = bku[0].expenses.filter((e) => e.isTaxRow);
  const taxRecv = bku[0].incomes.filter((e) => e.isTaxRow);
  assert(taxPay.length >= 2, "ada baris bayar pajak material");
  assert(
    taxRecv.some((r) => /Terima PPh Pasal 4/i.test(r.description)),
    "ada terima PPh Final pengawasan",
  );
  // Terima PPh harus sejajar (index sama) dengan baris BKK terkait
  {
    const expIdx = bku[0].expenses.findIndex((e) => e.proofNo === "BKK.2");
    const incIdx = bku[0].incomes.findIndex((r) =>
      /Terima PPh Pasal 4.*BKK\.2/i.test(r.description),
    );
    assert(expIdx >= 0 && incIdx === expIdx, "terima PPh sejajar dengan BKK.2");
  }
  assert(
    taxPay.some((r) => /Bayar Pajak PPN/i.test(r.description)),
    "ada bayar PPN material >2jt",
  );
  assert(
    !bku[0].expenses.some((e) => /Pencairan Mandor/i.test(e.description)),
    "pencairan mandor tidak masuk BKU",
  );

  // gaji pekerja tidak kena pajak
  const bkuWage = buildBkuMonthBlocks(
    [
      {
        id: "w1",
        date: new Date(2025, 9, 4),
        description: "Pembayaran Pekerja Minggu Ke 5",
        type: "EXPENSE",
        amount: 5_225_000,
        isMandorExpense: true,
        categoryName: "Upah",
        expenseLines: [
          {
            description: "Pembayaran Pekerja Minggu Ke 5",
            quantity: 1,
            unit: "Ls",
            amount: 5_225_000,
            kind: "LABOR",
          },
        ],
      },
    ],
    { openingCashBalance: 10_000_000 },
  );
  assert(
    !bkuWage[0].expenses.some((e) => e.isTaxRow),
    "upah pekerja tanpa baris pajak",
  );
  assert(bkuWage[0].cashBalance === 10_000_000 - 5_225_000, "kas hanya potong upah");

  // kas: 40jt − 5jt material − pajak PPN/PPH material − 3jt pengawasan (PPh final net 0)
  const materialTaxPpn = Math.round(5_000_000 * 0.11);
  const materialTaxPph = Math.round(5_000_000 * 0.015);
  const expectedCash =
    40_000_000 - 5_000_000 - materialTaxPpn - materialTaxPph - 3_000_000;
  assert(bku[0].cashBalance === expectedCash, `kas tunai ${expectedCash}`);
  assert(bku[0].bankBalance === 60_000_000, "saldo bank dari buku bank");
}

{
  const bkt = buildBktMonthBlocks(
    [
      {
        date: new Date(2025, 8, 1),
        description: "Pengambilan Ke-1",
        type: "INCOME",
        amount: 84_000_000,
        categoryName: "Transfer Owner",
        cashSourceType: "CASH",
      },
      {
        date: new Date(2025, 8, 2),
        description: "Nota bahan",
        type: "EXPENSE",
        amount: 500_000,
        isMandorExpense: true,
        categoryName: "Belanja Mandor",
        cashSourceType: "CASH",
        expenseLines: [
          {
            description: "Banner",
            quantity: 10,
            unit: "m",
            amount: 170_000,
            kind: "MATERIAL",
          },
          {
            description: "Cetak A3",
            quantity: 26,
            unit: "Lbr",
            amount: 91_000,
            kind: "MATERIAL",
          },
          {
            description: "Lainnya",
            quantity: 1,
            unit: "Ls",
            amount: 239_000,
            kind: "MATERIAL",
          },
        ],
      },
    ],
    { openingCashBalance: 0 },
  );
  assert(bkt.length === 1, "bkt satu bulan");
  assert(bkt[0].rows[0].income === 84_000_000, "bkt penerimaan pengambilan");
  assert(bkt[0].rows.some((r) => r.proofNo === "BKK.1"), "bkt BKK.1");
  assert(bkt[0].closingBalance === 84_000_000 - 500_000, "bkt closing");
  assert(
    !bkt[0].rows.some((r) => r.isTaxRow),
    "bkt tanpa pajak jika belanja ≤2jt",
  );
}

{
  // BKT: bayar pajak setelah nota (material >2jt + pengawasan)
  const material = 5_000_000;
  const pengawasan = 3_000_000;
  const ppn = Math.round(material * 0.11);
  const pph = Math.round(material * 0.015);
  const pphFinal = Math.round(pengawasan * 0.035);
  const bktTax = buildBktMonthBlocks(
    [
      {
        date: new Date(2025, 9, 1),
        description: "Pengambilan Ke-1",
        type: "INCOME",
        amount: 40_000_000,
        categoryName: "Transfer Owner",
        cashSourceType: "CASH",
      },
      {
        date: new Date(2025, 9, 5),
        description: "Beli semen",
        type: "EXPENSE",
        amount: material,
        isMandorExpense: true,
        categoryName: "Belanja Mandor",
        cashSourceType: "CASH",
        expenseLines: [
          {
            description: "Semen Portland",
            quantity: 100,
            unit: "zak",
            amount: material,
            kind: "MATERIAL",
          },
        ],
      },
      {
        date: new Date(2025, 9, 6),
        description: "Jasa pengawasan",
        type: "EXPENSE",
        amount: pengawasan,
        categoryName: "Dana Pengawasan",
        cashSourceType: "CASH",
      },
      {
        date: new Date(2025, 9, 7),
        description: "Pembayaran Pekerja",
        type: "EXPENSE",
        amount: 2_000_000,
        isMandorExpense: true,
        categoryName: "Upah",
        cashSourceType: "CASH",
        expenseLines: [
          {
            description: "Upah pekerja minggu 1",
            quantity: 10,
            unit: "hari",
            amount: 2_000_000,
            kind: "LABOR",
          },
        ],
      },
    ],
    { openingCashBalance: 0 },
  );

  assert(bktTax.length === 1, "bkt pajak satu bulan");
  const taxRows = bktTax[0].rows.filter((r) => r.isTaxRow);
  assert(
    taxRows.some((r) => /Bayar Pajak PPN \(11%\) BKK\.1/i.test(r.description)),
    "bkt ada bayar PPN setelah material",
  );
  assert(
    taxRows.some((r) => /Bayar Pajak PPH \(1,5%\) BKK\.1/i.test(r.description)),
    "bkt ada bayar PPH setelah material",
  );
  assert(
    taxRows.some((r) =>
      /Terima PPh Pasal 4 ayat 2.*BKK\.2/i.test(r.description),
    ),
    "bkt ada terima PPh Final pengawasan",
  );
  assert(
    taxRows.some((r) =>
      /Bayar PPh Pasal 4 ayat 2.*BKK\.2/i.test(r.description),
    ),
    "bkt ada bayar PPh Final pengawasan",
  );
  assert(
    !taxRows.some((r) => /BKK\.3/i.test(r.description)),
    "bkt upah pekerja tanpa pajak",
  );

  // Urutan: BKK.1 → bayar PPN/PPH → BKK.2 → terima+bayar PPh Final
  const idxBkk1 = bktTax[0].rows.findIndex((r) => r.proofNo === "BKK.1");
  const idxPpn = bktTax[0].rows.findIndex((r) =>
    /Bayar Pajak PPN.*BKK\.1/i.test(r.description),
  );
  assert(idxBkk1 >= 0 && idxPpn === idxBkk1 + 1, "bkt PPN langsung setelah BKK.1");

  // Kas: 40jt − 5jt − PPN − PPH − 3jt − (terima−bayar PPh final = 0) − 2jt upah
  const expectedBkt =
    40_000_000 - material - ppn - pph - pengawasan - 2_000_000;
  assert(
    bktTax[0].closingBalance === expectedBkt,
    `bkt closing dengan pajak ${expectedBkt}`,
  );
  // Terima + bayar PPh Final netto 0
  assert(pphFinal > 0, "pph final > 0");
  const terima = taxRows.find((r) => /Terima PPh/i.test(r.description));
  const bayarFinal = taxRows.find((r) =>
    /Bayar PPh Pasal 4/i.test(r.description),
  );
  assert(
    terima?.income === pphFinal && bayarFinal?.expense === pphFinal,
    "bkt PPh Final terima=bayar",
  );
}

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll LPJ core checks passed.");
