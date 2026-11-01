import * as path from "path";
import * as fs from "fs";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { DocumentData, getFirestore, Timestamp } from "firebase-admin/firestore";
import { farmSubscriptionFor } from "../features/subscriptions/farmCopy";

/**
 * One-off: moves subscriptions from farms to their owners. An owner with a
 * current paid farm gets `user_subscriptions/{uid}` from it (the longest-lasting
 * one if they have several); every farm's record is then rewritten as a copy of
 * its owner's, which also removes purchase details from it. Never overwrites an
 * existing `user_subscriptions` record. Safe to re-run.
 *
 * Pass --dry-run to only print what would change.
 */
function isCurrentPaid(subscription: DocumentData | undefined): boolean {
  if (!subscription || subscription.tier === "free") return false;
  if (subscription.status !== "active" && subscription.status !== "trial") return false;
  const expiry: Timestamp | null | undefined = subscription.expiryDate;
  return !expiry || expiry.toMillis() > Date.now();
}

/** Later expiry wins; no expiry beats any date. */
function outlasts(a: DocumentData, b: DocumentData): boolean {
  if (!b.expiryDate) return false;
  return !a.expiryDate || a.expiryDate.toMillis() > b.expiryDate.toMillis();
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const possibleKeyPaths = [
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    path.resolve(__dirname, "../../../../transfarm-app/scripts/serviceAccountKey.json"),
    path.resolve(__dirname, "../../serviceAccountKey.json"),
  ].filter((p): p is string => !!p && fs.existsSync(p));

  if (getApps().length === 0) {
    if (possibleKeyPaths.length > 0) {
      console.log(`Using service account: ${possibleKeyPaths[0]}`);
      initializeApp({ credential: cert(possibleKeyPaths[0]) });
    } else {
      console.log("Initializing Firebase Admin with default credentials...");
      initializeApp();
    }
  }

  const db = getFirestore();
  const farms = await db.collection("farms").get();
  const paidByOwner = new Map<string, DocumentData>();

  for (const farm of farms.docs) {
    const ownerId = farm.get("ownerId");
    if (!ownerId) {
      console.log(`   ! ${farm.id} has no owner, skipped`);
      continue;
    }
    const current = (await db.collection("farm_subscriptions").doc(farm.id).get()).data();
    if (!isCurrentPaid(current)) continue;
    const best = paidByOwner.get(ownerId);
    if (!best || outlasts(current!, best)) paidByOwner.set(ownerId, current!);
  }

  let ownersCreated = 0;
  for (const [ownerId, paid] of paidByOwner) {
    const ref = db.collection("user_subscriptions").doc(ownerId);
    if ((await ref.get()).exists) continue;
    console.log(`   + ${ownerId}: ${paid.tier}`);
    ownersCreated++;
    if (dryRun) continue;
    await ref.create({
      ownerId,
      tier: paid.tier,
      status: paid.status,
      expiryDate: paid.expiryDate ?? null,
      startDate: paid.startDate ?? null,
      purchaseToken: paid.purchaseToken ?? null,
      productId: paid.productId ?? null,
      autoRenew: paid.autoRenew ?? false,
      updatedAt: Timestamp.now(),
    });
  }

  let farmsUpdated = 0;
  for (const farm of farms.docs) {
    const ownerId = farm.get("ownerId");
    if (!ownerId) continue;
    const owner = (await db.collection("user_subscriptions").doc(ownerId).get()).data();
    const tier = owner?.tier ?? paidByOwner.get(ownerId)?.tier ?? "free";
    console.log(`   ~ ${farm.id} (${farm.get("name") ?? "unnamed"}): ${tier}`);
    farmsUpdated++;
    if (dryRun) continue;
    await db
      .collection("farm_subscriptions")
      .doc(farm.id)
      .set(farmSubscriptionFor(farm.id, ownerId, owner), { merge: true });
  }

  const prefix = dryRun ? "[dry run] Would create" : "Created";
  console.log(`${prefix} ${ownersCreated} owner subscriptions; ${farmsUpdated} of ${farms.size} farm records copied.`);
}

main().catch((err) => {
  console.error("Error migrating subscriptions to owners:", err);
  process.exit(1);
});
