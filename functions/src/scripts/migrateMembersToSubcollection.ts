import * as path from "path";
import * as fs from "fs";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

/**
 * One-off: moves farm membership from the farm document (`members` array +
 * `memberRoles` map) to `farms/{farmId}/members/{profileId}` documents, and
 * gives every owner a member document with role "owner". Then removes the
 * old fields from the farm document.
 *
 * Safe to re-run: existing member documents are left as they are.
 * Pass --dry-run to only print what would change.
 */
interface LegacyMember {
  profileId: string;
  role: string;
  addedAt?: string;
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
  let created = 0;

  for (const farm of farms.docs) {
    const data = farm.data();
    const ownerId = data.ownerId as string | undefined;
    const legacy = ((data.members ?? []) as LegacyMember[]).filter((m) => m.profileId && m.profileId !== ownerId);

    const wanted: LegacyMember[] = [
      ...(ownerId ? [{ profileId: ownerId, role: "owner", addedAt: data.createdAt as string }] : []),
      ...legacy,
    ];

    const batch = db.batch();
    const added: string[] = [];
    for (const m of wanted) {
      const ref = farm.ref.collection("members").doc(m.profileId);
      if ((await ref.get()).exists) continue;
      batch.set(ref, {
        profileId: m.profileId,
        farmId: farm.id,
        role: m.role,
        addedAt: m.addedAt ?? new Date().toISOString(),
      });
      added.push(`${m.profileId.slice(0, 8)}…=${m.role}`);
    }
    const hasLegacyFields = data.members !== undefined || data.memberRoles !== undefined;
    if (hasLegacyFields) {
      batch.update(farm.ref, { members: FieldValue.delete(), memberRoles: FieldValue.delete() });
    }
    if (added.length === 0 && !hasLegacyFields) continue;

    console.log(
      `   - ${farm.id} (${data.name ?? "unnamed"}): +${added.length} [${added.join(", ")}]` +
        (hasLegacyFields ? ", old fields removed" : ""),
    );
    created += added.length;
    if (!dryRun) await batch.commit();
  }

  console.log(
    `${dryRun ? "[dry run] Would create" : "Created"} ${created} member documents across ${farms.size} farms.`,
  );
}

main().catch((err) => {
  console.error("Error migrating members:", err);
  process.exit(1);
});
