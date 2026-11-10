import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { farmTypesFrom, isSupportedLanguage } from "./defaults";
import { seedFarmDefaults } from "./service";

// The app sets `defaultsLanguage` when it creates a farm and leaves the lists to
// this trigger. App versions that seed categories themselves don't set it, so
// their farms are skipped rather than getting duplicates. Infrequent, so no warm
// instance; retried because a failure would leave the farm with empty lists.
// Runs beside the database (Mumbai): the app waits on it while a new farm is
// set up, so every round trip counts.
export const seedNewFarmDefaults = onDocumentCreated(
  { document: "farms/{farmId}", region: "asia-south1", minInstances: 0, retry: true },
  async (event) => {
    const language = event.data?.get("defaultsLanguage");
    if (!isSupportedLanguage(language)) return;
    // Set by the setup wizard when the farmer answered "type of farm".
    const farmTypes = farmTypesFrom(event.data?.get("farmProfile.farmTypes"));
    await seedFarmDefaults(event.params.farmId, language, farmTypes);
  },
);
