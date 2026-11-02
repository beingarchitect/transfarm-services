import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { isSupportedLanguage } from "./defaults";
import { seedFarmDefaults } from "./service";

// The app sets `defaultsLanguage` when it creates a farm and leaves the lists to
// this trigger. App versions that seed categories themselves don't set it, so
// their farms are skipped rather than getting duplicates. Infrequent, so no warm
// instance; retried because a failure would leave the farm with empty lists.
export const seedNewFarmDefaults = onDocumentCreated(
  { document: "farms/{farmId}", minInstances: 0, retry: true },
  async (event) => {
    const language = event.data?.get("defaultsLanguage");
    if (!isSupportedLanguage(language)) return;
    await seedFarmDefaults(event.params.farmId, language);
  },
);
