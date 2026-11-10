// No Admin SDK here, so tests can import it.

/**
 * DD/MM/YYYY as a sortable number (UTC ms); unparsable dates sort as 0, so
 * they end up last when newest-first.
 */
export function arrivalDateMs(arrivalDate: string): number {
  const parts = arrivalDate.trim().split("/");
  if (parts.length !== 3) return 0;
  const [d, m, y] = parts.map((p) => parseInt(p, 10));
  if ([d, m, y].some((n) => isNaN(n))) return 0;
  return Date.UTC(y, m - 1, d);
}

/**
 * Records newest first, by real date. Stored records are in merge order and
 * data.gov.in "sorts" its DD/MM/YYYY strings as text, so neither can be
 * trusted to be in date order: everything that serves prices sorts with this.
 */
export function newestFirst<T extends { arrivalDate: string }>(records: T[]): T[] {
  return [...records].sort((a, b) => arrivalDateMs(b.arrivalDate) - arrivalDateMs(a.arrivalDate));
}
