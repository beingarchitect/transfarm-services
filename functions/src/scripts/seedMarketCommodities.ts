import * as path from "path";
import * as fs from "fs";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { DEFAULT_COMMODITY_CATALOG, flattenDefaultCatalog } from "../features/market/commodityCatalog";
import { getKarnatakaMarkets, KARNATAKA_MARKETS_BY_DISTRICT } from "../features/market/marketCatalog";

async function main() {
  // 1. Locate serviceAccountKey.json if present
  const possibleKeyPaths = [
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    path.resolve(__dirname, "../../../../transfarm-app/scripts/serviceAccountKey.json"),
    path.resolve(__dirname, "../../serviceAccountKey.json"),
    path.resolve(process.cwd(), "serviceAccountKey.json"),
  ].filter((p): p is string => !!p && fs.existsSync(p));

  if (getApps().length === 0) {
    if (possibleKeyPaths.length > 0) {
      console.log(`Using service account from: ${possibleKeyPaths[0]}`);
      initializeApp({
        credential: cert(possibleKeyPaths[0]),
      });
    } else {
      console.log("Initializing Firebase Admin with default credentials / emulator...");
      initializeApp();
    }
  }

  const db = getFirestore();

  console.log("Seeding marketCommodities/Karnataka...");

  const karnatakaDoc = {
    categories: DEFAULT_COMMODITY_CATALOG,
    commodities: flattenDefaultCatalog(),
    markets: getKarnatakaMarkets(),
    marketsByDistrict: KARNATAKA_MARKETS_BY_DISTRICT,
    updatedAt: new Date().toISOString(),
  };

  const docRef = db.collection("marketCommodities").doc("Karnataka");
  await docRef.set(karnatakaDoc, { merge: true });

  console.log("Successfully seeded marketCommodities/Karnataka:");
  console.log(`- Categories: ${Object.keys(karnatakaDoc.categories).length} groups`);
  console.log(`- Commodities: ${karnatakaDoc.commodities.length} items`);
  console.log(`- Markets: ${karnatakaDoc.markets.length} APMC markets`);
  console.log(`- Districts: ${Object.keys(karnatakaDoc.marketsByDistrict).length} districts covered`);
}

main().catch((err) => {
  console.error("Error seeding market commodities:", err);
  process.exit(1);
});
