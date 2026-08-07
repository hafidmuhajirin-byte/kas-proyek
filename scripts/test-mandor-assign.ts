import {
  findMandorByName,
  namesLikelyMatch,
  normalizePersonName,
} from "../lib/mandor-assign";

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failed += 1;
    console.error(`FAIL: ${msg}`);
  } else {
    console.log(`ok: ${msg}`);
  }
}

assert(normalizePersonName("Bpk Feri") === "feri", "normalize Bpk Feri");
assert(normalizePersonName("Bok Feri") === "feri", "normalize Bok Feri typo");
assert(normalizePersonName("Pak Istiadi") === "istiadi", "normalize Pak");
assert(namesLikelyMatch("Bpk Feri", "Bok Feri"), "Bpk ≈ Bok Feri");
assert(namesLikelyMatch("Bpk Istiadi", "Bpk Istiadi"), "exact match");
assert(!namesLikelyMatch("Bpk Feri", "Bpk Lutfi"), "beda orang");

const candidates = [
  { id: "1", name: "Bpk Feri", username: "feri" },
  { id: "2", name: "Bpk Istiadi", username: "istiadi" },
  { id: "3", name: "Bpk Hendra", username: "hendra" },
];

assert(
  findMandorByName(candidates, "Bpk Feri")?.id === "1",
  "find exact Feri",
);
assert(
  findMandorByName(candidates, "Bok Feri")?.id === "1",
  "find typo Bok Feri",
);
assert(
  findMandorByName(candidates, "feri")?.username === "feri",
  "find by username-like",
);
assert(
  findMandorByName(candidates, "Orang Lain") === null,
  "no match → null",
);

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll mandor-assign checks passed.");
