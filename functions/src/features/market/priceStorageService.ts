import { db } from "../../common/firebaseAdmin";
import { findCategoryForCommodity } from "./commodityCatalog";
import { NormalizedMandiPrice } from "./types";

const ROOT_COLLECTION = "mandiPrices";

export interface MandiYearRecordDoc {
  state: string;
  commodity: string;
  category: string | null;
  year: number;
  updatedAt: string;
  recordCount: number;
  records: NormalizedMandiPrice[];
}

/**
 * Escapes characters that are illegal in Firestore document IDs, particularly
 * forward slash ('/'), which Firestore treats as a path separator.
 */
export function sanitizeDocId(id: string): string {
  return encodeURIComponent(id.trim());
}

/**
 * Parses arrival date string in DD/MM/YYYY format and returns the year,
 * or the current year if unparsable.
 */
export function extractYearFromArrivalDate(arrivalDate: string): number {
  const parts = arrivalDate.split("/");
  if (parts.length === 3) {
    const y = parseInt(parts[2], 10);
    if (!isNaN(y) && y > 2000 && y < 2100) {
      return y;
    }
  }
  return new Date().getFullYear();
}

/**
 * Generates a unique deduplication key for a mandi price record.
 */
function recordDedupeKey(r: NormalizedMandiPrice): string {
  return `${r.market.trim()}|${r.arrivalDate.trim()}|${r.variety.trim()}|${(r.grade ?? "").trim()}`;
}

/**
 * Reads cached mandi price records from Firestore under the structured path:
 * `mandiPrices/{state}/commodities/{commodity}/years/{year}`
 *
 * Defaults to current and previous year for 2-year history.
 */
export async function getStoredMandiPrices(
  state: string,
  commodity: string,
  years: number[] = [new Date().getFullYear(), new Date().getFullYear() - 1],
): Promise<{ records: NormalizedMandiPrice[]; updatedAt: string | null; isFresh: boolean }> {
  const stateDoc = sanitizeDocId(state);
  const commodityDoc = sanitizeDocId(commodity);
  const currentYear = new Date().getFullYear();

  const commodityDocRef = db
    .collection(ROOT_COLLECTION)
    .doc(stateDoc)
    .collection("commodities")
    .doc(commodityDoc);

  const yearDocs = await Promise.all(
    years.map((year) =>
      commodityDocRef
        .collection("years")
        .doc(String(year))
        .get(),
    ),
  );

  const allRecords: NormalizedMandiPrice[] = [];
  let latestUpdatedAt: string | null = null;
  let hasCurrentYear = false;

  for (const doc of yearDocs) {
    if (doc.exists) {
      const data = doc.data() as MandiYearRecordDoc | undefined;
      if (data?.records && Array.isArray(data.records)) {
        allRecords.push(...data.records);
        if (data.year === currentYear && data.records.length > 0) {
          hasCurrentYear = true;
        }
        if (data.updatedAt) {
          if (!latestUpdatedAt || data.updatedAt > latestUpdatedAt) {
            latestUpdatedAt = data.updatedAt;
          }
        }
      }
    }
  }

  // Cache is fresh ONLY if we have records for the current year AND it was updated within the last 12 hours
  let isFresh = false;
  if (hasCurrentYear && latestUpdatedAt) {
    const ageMs = Date.now() - new Date(latestUpdatedAt).getTime();
    const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
    isFresh = ageMs < TWELVE_HOURS_MS;
  }

  return { records: allRecords, updatedAt: latestUpdatedAt, isFresh };
}

/**
 * Saves and merges newly fetched mandi price records into the structured
 * Firestore collection `mandiPrices/{state}/commodities/{commodity}/years/{year}`.
 * Deduplicates with existing records and updates the metadata on parent documents.
 */
export async function saveMandiPricesToStorage(
  state: string,
  commodity: string,
  newRecords: NormalizedMandiPrice[],
): Promise<void> {
  if (newRecords.length === 0) return;

  const stateDoc = sanitizeDocId(state);
  const commodityDoc = sanitizeDocId(commodity);
  const category = findCategoryForCommodity(commodity);

  // Group new records by year
  const recordsByYear = new Map<number, NormalizedMandiPrice[]>();
  for (const record of newRecords) {
    const recordWithCategory = {
      ...record,
      category: record.category ?? category,
    };
    const year = extractYearFromArrivalDate(record.arrivalDate);
    const existing = recordsByYear.get(year) ?? [];
    existing.push(recordWithCategory);
    recordsByYear.set(year, existing);
  }

  const nowIso = new Date().toISOString();

  // 1. Update state parent doc
  await db
    .collection(ROOT_COLLECTION)
    .doc(stateDoc)
    .set(
      {
        state,
        lastSyncedAt: nowIso,
      },
      { merge: true },
    );

  // 2. Update commodity parent doc with category and sync timestamp
  const commodityDocRef = db
    .collection(ROOT_COLLECTION)
    .doc(stateDoc)
    .collection("commodities")
    .doc(commodityDoc);

  await commodityDocRef.set(
    {
      state,
      commodity,
      category,
      lastSyncedAt: nowIso,
    },
    { merge: true },
  );

  // 3. For each year, save under mandiPrices/{state}/commodities/{commodity}/years/{year}
  for (const [year, yearNewRecords] of recordsByYear.entries()) {
    const yearDocRef = commodityDocRef
      .collection("years")
      .doc(String(year));

    const existingDoc = await yearDocRef.get();
    const existingData = existingDoc.data() as MandiYearRecordDoc | undefined;
    const existingRecords = existingData?.records ?? [];

    // Merge by dedupe key
    const recordsMap = new Map<string, NormalizedMandiPrice>();
    for (const r of existingRecords) {
      recordsMap.set(recordDedupeKey(r), r);
    }
    for (const r of yearNewRecords) {
      recordsMap.set(recordDedupeKey(r), r);
    }

    const mergedRecords = Array.from(recordsMap.values());

    const docPayload: MandiYearRecordDoc = {
      state,
      commodity,
      category,
      year,
      updatedAt: nowIso,
      recordCount: mergedRecords.length,
      records: mergedRecords,
    };

    await yearDocRef.set(docPayload, { merge: true });
  }
}
