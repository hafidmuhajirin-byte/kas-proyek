import {
  jakartaDayOfMonth,
  jakartaMonthRange,
  jakartaYmd,
} from "../lib/jakarta-time";

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failed += 1;
    console.error(`FAIL: ${msg}`);
  } else {
    console.log(`ok: ${msg}`);
  }
}

const sample = new Date("2026-08-20T01:00:00.000Z"); // 08:00 WIB 20 Aug
assert(jakartaYmd(sample) === "2026-08-20", "WIB ymd 20 Aug");
assert(jakartaDayOfMonth(sample) === 20, "WIB day 20");
const { start, end } = jakartaMonthRange(sample);
assert(start.toISOString() === "2026-07-31T17:00:00.000Z", "month start WIB");
assert(end.toISOString() === "2026-08-31T17:00:00.000Z", "month end WIB");

const before = new Date("2026-08-19T16:59:59.000Z"); // 23:59:59 WIB 19 Aug
assert(jakartaDayOfMonth(before) === 19, "still 19 WIB");
const after = new Date("2026-08-19T17:00:00.000Z"); // 00:00 WIB 20 Aug
assert(jakartaDayOfMonth(after) === 20, "rolls to 20 WIB");

if (failed) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log("all ok");
