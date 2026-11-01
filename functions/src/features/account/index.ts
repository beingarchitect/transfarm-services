import { logger } from "firebase-functions/v2";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { deleteAccount, previewAccountDeletion } from "./service";

function requireUid(auth: { uid: string } | undefined): string {
  if (!auth) throw new HttpsError("unauthenticated", "Sign in required");
  return auth.uid;
}

// Both act only on the caller's own account: the uid comes from the verified
// token, never from the request. Infrequent, so no always-warm instance.

/** What deleting the signed-in user's account would do, to show before confirming. */
export const getAccountDeletionPreview = onCall({ minInstances: 0 }, async (request) => {
  return previewAccountDeletion(requireUid(request.auth));
});

export const deleteMyAccount = onCall({ minInstances: 0, timeoutSeconds: 300 }, async (request) => {
  const uid = requireUid(request.auth);
  try {
    await deleteAccount(uid);
    return { deleted: true };
  } catch (err) {
    logger.error("Account deletion failed", { uid, err });
    throw new HttpsError("internal", "Account deletion failed");
  }
});
