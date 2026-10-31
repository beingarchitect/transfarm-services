import * as path from "path";
import * as fs from "fs";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

/**
 * One-off: rebuilds every farm's `memberRoles` map from its `members` array.
 * The security rules grant data access through memberRoles, which the app
 * didn't write when adding members, so earlier members had no access.
 * Safe to re-run; farms already in step are skipped.
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
  let updated = 0;

  for (const doc of farms.docs) {
    const data = doc.data();
    const members = (data.members ?? []) as { profileId: string; role: string }[];
    const memberRoles: Record<string, string> = {};
    for (const m of members) memberRoles[m.profileId] = m.role;

    const current = (data.memberRoles ?? {}) as Record<string, string>;
    const same =
      Object.keys(current).length === Object.keys(memberRoles).length &&
      Object.entries(memberRoles).every(([id, role]) => current[id] === role);
    if (same) continue;

    await doc.ref.update({ memberRoles });
    updated++;
    console.log(`   - ${doc.id} (${data.name ?? "unnamed"}): ${members.length} members`);
  }

  console.log(`memberRoles backfilled on ${updated} of ${farms.size} farms.`);
}

main().catch((err) => {
  console.error("Error backfilling memberRoles:", err);
  process.exit(1);
});
