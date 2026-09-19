import { FallbackRawRecord, NormalizedMandiPrice, PrimaryRawRecord } from "./types";

function toNumberOrNull(value: string | number | undefined): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : null;
}

function toStringOrEmpty(value: string | undefined): string {
  return value?.trim() ?? "";
}

export function normalizePrimaryRecord(raw: PrimaryRawRecord): NormalizedMandiPrice {
  return {
    state: toStringOrEmpty(raw.State),
    district: toStringOrEmpty(raw.District),
    market: toStringOrEmpty(raw.Market),
    commodity: toStringOrEmpty(raw.Commodity),
    variety: toStringOrEmpty(raw.Variety),
    grade: raw.Grade?.trim() || null,
    minPrice: toNumberOrNull(raw.Min_Price),
    maxPrice: toNumberOrNull(raw.Max_Price),
    modalPrice: toNumberOrNull(raw.Modal_Price),
    arrivalDate: toStringOrEmpty(raw.Arrival_Date),
  };
}

export function normalizeFallbackRecord(raw: FallbackRawRecord): NormalizedMandiPrice {
  return {
    state: toStringOrEmpty(raw.state),
    district: toStringOrEmpty(raw.district),
    market: toStringOrEmpty(raw.market),
    commodity: toStringOrEmpty(raw.commodity),
    variety: toStringOrEmpty(raw.variety),
    grade: raw.grade?.trim() || null,
    minPrice: toNumberOrNull(raw.min_price),
    maxPrice: toNumberOrNull(raw.max_price),
    modalPrice: toNumberOrNull(raw.modal_price),
    arrivalDate: toStringOrEmpty(raw.arrival_date),
  };
}
