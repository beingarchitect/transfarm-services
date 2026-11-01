import { getAuth } from "firebase-admin/auth";
import { DocumentReference, FieldValue, QueryDocumentSnapshot } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { db } from "../../common/firebaseAdmin";
import { initFarmSubscription } from "../subscriptions/service";
import { chooseSuccessor, MemberSummary } from "./plan";

const FARMS_COLLECTION = "farms";
const MEMBERS_SUBCOLLECTION = "members";
const USERS_COLLECTION = "users";
const USER_SUBSCRIPTIONS_COLLECTION = "user_subscriptions";

// Top-level collections holding a farm's records, each with a `farmId` field.
// Subcollections under farms/{farmId} go with the farm itself.
const FARM_DATA_COLLECTIONS = [
  "attendance",
  "budgets",
  "contacts",
  "conversations",
  "crops",
  "expenses",
  "farm_invites",
  "field_plots",
  "files",
  "income",
  "inventory",
  "irrigation_logs",
  "labour_payments",
  "labourers",
  "notes",
  "plot_terrain",
  "rainfall_records",
  "soil_tests",
  "tasks",
];

export interface AccountDeletionPreview {
  /** Farms deleted with the account: nobody can take them over. */
  deletedFarms: string[];
  /** Farms that continue under a co-owner. */
  transferredFarms: { farmName: string; newOwnerName: string }[];
  /** Other people's farms the user is just removed from. */
  leftFarms: string[];
  /** Deleting the account doesn't cancel a Play subscription; the user must. */
  hasPaidPlan: boolean;
}

interface OwnedFarmPlan {
  farm: QueryDocumentSnapshot;
  members: MemberSummary[];
  successor?: string;
}

async function planOwnedFarms(uid: string): Promise<OwnedFarmPlan[]> {
  const farms = await db.collection(FARMS_COLLECTION).where("ownerId", "==", uid).get();
  return Promise.all(
    farms.docs.map(async (farm) => {
      const snapshot = await farm.ref.collection(MEMBERS_SUBCOLLECTION).get();
      const members = snapshot.docs.map((m) => m.data() as MemberSummary);
      return { farm, members, successor: chooseSuccessor(members, uid) };
    }),
  );
}

function memberships(uid: string) {
  return db.collectionGroup(MEMBERS_SUBCOLLECTION).where("profileId", "==", uid).get();
}

async function displayName(uid: string): Promise<string> {
  const user = (await db.collection(USERS_COLLECTION).doc(uid).get()).data();
  return `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim();
}

export async function previewAccountDeletion(uid: string): Promise<AccountDeletionPreview> {
  const plans = await planOwnedFarms(uid);
  const owned = new Set(plans.map((p) => p.farm.id));

  const others = (await memberships(uid)).docs
    .map((m) => m.ref.parent.parent)
    .filter((farm): farm is DocumentReference => !!farm && !owned.has(farm.id));
  const leftFarms = await Promise.all(others.map(async (f) => ((await f.get()).get("name") as string) ?? ""));

  const transferred = plans.filter((p) => p.successor);
  const subscription = (await db.collection(USER_SUBSCRIPTIONS_COLLECTION).doc(uid).get()).data();

  return {
    deletedFarms: plans.filter((p) => !p.successor).map((p) => p.farm.get("name") ?? ""),
    transferredFarms: await Promise.all(
      transferred.map(async (p) => ({
        farmName: p.farm.get("name") ?? "",
        newOwnerName: await displayName(p.successor!),
      })),
    ),
    leftFarms,
    hasPaidPlan: !!subscription && subscription.tier !== "free",
  };
}

async function deleteQuery(docs: QueryDocumentSnapshot[]): Promise<void> {
  // recursiveDelete also takes subcollections such as a conversation's messages.
  await Promise.all(docs.map((doc) => db.recursiveDelete(doc.ref)));
}

async function deleteFarm({ farm, members }: OwnedFarmPlan): Promise<void> {
  const inventory = await db.collection("inventory").where("farmId", "==", farm.id).get();
  for (const item of inventory.docs) {
    const moves = await db.collection("stock_transactions").where("inventoryItemId", "==", item.id).get();
    await deleteQuery(moves.docs);
  }
  for (const collection of FARM_DATA_COLLECTIONS) {
    const records = await db.collection(collection).where("farmId", "==", farm.id).get();
    await deleteQuery(records.docs);
  }
  // Profiles the owner created for people who never signed up exist only for this farm.
  await Promise.all(
    members
      .filter((m) => m.profileId.startsWith("pending_"))
      .map((m) => db.collection(USERS_COLLECTION).doc(m.profileId).delete()),
  );
  await db.collection("farm_subscriptions").doc(farm.id).delete();
  await db.collection("farm_usage_tracking").doc(farm.id).delete();
  await db.recursiveDelete(farm.ref);
  await getStorage()
    .bucket()
    .deleteFiles({ prefix: `farms/${farm.id}/` });
}

/** The farm carries on, on its new owner's plan; records stay with it. */
async function transferFarm({ farm, successor }: OwnedFarmPlan, uid: string): Promise<void> {
  const batch = db.batch();
  batch.update(farm.ref, { ownerId: successor, isDefault: false, updatedAt: FieldValue.serverTimestamp() });
  batch.update(farm.ref.collection(MEMBERS_SUBCOLLECTION).doc(successor!), { role: "owner" });
  batch.delete(farm.ref.collection(MEMBERS_SUBCOLLECTION).doc(uid));
  await batch.commit();
  await initFarmSubscription(farm.id, successor!);
}

/**
 * Deletes the account and what belongs to it. Safe to re-run if it fails part
 * way: each step skips what's already gone, and the sign-in goes last so the
 * user can still retry until everything else is done.
 */
export async function deleteAccount(uid: string): Promise<void> {
  for (const plan of await planOwnedFarms(uid)) {
    await (plan.successor ? transferFarm(plan, uid) : deleteFarm(plan));
  }

  const remaining = await memberships(uid);
  await Promise.all(remaining.docs.map((m) => m.ref.delete()));

  const conversations = await db.collection("conversations").where("userId", "==", uid).get();
  await deleteQuery(conversations.docs);
  const invites = await db.collection("farm_invites").where("createdBy", "==", uid).get();
  await deleteQuery(invites.docs);
  const linkedProfiles = await db.collection(USERS_COLLECTION).where("linkedUid", "==", uid).get();
  await deleteQuery(linkedProfiles.docs);

  await db.collection(USER_SUBSCRIPTIONS_COLLECTION).doc(uid).delete();
  await db.collection(USERS_COLLECTION).doc(uid).delete();
  await getStorage()
    .bucket()
    .deleteFiles({ prefix: `profile_pictures/${uid}` });

  await getAuth().deleteUser(uid);
}
