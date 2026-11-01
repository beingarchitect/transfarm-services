import { DocumentData, FieldValue } from "firebase-admin/firestore";

/**
 * The `farm_subscriptions/{farmId}` record for a farm owned by [ownerId], from
 * the owner's `user_subscriptions/{uid}` record ([subscription] is undefined
 * when the owner has none, which means Free).
 *
 * Every member of a farm can read this record, so it carries only what the app
 * needs to apply limits. Purchase details stay on the owner's record; the
 * deletes clear them from records written before subscriptions moved to owners.
 *
 * No Firestore instance is used here so one-off scripts can import this before
 * initializing Admin with their own credentials.
 */
export function farmSubscriptionFor(
  farmId: string,
  ownerId: string,
  subscription: DocumentData | undefined,
): DocumentData {
  return {
    farmId,
    ownerId,
    tier: subscription?.tier ?? "free",
    status: subscription?.status ?? "active",
    expiryDate: subscription?.expiryDate ?? null,
    startDate: subscription?.startDate ?? null,
    purchaseToken: FieldValue.delete(),
    productId: FieldValue.delete(),
    autoRenew: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  };
}
