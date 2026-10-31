import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { claimPendingMemberships as claim, createInvite, INVITABLE_ROLES, joinWithInvite } from "./service";

const createInviteSchema = z.object({
  farmId: z.string().min(1).max(128),
  role: z.enum(INVITABLE_ROLES),
});

const joinSchema = z.object({
  code: z
    .string()
    .trim()
    .transform((c) => c.toUpperCase())
    .pipe(z.string().regex(/^[A-Z0-9]{6}$/)),
});

function requireUid(auth: { uid: string } | undefined): string {
  if (!auth) throw new HttpsError("unauthenticated", "Sign in required");
  return auth.uid;
}

// Membership changes run here (Admin SDK) rather than from the app, so the
// security rules can keep farms' members/memberRoles closed to non-owners.
// All are user-initiated and infrequent, so no always-warm instance.

/** Owner or co-owner creates a 6-character, single-use invite code. */
export const createFarmInvite = onCall({ minInstances: 0 }, async (request) => {
  const uid = requireUid(request.auth);
  const parsed = createInviteSchema.safeParse(request.data ?? {});
  if (!parsed.success) {
    throw new HttpsError("invalid-argument", "Invalid invite request", parsed.error.flatten());
  }
  return createInvite(parsed.data.farmId, parsed.data.role, uid);
});

/** Signed-in user redeems an invite code and joins that farm. */
export const joinFarmWithInvite = onCall({ minInstances: 0 }, async (request) => {
  const uid = requireUid(request.auth);
  const parsed = joinSchema.safeParse(request.data ?? {});
  if (!parsed.success) {
    throw new HttpsError("invalid-argument", "Invite code must be 6 letters or numbers");
  }
  return joinWithInvite(parsed.data.code, uid);
});

/**
 * Links farms an owner added this user to (by phone number) before they had
 * an account. Matches only the phone number and verified email in the ID
 * token, so a caller can't claim someone else's invitations.
 */
export const claimPendingMemberships = onCall({ minInstances: 0 }, async (request) => {
  const uid = requireUid(request.auth);
  const token = request.auth!.token;
  const email = token.email_verified ? token.email : undefined;
  return claim(uid, token.phone_number, email);
});
