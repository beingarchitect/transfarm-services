import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { dataGovApiKey } from "../../common/secrets";
import { getCommoditiesForState } from "./commodityService";
import { getMandiPrices } from "./service";
import { syncKarnatakaMandiPrices } from "./syncService";
import { mandiPriceQuerySchema, marketCommoditiesQuerySchema } from "./types";

/**
 * Callable function used by the Flutter app to fetch normalized mandi
 * (market) prices. Internally queries data.gov.in, preferring the
 * variety-wise dataset and transparently falling back to the legacy
 * dataset if needed.
 */
export const getMandiMarketPrices = onCall(
  { secrets: [dataGovApiKey] },
  async (request) => {
    const parsed = mandiPriceQuerySchema.safeParse(request.data ?? {});

    if (!parsed.success) {
      throw new HttpsError("invalid-argument", "Invalid mandi price query", parsed.error.flatten());
    }

    try {
      return await getMandiPrices(parsed.data, dataGovApiKey.value());
    } catch (err) {
      throw new HttpsError(
        "unavailable",
        `Failed to fetch mandi market prices: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  },
);

/**
 * Callable function used by the Flutter app to fetch the commodity list to
 * offer when a farm picks what to track, for a given state. Backed by a
 * `marketCommodities/{state}` Firestore collection (lazily seeded from a
 * bundled default catalog on first request for a state - see
 * `commodityService.ts`), rather than data.gov.in directly: the price
 * dataset has no facet/distinct-values API, and querying millions of raw
 * records per state just to list commodity names isn't practical.
 */
export const getMarketCommodities = onCall(async (request) => {
  const parsed = marketCommoditiesQuerySchema.safeParse(request.data ?? {});

  if (!parsed.success) {
    throw new HttpsError("invalid-argument", "Invalid market commodities query", parsed.error.flatten());
  }

  try {
    const { categories, commodities } = await getCommoditiesForState(parsed.data.state);
    return { categories, commodities };
  } catch (err) {
    throw new HttpsError(
      "unavailable",
      `Failed to fetch market commodities: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
});

/**
 * Scheduled cron job running daily at 6:00 PM IST (18:00) when APMC mandis
 * settle their daily arrivals and prices. Automatically populates and warms
 * the Firestore database under `mandiPrices/Karnataka/commodities/{crop}/years/{year}`.
 */
export const syncKarnatakaMandiPricesDaily = onSchedule(
  {
    schedule: "0 18 * * *",
    timeZone: "Asia/Kolkata",
    secrets: [dataGovApiKey],
  },
  async () => {
    await syncKarnatakaMandiPrices(dataGovApiKey.value());
  },
);

