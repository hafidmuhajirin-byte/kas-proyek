/**
 * Self-check rumus dana Mandor (jalankan: npx tsx scripts/check-mandor-fund.ts)
 */
import {
  computeMandorFund,
  namesMatch,
} from "../lib/mandor-fund-math";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

// 2×50 pencairan = 100 (tanpa termin)
{
  const s = computeMandorFund({
    projectId: "p1",
    mandorId: "m1",
    disbursements: [
      {
        id: "d1",
        projectId: "p1",
        mandorId: "m1",
        amount: 50_000_000,
        transactionId: "tx1",
      },
      {
        id: "d2",
        projectId: "p1",
        mandorId: "m1",
        amount: 50_000_000,
        transactionId: "tx2",
      },
    ],
    proofs: [
      {
        amount: 46_900_000,
        projectId: "p1",
        createdById: "m1",
        linkedMandorDisbursementId: "d1",
      },
    ],
  });
  assert(s.totalCair === 100_000_000, `cair expected 100jt got ${s.totalCair}`);
  assert(s.totalBukti === 46_900_000, `bukti expected 46.9jt got ${s.totalBukti}`);
  assert(s.sisa === 53_100_000, `sisa expected 53.1jt got ${s.sisa}`);
}

// Orphan tanpa transaksi Kas Besar diabaikan
{
  const s = computeMandorFund({
    projectId: "p1",
    mandorId: "m1",
    disbursements: [
      {
        id: "orphan",
        projectId: "p1",
        mandorId: "m1",
        amount: 50_000_000,
        transactionId: null,
      },
      {
        id: "real",
        projectId: "p1",
        mandorId: "m1",
        amount: 50_000_000,
        transactionId: "tx-real",
      },
    ],
    proofs: [],
  });
  assert(s.totalCair === 50_000_000, `orphan ignored got ${s.totalCair}`);
}

assert(namesMatch("Bpk Feri", "Bpk Feri"), "exact");
assert(namesMatch("Bpk Feri", "Feri"), "includes");
assert(!namesMatch("Bpk Feri", "Bpk Istiadi"), "different");

console.log("OK: rumus dana Mandor lulus semua kasus.");
