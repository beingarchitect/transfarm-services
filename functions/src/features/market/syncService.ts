import { logger } from "firebase-functions";
import { db } from "../../common/firebaseAdmin";
import { DEFAULT_RECORD_LIMIT } from "./constants";
import { getMandiPrices } from "./service";

/**
 * Discovers all unique commodities currently tracked by Karnataka farms,
 * ensuring the daily scheduled job only fetches data farmers actually care about.
 * Falls back to key Karnataka staple crops if no farms have configured tracking.
 */
export async function getTrackedCommoditiesForKarnataka(): Promise<string[]> {
  const trackedSet = new Set<string>();

  try {
    const farmsSnapshot = await db
      .collection("farms")
      .where("isActive", "==", true)
      .get();

    for (const doc of farmsSnapshot.docs) {
      const data = doc.data();
      const state = (data.state as string | undefined)?.toLowerCase();
      if (state && (state.includes("karnataka") || state === "ka")) {
        const commodities = data.trackedCommodities as string[] | undefined;
        if (Array.isArray(commodities)) {
          for (const c of commodities) {
            if (c && c.trim()) {
              trackedSet.add(c.trim());
            }
          }
        }
      }
    }
  } catch (err) {
    logger.warn("Failed to query tracked commodities from farms collection", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Ensure high-priority Karnataka staples are always kept warm
  const defaults = ["Ragi(Finger Millet)", "Paddy(Dhan)", "Maize", "Tomato", "Onion"];
  for (const item of defaults) {
    trackedSet.add(item);
  }

  return Array.from(trackedSet);
}

/**
 * Runs the daily ingestion for Karnataka APMC mandis.
 * Iterates through active commodities and triggers a live fetch & Firestore save.
 */
export async function syncKarnatakaMandiPrices(apiKey: string): Promise<{ synced: string[]; errors: string[] }> {
  const commodities = await getTrackedCommoditiesForKarnataka();
  logger.info(`Starting daily Karnataka mandi price sync for ${commodities.length} commodities`, { commodities });

  const synced: string[] = [];
  const errors: string[] = [];

  for (const commodity of commodities) {
    try {
      // Force refresh live data to pull today's latest arrivals
      const result = await getMandiPrices(
        {
          state: "Karnataka",
          commodity,
          limit: DEFAULT_RECORD_LIMIT,
          offset: 0,
        },
        apiKey,
      );

      logger.info(`Synced ${result.records.length} records for Karnataka/${commodity} (source: ${result.source})`);
      synced.push(commodity);
    } catch (err) {
      logger.error(`Failed to sync mandi prices for Karnataka/${commodity}`, {
        error: err instanceof Error ? err.message : String(err),
      });
      errors.push(commodity);
    }
  }

  return { synced, errors };
}
