import { logger } from "firebase-functions";
import { db } from "../../common/firebaseAdmin";
import { DEFAULT_COMMODITY_CATALOG, flattenDefaultCatalog } from "./commodityCatalog";

const COLLECTION = "marketCommodities";

export interface MarketCommoditiesDoc {
  categories: Record<string, string[]>;
  commodities: string[];
  updatedAt: string;
}

/**
 * Returns the list of commodities and categorized mapping for a given state,
 * backed by a `marketCommodities/{state}` Firestore document.
 *
 * On first request for a state, the document doesn't exist yet, so this
 * lazily seeds it from the bundled default catalog and returns that. If an
 * older document exists with only flat commodities, it seamlessly enriches it
 * with categories.
 */
export async function getCommoditiesForState(
  state: string,
): Promise<{ categories: Record<string, string[]>; commodities: string[] }> {
  const docId = state.trim();
  const docRef = db.collection(COLLECTION).doc(docId);
  const snapshot = await docRef.get();

  if (snapshot.exists) {
    const data = snapshot.data() as Partial<MarketCommoditiesDoc> | undefined;
    if (data?.categories && Object.keys(data.categories).length > 0) {
      return {
        categories: data.categories,
        commodities: data.commodities ?? Object.values(data.categories).flat().sort(),
      };
    }

    // Upgrade existing doc that only has flat commodities array
    logger.info(`Enriching existing market commodity catalog with categories for state "${docId}"`);
    const categories = DEFAULT_COMMODITY_CATALOG;
    const commodities = data?.commodities?.length ? data.commodities : flattenDefaultCatalog();

    await docRef.set(
      {
        categories,
        commodities,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );

    return { categories, commodities };
  }

  logger.info(`Seeding default market commodity catalog for state "${docId}"`);
  const categories = DEFAULT_COMMODITY_CATALOG;
  const commodities = flattenDefaultCatalog();

  await docRef.set({
    categories,
    commodities,
    updatedAt: new Date().toISOString(),
  } satisfies MarketCommoditiesDoc);

  return { categories, commodities };
}

