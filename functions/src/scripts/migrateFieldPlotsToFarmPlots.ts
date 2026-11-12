import * as path from "path";
import * as fs from "fs";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

/**
 * One-off: renames the `field_plots` collection to `farm_plots`, keeping
 * every document ID so records that point at a plot (`plotId` on irrigation
 * logs, soil tests, crops) stay valid. Each copy and its delete go in one
 * batch, so a plot is never in both or neither.
 *
 * Also drops the old top-level `plot_terrain` cache. Terrain now lives at
 * `farm_plots/{plotId}/terrain/current` and is rebuilt the first time a
 * plot's terrain is opened, so it isn't copied.
 *
 * Safe to re-run: a plot already in `farm_plots` is left alone (and its old
 * copy kept and reported, so nothing is lost). Pass --dry-run to only print
 * what would change.
 */
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

  const plots = await db.collection("field_plots").get();
  let moved = 0;
  const conflicts: string[] = [];
  for (const plot of plots.docs) {
    const target = db.collection("farm_plots").doc(plot.id);
    if ((await target.get()).exists) {
      conflicts.push(plot.id);
      continue;
    }
    console.log(`   - ${plot.id} (${plot.get("name") ?? "unnamed"}, farm ${plot.get("farmId")})`);
    moved++;
    if (dryRun) continue;
    const batch = db.batch();
    batch.set(target, plot.data());
    batch.delete(plot.ref);
    await batch.commit();
  }

  const terrain = await db.collection("plot_terrain").get();
  if (!dryRun) {
    for (let i = 0; i < terrain.docs.length; i += 400) {
      const batch = db.batch();
      terrain.docs.slice(i, i + 400).forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }
  }

  const verb = dryRun ? "[dry run] Would move" : "Moved";
  console.log(`${verb} ${moved} of ${plots.size} plots to farm_plots.`);
  console.log(`${dryRun ? "[dry run] Would delete" : "Deleted"} ${terrain.size} plot_terrain cache documents.`);
  if (conflicts.length > 0) {
    console.log(`Already in farm_plots, old copy kept for review: ${conflicts.join(", ")}`);
  }
}

main().catch((err) => {
  console.error("Error migrating plots:", err);
  process.exit(1);
});
