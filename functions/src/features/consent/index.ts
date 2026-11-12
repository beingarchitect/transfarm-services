import { FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { db } from "../../common/firebaseAdmin";
import { recordConsentSchema } from "./schema";

/**
 * Records that the signed-in person accepted the Terms of Use and Privacy
 * Policy: one new entry in `users/{uid}/consents`, never edited, so every
 * version anyone accepted stays on record. The app can read its own
 * entries but not write them (see firestore.rules).
 *
 * Kept with the profile, so deleting the account removes it too.
 */
export const recordConsent = onCall({ minInstances: 0 }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in required");
  }
  const parsed = recordConsentSchema.safeParse(request.data ?? {});
  if (!parsed.success) {
    throw new HttpsError("invalid-argument", "Invalid consent", parsed.error.flatten());
  }
  const { termsVersion, privacyVersion, language, appVersion, method } = parsed.data;

  await db
    .collection("users")
    .doc(request.auth.uid)
    .collection("consents")
    .add({
      type: "terms_privacy",
      termsVersion,
      privacyVersion,
      language,
      appVersion: appVersion ?? null,
      method,
      acceptedAt: FieldValue.serverTimestamp(),
    });
  return { ok: true };
});
