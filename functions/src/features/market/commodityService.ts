import { logger } from "firebase-functions";
import { db } from "../../common/firebaseAdmin";
import { DEFAULT_COMMODITY_CATALOG, flattenDefaultCatalog } from "./commodityCatalog";
import { getKarnatakaMarkets, KARNATAKA_MARKETS_BY_DISTRICT } from "./marketCatalog";

const COLLECTION = "marketCommodities";

export interface MarketCommoditiesDoc {
  categories: Record<string, string[]>;
  commodities: string[];
  markets?: string[];
  marketsByDistrict?: Record<string, string[]>;
  updatedAt: string;
}

export interface MarketCommoditiesResult {
  categories: Record<string, string[]>;
  commodities: string[];
  markets: string[];
  marketsByDistrict: Record<string, string[]>;
}

/**
 * Returns the list of commodities, categorized mapping, and APMC mandi markets
 * for a given state, backed by a `marketCommodities/{state}` Firestore document.
 *
 * Lazily seeds or enriches with APMC markets if missing.
 */
export async function getCommoditiesForState(state: string): Promise<MarketCommoditiesResult> {
  const docId = state.trim();
  const docRef = db.collection(COLLECTION).doc(docId);
  const snapshot = await docRef.get();

  const isKarnataka = docId.toLowerCase() === "karnataka" || docId.toLowerCase() === "ka";
  const defaultMarkets = isKarnataka ? getKarnatakaMarkets() : [];
  const defaultMarketsByDistrict = isKarnataka ? KARNATAKA_MARKETS_BY_DISTRICT : {};

  if (snapshot.exists) {
    const data = snapshot.data() as Partial<MarketCommoditiesDoc> | undefined;
    const hasCategories = data?.categories && Object.keys(data.categories).length > 0;
    const hasMarkets = data?.markets && data.markets.length > 0;

    const categories = hasCategories ? data!.categories! : DEFAULT_COMMODITY_CATALOG;
    const commodities = data?.commodities?.length
      ? data.commodities
      : (hasCategories ? Object.values(categories).flat().sort() : flattenDefaultCatalog());
    const markets = hasMarkets ? data!.markets! : defaultMarkets;
    const marketsByDistrict = data?.marketsByDistrict ?? defaultMarketsByDistrict;

    if (!hasCategories || !hasMarkets) {
      logger.info(`Enriching marketCommodities/${docId} with missing categories or markets`);
      await docRef.set(
        {
          categories,
          commodities,
          markets,
          marketsByDistrict,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
    }

    return { categories, commodities, markets, marketsByDistrict };
  }

  logger.info(`Seeding default market commodity & market catalog for state "${docId}"`);
  const categories = DEFAULT_COMMODITY_CATALOG;
  const commodities = flattenDefaultCatalog();
  const markets = defaultMarkets;
  const marketsByDistrict = defaultMarketsByDistrict;

  await docRef.set({
    categories,
    commodities,
    markets,
    marketsByDistrict,
    updatedAt: new Date().toISOString(),
  } satisfies MarketCommoditiesDoc);

  return { categories, commodities, markets, marketsByDistrict };
}

