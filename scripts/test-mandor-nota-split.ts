/**
 * Tes logika alur Split Nota (tanpa DB).
 * npx tsx scripts/test-mandor-nota-split.ts
 */
import { TAX_THRESHOLD } from "../lib/lpj/tax-compliance";

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failed += 1;
    console.error(`FAIL: ${msg}`);
  } else {
    console.log(`ok: ${msg}`);
  }
}

/** Simulasi eligibility tombol Split (cermin UI). */
function canShowSplit(input: {
  mandorTotal: number;
  lineCount: number;
  remainingAfterCurrent: number;
  partCount: number;
}) {
  return (
    input.mandorTotal > TAX_THRESHOLD &&
    input.lineCount > 0 &&
    input.remainingAfterCurrent > 0 &&
    input.partCount < 3
  );
}

/** Simulasi progressif: kunci BKK lalu sisa. */
function nextBkkAmount(
  mandorTotal: number,
  lockedOthers: number,
  lockedCurrent: number,
) {
  return mandorTotal - lockedOthers - lockedCurrent;
}

assert(TAX_THRESHOLD === 2_000_000, "ambang 2 jt");

assert(
  !canShowSplit({
    mandorTotal: 1_761_000,
    lineCount: 6,
    remainingAfterCurrent: 0,
    partCount: 1,
  }),
  "di bawah 2 jt → tidak ada Split (contoh pecah isi biasa)",
);

assert(
  canShowSplit({
    mandorTotal: 5_000_000,
    lineCount: 3,
    remainingAfterCurrent: 3_200_000,
    partCount: 1,
  }),
  "5 jt + pecah isi parsial → tombol Split",
);

assert(
  !canShowSplit({
    mandorTotal: 5_000_000,
    lineCount: 0,
    remainingAfterCurrent: 5_000_000,
    partCount: 1,
  }),
  "belum pecah isi → tidak Split",
);

assert(
  !canShowSplit({
    mandorTotal: 5_000_000,
    lineCount: 2,
    remainingAfterCurrent: 1_000_000,
    partCount: 3,
  }),
  "sudah 3 BKK → tidak Split lagi",
);

{
  const mandor = 5_000_000;
  const bkk1 = 1_800_000;
  const bkk2 = nextBkkAmount(mandor, 0, bkk1);
  assert(bkk2 === 3_200_000, "setelah Split1: BKK2 = sisa");
  const bkk2Locked = 1_900_000;
  const bkk3 = nextBkkAmount(mandor, bkk1, bkk2Locked);
  assert(bkk3 === 1_300_000, "setelah Split2: BKK3 = sisa");
  assert(bkk1 + bkk2Locked + bkk3 === mandor, "sum BKK = total Mandor");
}

assert(
  1_761_000 <= TAX_THRESHOLD,
  "contoh screenshot Hebel = pecah isi saja, bukan kandidat split",
);

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll mandor-nota-split checks passed.");
