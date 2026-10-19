import { logger } from "firebase-functions";
import { db } from "../../common/firebaseAdmin";
import { fetchJson } from "../../common/httpClient";
import { OPEN_METEO_BASE_URL } from "../weather/constants";

export const RAINFALL_COLLECTION = "rainfall_records";

/** Days re-fetched on every run: the model revises recent days, and this
 * also back-fills after a missed run. */
const ROUTINE_PAST_DAYS = 7;

/** First run for a farm: as much history as the forecast API offers. */
const BACKFILL_PAST_DAYS = 92;

/** Open-Meteo accepts comma-separated coordinate lists; keep URLs short. */
const LOCATIONS_PER_REQUEST = 50;

interface FarmLocation {
  farmId: string;
  latitude: number;
  longitude: number;
}

interface OpenMeteoDailyRain {
  daily?: {
    time?: string[];
    precipitation_sum?: (number | null)[];
  };
}

export interface DailyRain {
  date: string;
  mm: number;
}

/**
 * Completed days only: with forecast_days=1 the last entry is today, which
 * is still in progress. Missing values are skipped, not stored as 0, so a
 * gap never reads as "it was dry".
 */
export function extractCompletedDays(response: OpenMeteoDailyRain): DailyRain[] {
  const times = response.daily?.time ?? [];
  const sums = response.daily?.precipitation_sum ?? [];
  const days: DailyRain[] = [];
  for (let i = 0; i < times.length - 1; i++) {
    const mm = sums[i];
    if (typeof mm === "number" && Number.isFinite(mm) && mm >= 0) {
      days.push({ date: times[i], mm: Math.round(mm * 10) / 10 });
    }
  }
  return days;
}

/** One Open-Meteo call for many farms. The API returns a bare object for a
 * single location and an array for several. */
async function fetchDailyRain(
  farms: FarmLocation[],
  pastDays: number,
): Promise<Map<string, DailyRain[]>> {
  const url = new URL(`${OPEN_METEO_BASE_URL}/forecast`);
  url.searchParams.set("latitude", farms.map((f) => f.latitude).join(","));
  url.searchParams.set("longitude", farms.map((f) => f.longitude).join(","));
  url.searchParams.set("daily", "precipitation_sum");
  // Each farm's own local day boundaries.
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("past_days", String(pastDays));
  url.searchParams.set("forecast_days", "1");

  const raw = await fetchJson<OpenMeteoDailyRain | OpenMeteoDailyRain[]>(
    url.toString(),
    { timeoutMs: 20000 },
  );
  const responses = Array.isArray(raw) ? raw : [raw];

  const result = new Map<string, DailyRain[]>();
  farms.forEach((farm, i) => {
    if (responses[i]) result.set(farm.farmId, extractCompletedDays(responses[i]));
  });
  return result;
}

async function loadFarmLocations(): Promise<FarmLocation[]> {
  // Not filtered on isActive in the query: older farm docs may lack the
  // field (the app treats missing as active), and an equality filter would
  // silently skip them.
  const snapshot = await db.collection("farms").get();
  const farms: FarmLocation[] = [];
  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data.isActive === false) continue;
    const { latitude, longitude } = data;
    if (
      typeof latitude === "number" &&
      typeof longitude === "number" &&
      Math.abs(latitude) <= 90 &&
      Math.abs(longitude) <= 180
    ) {
      farms.push({ farmId: doc.id, latitude, longitude });
    }
  }
  return farms;
}

async function hasAnyRecord(farmId: string): Promise<boolean> {
  const snapshot = await db
    .collection(RAINFALL_COLLECTION)
    .where("farmId", "==", farmId)
    .limit(1)
    .get();
  return !snapshot.empty;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

/**
 * Records the weather-model rainfall estimate for every farm with a
 * location. Writes only the `estimated*` fields with merge, so a farmer's
 * own reading (`observed*`, written by the app) is never overwritten.
 */
export async function recordRainfallForAllFarms(): Promise<{
  farms: number;
  daysWritten: number;
  failedBatches: number;
}> {
  const farms = await loadFarmLocations();
  const hasHistory = await Promise.all(farms.map((f) => hasAnyRecord(f.farmId)));
  const routine = farms.filter((_, i) => hasHistory[i]);
  const backfill = farms.filter((_, i) => !hasHistory[i]);
  logger.info("Recording daily rainfall", {
    farms: farms.length,
    backfill: backfill.length,
  });

  const writer = db.bulkWriter();
  const now = new Date().toISOString();
  let daysWritten = 0;
  let failedBatches = 0;

  const batches: [FarmLocation[], number][] = [
    ...chunk(routine, LOCATIONS_PER_REQUEST).map((b) => [b, ROUTINE_PAST_DAYS] as [FarmLocation[], number]),
    ...chunk(backfill, LOCATIONS_PER_REQUEST).map((b) => [b, BACKFILL_PAST_DAYS] as [FarmLocation[], number]),
  ];

  for (const [batch, pastDays] of batches) {
    let rainByFarm: Map<string, DailyRain[]>;
    try {
      rainByFarm = await fetchDailyRain(batch, pastDays);
    } catch (err) {
      // One failed batch shouldn't stop the others; tomorrow's run re-fetches
      // the last 7 days anyway.
      failedBatches++;
      logger.warn("Open-Meteo rainfall batch failed", {
        farms: batch.length,
        error: err instanceof Error ? err.message : String(err),
      });
      continue;
    }

    for (const [farmId, days] of rainByFarm) {
      for (const day of days) {
        writer.set(
          db.collection(RAINFALL_COLLECTION).doc(`${farmId}_${day.date}`),
          {
            farmId,
            date: day.date,
            estimatedMm: day.mm,
            estimatedAt: now,
            estimateSource: "open-meteo",
          },
          { merge: true },
        );
        daysWritten++;
      }
    }
  }

  await writer.close();
  logger.info("Daily rainfall recorded", { farms: farms.length, daysWritten, failedBatches });
  return { farms: farms.length, daysWritten, failedBatches };
}
