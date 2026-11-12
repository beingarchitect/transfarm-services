import assert from "node:assert/strict";
import { test } from "node:test";
import { bestMandiQuote } from "./bestMandi";

const p = (market: string, arrivalDate: string, modalPrice: number | null) => ({
  market,
  arrivalDate,
  modalPrice,
});

test("highest of each mandi's newest price", () => {
  const best = bestMandiQuote([
    p("Mandya APMC", "04/11/2026", 3800),
    p("Mysuru APMC", "03/11/2026", 3600),
    p("Bengaluru APMC", "02/11/2026", 4100),
  ]);
  assert.equal(best?.market, "Bengaluru APMC");
});

test("a mandi's older, higher price doesn't count", () => {
  const best = bestMandiQuote([
    p("Mandya APMC", "04/11/2026", 3800),
    p("Mysuru APMC", "04/11/2026", 3600),
    p("Mysuru APMC", "28/10/2026", 4500),
  ]);
  assert.equal(best?.market, "Mandya APMC");
});

test("mandis over 2 weeks behind the newest are left out", () => {
  const best = bestMandiQuote([
    p("Mandya APMC", "04/11/2026", 3800),
    p("Kolar APMC", "01/09/2026", 9999),
  ]);
  assert.equal(best?.market, "Mandya APMC");
});

test("same price: the more recent report wins, whatever the order", () => {
  const koppa = p("Koppa APMC", "10/11/2026", 45000);
  const belthangady = p("Belthangady APMC", "03/11/2026", 45000);
  assert.equal(bestMandiQuote([belthangady, koppa])?.market, "Koppa APMC");
  assert.equal(bestMandiQuote([koppa, belthangady])?.market, "Koppa APMC");
});

test("same price and date: by name", () => {
  const best = bestMandiQuote([p("Sirsi APMC", "10/11/2026", 45000), p("Koppa APMC", "10/11/2026", 45000)]);
  assert.equal(best?.market, "Koppa APMC");
});

test("skips missing prices and unreadable dates; null when nothing is usable", () => {
  assert.equal(
    bestMandiQuote([
      p("Mandya APMC", "04/11/2026", 3800),
      p("Mysuru APMC", "04/11/2026", null),
      p("Kolar APMC", "not a date", 9999),
    ])?.market,
    "Mandya APMC",
  );
  assert.equal(bestMandiQuote([p("Mysuru APMC", "04/11/2026", null)]), null);
  assert.equal(bestMandiQuote([]), null);
});
