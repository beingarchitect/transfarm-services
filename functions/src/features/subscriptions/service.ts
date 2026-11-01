import { DocumentData } from "firebase-admin/firestore";
import { db } from "../../common/firebaseAdmin";
import { farmSubscriptionFor } from "./farmCopy";

const FARMS_COLLECTION = "farms";
const FARM_SUBSCRIPTIONS_COLLECTION = "farm_subscriptions";
const USER_SUBSCRIPTIONS_COLLECTION = "user_subscriptions";
const BATCH_LIMIT = 500;

/** Copies an owner's subscription onto every farm they own. */
export async function syncOwnerFarms(uid: string, subscription: DocumentData | undefined): Promise<void> {
  const farms = await db.collection(FARMS_COLLECTION).where("ownerId", "==", uid).get();
  for (let i = 0; i < farms.docs.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    for (const farm of farms.docs.slice(i, i + BATCH_LIMIT)) {
      batch.set(
        db.collection(FARM_SUBSCRIPTIONS_COLLECTION).doc(farm.id),
        farmSubscriptionFor(farm.id, uid, subscription),
        { merge: true },
      );
    }
    await batch.commit();
  }
}

/** Gives a new farm its owner's current tier. */
export async function initFarmSubscription(farmId: string, ownerId: string): Promise<void> {
  const subscription = await db.collection(USER_SUBSCRIPTIONS_COLLECTION).doc(ownerId).get();
  await db
    .collection(FARM_SUBSCRIPTIONS_COLLECTION)
    .doc(farmId)
    .set(farmSubscriptionFor(farmId, ownerId, subscription.data()), { merge: true });
}
