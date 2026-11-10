import assert from "node:assert/strict";
import { test } from "node:test";
import { arrivalDateMs, newestFirst } from "./arrivalDate";

const r = (arrivalDate: string) => ({ arrivalDate });

test("sorts by real date, not as text", () => {
  // As text, "18/09/2026" > "05/11/2026" - which is how the newest
  // prices went missing from the market cards.
  const sorted = newestFirst([r("18/09/2026"), r("05/11/2026"), r("23/10/2026"), r("31/12/2025")]);
  assert.deepEqual(
    sorted.map((x) => x.arrivalDate),
    ["05/11/2026", "23/10/2026", "18/09/2026", "31/12/2025"],
  );
});

test("unreadable dates go last and nothing is lost", () => {
  const sorted = newestFirst([r(""), r("01/01/2026"), r("not a date")]);
  assert.equal(sorted[0].arrivalDate, "01/01/2026");
  assert.equal(sorted.length, 3);
  assert.equal(arrivalDateMs("2026-01-01"), 0);
});

test("does not change the list it was given", () => {
  const input = [r("01/01/2025"), r("01/01/2026")];
  newestFirst(input);
  assert.equal(input[0].arrivalDate, "01/01/2025");
});
