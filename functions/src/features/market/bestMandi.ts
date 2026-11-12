// No Admin SDK here, so tests can import it.
import { arrivalDateMs } from "./arrivalDate";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Where the commodity sells best right now: each mandi's newest price, among
 * mandis that reported within [withinDays] of the newest price anywhere, and
 * the one with the highest modal price of those. Older prices are left out:
 * a price from two months ago says little about where to sell today.
 *
 * Same rule as the app's mandi comparison (`latestQuotePerMandi`), so the
 * card's best rate is always the top row of the comparison.
 */
export function bestMandiQuote<
  T extends { market: string; arrivalDate: string; modalPrice: number | null },
>(records: T[], withinDays = 14): T | null {
  const byMandi = new Map<string, { record: T; ms: number }>();
  let newest = 0;
  for (const r of records) {
    if (r.modalPrice === null || r.market.trim() === "") continue;
    const ms = arrivalDateMs(r.arrivalDate);
    if (ms === 0) continue;
    if (ms > newest) newest = ms;
    const key = r.market.trim().toLowerCase();
    const existing = byMandi.get(key);
    if (!existing || ms > existing.ms) byMandi.set(key, { record: r, ms });
  }
  const cutoff = newest - withinDays * DAY_MS;
  // Same order as the app's comparison: highest price, then the more recent
  // report, then by name - so ties never depend on the records' order.
  let best: { record: T; ms: number } | null = null;
  for (const quote of byMandi.values()) {
    if (quote.ms < cutoff) continue;
    if (!best || beats(quote, best)) best = quote;
  }
  return best?.record ?? null;
}

function beats<T extends { market: string; modalPrice: number | null }>(
  a: { record: T; ms: number },
  b: { record: T; ms: number },
): boolean {
  if (a.record.modalPrice! !== b.record.modalPrice!) return a.record.modalPrice! > b.record.modalPrice!;
  if (a.ms !== b.ms) return a.ms > b.ms;
  return a.record.market.toLowerCase() < b.record.market.toLowerCase();
}
