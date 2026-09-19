import { defineSecret } from "firebase-functions/params";

/**
 * data.gov.in API key.
 *
 * Managed via Firebase Secret Manager, never bundled into client apps.
 *
 * Set it with:
 *   firebase functions:secrets:set DATA_GOV_API_KEY
 */
export const dataGovApiKey = defineSecret("DATA_GOV_API_KEY");
