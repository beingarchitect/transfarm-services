import { logger } from "firebase-functions/v2";
import { CallableRequest, HttpsError, onCall } from "firebase-functions/v2/https";
import { adminRefusal } from "./access";

// Functions for the admin website (transfarm-admin). Every one starts with
// requireAdmin: the website hides itself from non-admins, but only these
// checks protect the data. Used rarely, so no warm instance.
//
// TODO: enforceAppCheck once the admin site has its reCAPTCHA Enterprise key.

/** The admin's email, or throws permission-denied. */
export function requireAdmin(request: CallableRequest): string {
  const refusal = adminRefusal(request.auth?.token);
  if (refusal) {
    logger.warn("Admin call refused", { reason: refusal, uid: request.auth?.uid });
    throw new HttpsError("permission-denied", "This account can't use the admin tools.");
  }
  return request.auth!.token.email as string;
}

/** Lets the website check, after sign-in, that the account may come in. */
export const adminWhoAmI = onCall({ minInstances: 0 }, (request) => {
  const email = requireAdmin(request);
  return { email, name: request.auth?.token.name ?? email };
});
