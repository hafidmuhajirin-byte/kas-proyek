/**
 * Unit checks isolasi proyek mandiri — jalankan: npx tsx scripts/test-standalone-project.ts
 */
import { isMandorVoucherTaxEligible } from "../lib/lpj/tax-compliance";

let failed = 0;

function assert(cond: boolean, msg: string) {
  if (!cond) {
    failed += 1;
    console.error("FAIL:", msg);
  } else {
    console.log("ok:", msg);
  }
}

// Pajak Mandor tetap butuh APPROVED (sudah di PR terpisah)
assert(
  !isMandorVoucherTaxEligible({
    isMandorExpense: true,
    breakdownStatus: "PENDING",
  }),
  "PENDING Mandor tidak eligible pajak",
);
assert(
  isMandorVoucherTaxEligible({
    isMandorExpense: true,
    breakdownStatus: "APPROVED",
  }),
  "APPROVED Mandor eligible pajak",
);
assert(
  isMandorVoucherTaxEligible({ isMandorExpense: false }),
  "non-Mandor selalu eligible",
);

// Shape filter kas besar (compile-time / runtime import)
import { kasBesarTransactionWhere } from "../lib/standalone-project";
assert(
  Array.isArray(kasBesarTransactionWhere.OR) &&
    kasBesarTransactionWhere.OR.length === 2,
  "filter kasBesarTransactionWhere punya OR project null / non-standalone",
);

if (failed > 0) {
  console.error(`\n${failed} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll standalone checks passed.");
