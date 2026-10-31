import * as path from "path";
import * as fs from "fs";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";

/**
 * One-off: creates the Free `farm_subscriptions/{farmId}` record for farms
 * that don't have one. The app only started creating it on farm creation
 * later; until then it treated a missing record as Free in memory. Never
 * touches an existing record. Safe to re-run.
 */
async function main() {
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
  let created = 0;

  for (const farm of farms.docs) {
    const ref = db.collection("farm_subscriptions").doc(farm.id);
    if ((await ref.get()).exists) continue;

    // Same shape the app writes (FarmSubscriptionModel.toFirestore).
    await ref.create({
      farmId: farm.id,
      ownerId: farm.get("ownerId") ?? "",
      tier: "free",
      status: "active",
      expiryDate: null,
      startDate: Timestamp.now(),
      purchaseToken: null,
      productId: null,
      autoRenew: false,
      updatedAt: FieldValue.serverTimestamp(),
    });
    created++;
    console.log(`   - ${farm.id} (${farm.get("name") ?? "unnamed"})`);
  }

  console.log(`Created Free subscriptions for ${created} of ${farms.size} farms.`);
}

main().catch((err) => {
  console.error("Error backfilling farm subscriptions:", err);
  process.exit(1);
});
