import { logger } from "firebase-functions/v2";
import { db } from "../../common/firebaseAdmin";
import {
  buildDefaultDocs,
  DEFAULT_FARM_LISTS,
  FARM_LIST_DOCS,
  FarmListItem,
  farmListDocSchema,
  FarmLists,
  Language,
} from "./defaults";

const FARMS_COLLECTION = "farms";
const MASTER_DATA_COLLECTION = "masterData";

/** Falls back to the built-in copy for this list only, so a new farm still gets it. */
async function loadList(list: keyof FarmLists): Promise<FarmListItem[]> {
  const docId = FARM_LIST_DOCS[list];
  try {
    const doc = await db.collection(MASTER_DATA_COLLECTION).doc(docId).get();
    const parsed = farmListDocSchema.safeParse(doc.data());
    if (parsed.success) return parsed.data.categories;
    logger.warn("Default list missing or invalid; using built-in list", { docId });
  } catch (e) {
    logger.warn("Could not read default list; using built-in list", { docId, error: e });
  }
  return DEFAULT_FARM_LISTS[list];
}

async function loadLists(): Promise<FarmLists> {
  const [expenseCategories, incomeCategories, inventoryCategories, contactRoles] = await Promise.all([
    loadList("expenseCategories"),
    loadList("incomeCategories"),
    loadList("inventoryCategories"),
    loadList("contactRoles"),
  ]);
  return { expenseCategories, incomeCategories, inventoryCategories, contactRoles };
}

/**
 * Adds the default categories and contact roles to a new farm. Triggers can
 * run more than once, so `defaultsSeededAt` is set in the same transaction: a
 * rerun can't bring back something the user has since renamed or deleted.
 */
export async function seedFarmDefaults(farmId: string, language: Language): Promise<void> {
  const lists = await loadLists();
  const farmRef = db.collection(FARMS_COLLECTION).doc(farmId);

  await db.runTransaction(async (tx) => {
    const farm = await tx.get(farmRef);
    if (!farm.exists || farm.get("defaultsSeededAt")) return;

    const now = new Date();
    for (const { subcollection, id, data } of buildDefaultDocs(farmId, language, lists, now)) {
      tx.set(farmRef.collection(subcollection).doc(id), data);
    }
    tx.update(farmRef, { defaultsSeededAt: now.toISOString() });
  });
}
