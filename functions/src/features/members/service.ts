import { randomInt } from "crypto";
import { HttpsError } from "firebase-functions/v2/https";
import { DocumentReference, Transaction } from "firebase-admin/firestore";
import { db } from "../../common/firebaseAdmin";

export const INVITES_COLLECTION = "farm_invites";
const FARMS_COLLECTION = "farms";
const USERS_COLLECTION = "users";

/** Roles an invite code can grant; owner is the farm's ownerId, never invited. */
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

interface FarmMember {
  profileId: string;
  role: string;
  addedAt: string;
}

interface FarmDoc {
  name?: string;
  ownerId?: string;
  isActive?: boolean;
  members?: FarmMember[];
  memberRoles?: Record<string, string>;
}

export interface InviteResult {
  code: string;
  farmId: string;
  role: InvitableRole;
  expiresAt: string;
}

/** Caller's role on the farm: "owner" via ownerId, else their member role. */
function roleOf(farm: FarmDoc, uid: string): string | undefined {
  if (farm.ownerId === uid) return "owner";
  return farm.memberRoles?.[uid] ?? farm.members?.find((m) => m.profileId === uid)?.role;
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
  const farm = (await db.collection(FARMS_COLLECTION).doc(farmId).get()).data() as FarmDoc | undefined;
  if (!farm) throw new HttpsError("not-found", "Farm not found");

  const callerRole = roleOf(farm, uid);
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

/** Adds `uid` to the farm with `role`, keeping members and memberRoles in step. */
function addMemberInTransaction(
  tx: Transaction,
  farmRef: DocumentReference,
  farm: FarmDoc,
  uid: string,
  role: string,
  now: string,
): void {
  tx.update(farmRef, {
    members: [...(farm.members ?? []), { profileId: uid, role, addedAt: now }],
    [`memberRoles.${uid}`]: role,
    updatedAt: now,
  });
}

/**
 * Redeems an invite code for the signed-in user: adds them to the farm and
 * marks the code used, in one transaction so a code can't be redeemed twice.
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
    const farmRef = db.collection(FARMS_COLLECTION).doc(farmId);
    const farm = (await tx.get(farmRef)).data() as FarmDoc | undefined;
    if (!farm || farm.isActive === false) throw new HttpsError("not-found", "This farm is no longer available");
    if (roleOf(farm, uid) !== undefined) {
      throw new HttpsError("already-exists", "You are already a member of this farm");
    }

    const now = new Date().toISOString();
    addMemberInTransaction(tx, farmRef, farm, uid, invite.role as string, now);
    tx.update(inviteRef, { status: "used", usedBy: uid, usedAt: now });

    return { farmId, farmName: farm.name ?? "" };
  });
}

/**
 * Hands farm memberships that an owner pre-created for this user's phone
 * number (or verified email) over to their account. Pending members are
 * stored as `users/pending_*` profiles referenced from farm `members`; each
 * reference is swapped for the user's uid and the pending profile is marked
 * `linked` so it isn't claimed again.
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

  // Members are an array of maps, which Firestore can't query by profileId,
  // so scan farms. Fine at current scale; revisit with a memberIds field.
  const farms = await db.collection(FARMS_COLLECTION).get();
  const farmIds: string[] = [];

  for (const farmSnap of farms.docs) {
    const listed = (farmSnap.data() as FarmDoc).members ?? [];
    if (!listed.some((m) => pendingIds.has(m.profileId))) continue;

    await db.runTransaction(async (tx) => {
      const farm = (await tx.get(farmSnap.ref)).data() as FarmDoc | undefined;
      if (!farm) return;
      const pending = (farm.members ?? []).find((m) => pendingIds.has(m.profileId));
      if (!pending) return;

      // The first pending entry becomes the user; any others (or all of
      // them, if the user is already a member) are dropped.
      const alreadyMember = roleOf(farm, uid) !== undefined;
      let placed = alreadyMember;
      const members: FarmMember[] = [];
      for (const m of farm.members ?? []) {
        if (!pendingIds.has(m.profileId)) {
          members.push(m);
        } else if (!placed) {
          members.push({ ...m, profileId: uid });
          placed = true;
        }
      }
      const memberRoles = { ...(farm.memberRoles ?? {}) };
      pendingIds.forEach((id) => delete memberRoles[id]);
      if (!alreadyMember) memberRoles[uid] = pending.role;

      tx.update(farmSnap.ref, { members, memberRoles, updatedAt: new Date().toISOString() });
    });
    farmIds.push(farmSnap.id);
  }

  const now = new Date().toISOString();
  const batch = db.batch();
  pendingIds.forEach((id) =>
    batch.update(db.collection(USERS_COLLECTION).doc(id), { status: "linked", linkedUid: uid, updatedAt: now }),
  );
  await batch.commit();

  return { farmIds };
}
