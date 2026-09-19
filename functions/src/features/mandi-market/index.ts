import { HttpsError, onCall } from "firebase-functions/v2/https";
import { dataGovApiKey } from "../../common/secrets";
import { getMandiPrices } from "./service";
import { mandiPriceQuerySchema } from "./types";

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
