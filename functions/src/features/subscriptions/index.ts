import { logger } from "firebase-functions/v2";
import { onDocumentCreated, onDocumentWritten } from "firebase-functions/v2/firestore";
import { initFarmSubscription, syncOwnerFarms } from "./service";

// A subscription belongs to the farm owner (`user_subscriptions/{uid}`, written
// only by the server). `farm_subscriptions/{farmId}` is a read-only copy kept in
// step by these triggers, so members can apply a farm's limits without being
// able to read the owner's purchase details. Infrequent, so no warm instance.

export const syncOwnerSubscription = onDocumentWritten(
  { document: "user_subscriptions/{uid}", minInstances: 0 },
  async (event) => {
    await syncOwnerFarms(event.params.uid, event.data?.after.data());
  },
);

export const initNewFarmSubscription = onDocumentCreated(
  { document: "farms/{farmId}", minInstances: 0 },
  async (event) => {
    const ownerId = event.data?.get("ownerId");
    if (typeof ownerId !== "string" || ownerId.length === 0) {
      logger.warn("Farm created without an owner", { farmId: event.params.farmId });
      return;
    }
    await initFarmSubscription(event.params.farmId, ownerId);
  },
);
