import { logger } from "firebase-functions";
import { db } from "../../common/firebaseAdmin";
import { flattenDefaultCatalog } from "./commodityCatalog";

const COLLECTION = "marketCommodities";

interface MarketCommoditiesDoc {
  commodities: string[];
  updatedAt: string;
}

/**
 * Returns the list of commodities to show for a given state, backed by a
 * `marketCommodities/{state}` Firestore collection.
 *
 * On first request for a state, the document doesn't exist yet, so this
 * lazily seeds it from the bundled default catalog and returns that. On
 * later requests, whatever's stored in Firestore is returned as-is - so
 * the list can be curated per state directly in the Firestore console
 * (e.g. removing commodities that aren't actually traded in that state)
 * without needing an app or Cloud Function release.
 */
export async function getCommoditiesForState(state: string): Promise<string[]> {
  const docId = state.trim();
  const docRef = db.collection(COLLECTION).doc(docId);
  const snapshot = await docRef.get();

  if (snapshot.exists) {
    const data = snapshot.data() as MarketCommoditiesDoc | undefined;
    if (data?.commodities?.length) {
      return data.commodities;
    }
  }

  logger.info(`Seeding default market commodity catalog for state "${docId}"`);
  const defaultCommodities = flattenDefaultCatalog();

  await docRef.set({
    commodities: defaultCommodities,
    updatedAt: new Date().toISOString(),
  } satisfies MarketCommoditiesDoc);

  return defaultCommodities;
}
