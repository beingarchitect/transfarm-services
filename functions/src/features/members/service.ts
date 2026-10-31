import { randomInt } from "crypto";
import { HttpsError } from "firebase-functions/v2/https";
import { db } from "../../common/firebaseAdmin";

export const INVITES_COLLECTION = "farm_invites";
const FARMS_COLLECTION = "farms";
const MEMBERS_SUBCOLLECTION = "members";
const USERS_COLLECTION = "users";

/** Roles an invite code can grant; the owner is never invited. */
export const INVITABLE_ROLES = ["coowner", "manager", "guest"] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number];

// Long enough to install the app and sign in; short enough that a code
// forwarded to the wrong chat doesn't stay usable for long.
const INVITE_TTL_DAYS = 3;
const CODE_LENGTH = 6;
// No 0/O or 1/I, so codes read out over the phone aren't misheard.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MAX_CODE_ATTEMPTS = 5;
// Firestore's gRPC status for a create() on an existing document.
const ALREADY_EXISTS = 6;
// Firestore's limit on values in an "in" filter.
const IN_FILTER_LIMIT = 30;

/**
 * One person on a farm: `farms/{farmId}/members/{profileId}`. profileId is
 * the user's uid, or `pending_*` for someone added by phone who hasn't
 * signed up. The owner has one too, with role "owner".
 */
export interface MemberDoc {
  profileId: string;
  farmId: string;
  role: string;
  addedAt: string;
}

interface FarmDoc {
  name?: string;
  ownerId?: string;
  isActive?: boolean;
}

export interface InviteResult {
  code: string;
  farmId: string;
  role: InvitableRole;
  expiresAt: string;
}

export function memberRef(farmId: string, profileId: string) {
  return db.collection(FARMS_COLLECTION).doc(farmId).collection(MEMBERS_SUBCOLLECTION).doc(profileId);
}

/** The caller's role on the farm, or undefined if they aren't on it. */
export async function roleOf(farmId: string, uid: string): Promise<string | undefined> {
  const member = await memberRef(farmId, uid).get();
  return member.exists ? (member.get("role") as string) : undefined;
}

function generateCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

/**
 * Creates a single-use invite code for a farm, stored as
 * `farm_invites/{code}`. Owners can invite any role; co-owners can invite
 * managers and guests only (mirrors FarmPermissionService on the app).
 */
export async function createInvite(farmId: string, role: InvitableRole, uid: string): Promise<InviteResult> {
  const callerRole = await roleOf(farmId, uid);
  if (callerRole !== "owner" && callerRole !== "coowner") {
    throw new HttpsError("permission-denied", "Only owners and co-owners can invite members");
  }
  if (role === "coowner" && callerRole !== "owner") {
    throw new HttpsError("permission-denied", "Only the owner can invite co-owners");
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const code = generateCode();
    try {
      await db.collection(INVITES_COLLECTION).doc(code).create({
        code,
        farmId,
        role,
        createdBy: uid,
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        status: "pending",
        usedBy: null,
        usedAt: null,
      });
      return { code, farmId, role, expiresAt: expiresAt.toISOString() };
    } catch (err) {
      if ((err as { code?: number }).code !== ALREADY_EXISTS) throw err;
    }
  }
  throw new HttpsError("resource-exhausted", "Could not generate a unique invite code, try again");
}

/**
 * Redeems an invite code for the signed-in user: adds their member document
 * and marks the code used, in one transaction so a code can't be redeemed
 * twice.
 */
export async function joinWithInvite(code: string, uid: string): Promise<{ farmId: string; farmName: string }> {
  const inviteRef = db.collection(INVITES_COLLECTION).doc(code);

  return db.runTransaction(async (tx) => {
    const invite = (await tx.get(inviteRef)).data();
    if (!invite) throw new HttpsError("not-found", "Invalid invite code");
    if (invite.status === "used") throw new HttpsError("failed-precondition", "Invite code has already been used");
    if (invite.status === "cancelled") throw new HttpsError("failed-precondition", "This invite was cancelled");
    if (invite.status !== "pending" || new Date(invite.expiresAt as string) < new Date()) {
      throw new HttpsError("failed-precondition", "Invite code has expired");
    }

    const farmId = invite.farmId as string;
    const farm = (await tx.get(db.collection(FARMS_COLLECTION).doc(farmId))).data() as FarmDoc | undefined;
    if (!farm || farm.isActive === false) throw new HttpsError("not-found", "This farm is no longer available");

    const ref = memberRef(farmId, uid);
    if ((await tx.get(ref)).exists) {
      throw new HttpsError("already-exists", "You are already a member of this farm");
    }

    const now = new Date().toISOString();
    const member: MemberDoc = { profileId: uid, farmId, role: invite.role as string, addedAt: now };
    tx.create(ref, member);
    tx.update(inviteRef, { status: "used", usedBy: uid, usedAt: now });

    return { farmId, farmName: farm.name ?? "" };
  });
}

/**
 * Hands farm memberships that an owner pre-created for this user's phone
 * number (or verified email) over to their account. Each pending member
 * document (`members/pending_*`) is replaced by one under the user's uid,
 * keeping its role, and the `users/pending_*` profile is marked `linked` so
 * it isn't claimed again.
 */
export async function claimPendingMemberships(
  uid: string,
  phoneNumber: string | undefined,
  verifiedEmail: string | undefined,
): Promise<{ farmIds: string[] }> {
  const pendingIds = new Set<string>();
  const lookups: [string, string | undefined][] = [
    ["phoneNumber", phoneNumber],
    ["email", verifiedEmail],
  ];
  for (const [field, value] of lookups) {
    if (!value) continue;
    const snapshot = await db
      .collection(USERS_COLLECTION)
      .where(field, "==", value)
      .where("status", "==", "pending")
      .get();
    snapshot.docs.forEach((doc) => pendingIds.add(doc.id));
  }
  if (pendingIds.size === 0) return { farmIds: [] };

  const ids = [...pendingIds];
  const pendingMembers = [];
  for (let i = 0; i < ids.length; i += IN_FILTER_LIMIT) {
    const snapshot = await db
      .collectionGroup(MEMBERS_SUBCOLLECTION)
      .where("profileId", "in", ids.slice(i, i + IN_FILTER_LIMIT))
      .get();
    pendingMembers.push(...snapshot.docs);
  }

  const farmIds = new Set<string>();
  for (const pendingSnap of pendingMembers) {
    const pending = pendingSnap.data() as MemberDoc;
    const farmId = pendingSnap.ref.parent.parent!.id;
    const ref = memberRef(farmId, uid);

    await db.runTransaction(async (tx) => {
      const [current, existing] = await Promise.all([tx.get(pendingSnap.ref), tx.get(ref)]);
      if (!current.exists) return;
      // Already on the farm (e.g. joined by code too): keep that role.
      if (!existing.exists) {
        const member: MemberDoc = { profileId: uid, farmId, role: pending.role, addedAt: pending.addedAt };
        tx.create(ref, member);
      }
      tx.delete(pendingSnap.ref);
    });
    farmIds.add(farmId);
  }

  const now = new Date().toISOString();
  const batch = db.batch();
  pendingIds.forEach((id) =>
    batch.update(db.collection(USERS_COLLECTION).doc(id), { status: "linked", linkedUid: uid, updatedAt: now }),
  );
  await batch.commit();

  return { farmIds: [...farmIds] };
}
