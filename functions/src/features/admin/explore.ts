import { getAuth, UserRecord } from "firebase-admin/auth";
import { db } from "../../common/firebaseAdmin";
import { DEFAULT_FARM_LISTS, FARM_LIST_DOCS, FarmLists } from "../farmDefaults/defaults";
import { checkEvents, EVENT_COLUMNS } from "../../scripts/importPublicEvents";
import { csvTextRows } from "../../scripts/csvImport";
import { auditEntry } from "./grants";
import { RECORD_COLLECTIONS, toDate } from "./stats";

// Audit Log, Users & Farms, and Data for the admin website. Read-mostly; the
// two writes (events, default lists) are recorded in admin_audit.

const day = (value: unknown) => toDate(value)?.toISOString().slice(0, 10) ?? null;
const labelOf = (user: UserRecord | undefined, uid: string) =>
  user?.phoneNumber ?? user?.email ?? uid;

/** Users by uid, fetched 100 at a time (the Auth limit per call). */
async function usersByUid(uids: string[]): Promise<Map<string, UserRecord>> {
  const unique = [...new Set(uids)];
  const found = new Map<string, UserRecord>();
  for (let i = 0; i < unique.length; i += 100) {
    const page = await getAuth().getUsers(unique.slice(i, i + 100).map((uid) => ({ uid })));
    page.users.forEach((u) => found.set(u.uid, u));
  }
  return found;
}

// --- Audit Log -----------------------------------------------------------------

export async function auditLog(limit: number, before: string | null) {
  let query = db.collection("admin_audit").orderBy("at", "desc").limit(limit);
  if (before) query = query.startAfter(new Date(before));
  const page = await query.get();
  return page.docs.map((d) => ({
    id: d.id,
    action: d.get("action") as string,
    target: (d.get("targetLabel") as string) ?? d.get("targetUid") ?? "",
    details: (d.get("details") ?? {}) as Record<string, unknown>,
    by: d.get("by") as string,
    at: toDate(d.get("at"))?.toISOString() ?? null,
  }));
}

// --- Users & Farms ---------------------------------------------------------------

/** Every farm with its owner, plan, members and where it is. */
export async function listFarms() {
  const [farms, plans] = await Promise.all([
    db.collection("farms").select("name", "ownerId", "createdAt", "state", "district").get(),
    db.collection("farm_subscriptions").select("tier").get(),
  ]);
  const tierOf = new Map(plans.docs.map((p) => [p.id, (p.get("tier") as string) ?? "free"]));
  const [owners, memberCounts] = await Promise.all([
    usersByUid(farms.docs.map((f) => f.get("ownerId")).filter(Boolean)),
    Promise.all(farms.docs.map(async (f) => (await f.ref.collection("members").count().get()).data().count)),
  ]);
  return farms.docs
    .map((f, i) => ({
      id: f.id,
      name: (f.get("name") as string) ?? f.id,
      owner: labelOf(owners.get(f.get("ownerId")), f.get("ownerId") ?? ""),
      ownerName: owners.get(f.get("ownerId"))?.displayName ?? null,
      createdAt: day(f.get("createdAt")),
      place: [f.get("district"), f.get("state")].filter(Boolean).join(", ") || null,
      tier: tierOf.get(f.id) ?? "free",
      members: memberCounts[i],
    }))
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}

/** Every account with when it joined, was last active, its plan and farms. */
export async function listUsers() {
  const [plans, farms] = await Promise.all([
    db.collection("user_subscriptions").select("tier").get(),
    db.collection("farms").select("ownerId").get(),
  ]);
  const tierOf = new Map(plans.docs.map((p) => [p.id, (p.get("tier") as string) ?? "free"]));
  const owned = new Map<string, number>();
  farms.docs.forEach((f) => owned.set(f.get("ownerId"), (owned.get(f.get("ownerId")) ?? 0) + 1));

  const users: UserRecord[] = [];
  let pageToken: string | undefined;
  do {
    const page = await getAuth().listUsers(1000, pageToken);
    users.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);

  return users
    .map((u) => ({
      uid: u.uid,
      label: labelOf(u, u.uid),
      name: u.displayName ?? null,
      createdAt: day(u.metadata.creationTime),
      lastActiveAt: day(u.metadata.lastRefreshTime ?? u.metadata.lastSignInTime),
      tier: tierOf.get(u.uid) ?? "free",
      farmsOwned: owned.get(u.uid) ?? 0,
      disabled: u.disabled,
    }))
    .sort((a, b) => (b.lastActiveAt ?? "").localeCompare(a.lastActiveAt ?? ""));
}

/** One farm: details, members with roles, and how much each feature is used. */
export async function farmDetail(farmId: string) {
  const ref = db.collection("farms").doc(farmId);
  const [farm, members, plan, counts] = await Promise.all([
    ref.get(),
    ref.collection("members").get(),
    db.collection("farm_subscriptions").doc(farmId).get(),
    Promise.all(
      Object.entries(RECORD_COLLECTIONS).map(async ([key, label]) => ({
        label,
        count: (await db.collection(key).where("farmId", "==", farmId).count().get()).data().count,
      })),
    ),
  ]);
  if (!farm.exists) return null;
  const people = await usersByUid(members.docs.map((m) => m.id));
  return {
    id: farm.id,
    name: (farm.get("name") as string) ?? farm.id,
    createdAt: day(farm.get("createdAt")),
    place: [farm.get("village"), farm.get("district"), farm.get("state")].filter(Boolean).join(", ") || null,
    tier: (plan.get("tier") as string) ?? "free",
    until: day(plan.get("expiryDate")),
    members: members.docs
      .map((m) => ({
        uid: m.id,
        label: labelOf(people.get(m.id), m.id),
        name: people.get(m.id)?.displayName ?? null,
        role: (m.get("role") as string) ?? "member",
      }))
      .sort((a, b) => (a.role === "owner" ? -1 : b.role === "owner" ? 1 : 0)),
    records: counts.filter((c) => c.count > 0).sort((a, b) => b.count - a.count),
  };
}

// --- Data ------------------------------------------------------------------------

/** Checks an events CSV; loads it too when [write] and nothing is wrong. */
export async function importEvents(csv: string, write: boolean, by: string) {
  let rows: Record<string, string>[];
  try {
    rows = csvTextRows(csv, EVENT_COLUMNS);
  } catch (e) {
    return { count: 0, problems: [(e as Error).message], sample: [], written: false };
  }
  const { events, problems } = checkEvents(rows);
  const sample = events.slice(0, 5).map((e) => ({
    id: e.id,
    title: (e.data.title as Record<string, string>).en ?? e.id,
    startDate: e.data.startDate as string,
    endDate: e.data.endDate as string,
    place: [(e.data.districts as string[]).join(", "), e.data.stateKey].filter(Boolean).join(" · "),
  }));
  if (!write || problems.length > 0 || events.length === 0) {
    return { count: events.length, problems, sample, written: false };
  }
  const writer = db.bulkWriter();
  for (const event of events) writer.set(db.collection("public_events").doc(event.id), event.data);
  await writer.close();
  await db
    .collection("admin_audit")
    .add(auditEntry("import_events", { uid: "", label: "public_events" }, { count: events.length }, by, new Date()));
  return { count: events.length, problems, sample, written: true };
}

/** The events loaded so far, latest first. */
export async function listEvents() {
  const events = await db.collection("public_events").orderBy("startDate", "desc").limit(100).get();
  const today = new Date().toISOString().slice(0, 10);
  return events.docs.map((e) => ({
    id: e.id,
    title: ((e.get("title") ?? {}) as Record<string, string>).en ?? e.id,
    startDate: e.get("startDate") as string,
    endDate: e.get("endDate") as string,
    place: [((e.get("districts") ?? []) as string[]).join(", "), e.get("stateKey")].filter(Boolean).join(" · "),
    past: (e.get("endDate") as string) < today,
  }));
}

/** Rewrites the default lists new farms get from the built-in copy. */
export async function seedDefaultLists(by: string) {
  const lists = Object.keys(FARM_LIST_DOCS) as (keyof FarmLists)[];
  const now = new Date();
  for (const list of lists) {
    await db
      .collection("masterData")
      .doc(FARM_LIST_DOCS[list])
      .set({ categories: DEFAULT_FARM_LISTS[list], updatedAt: now.toISOString() }, { merge: true });
  }
  const counts = Object.fromEntries(lists.map((l) => [l, DEFAULT_FARM_LISTS[l].length]));
  await db.collection("admin_audit").add(auditEntry("seed_default_lists", { uid: "", label: "masterData" }, counts, by, now));
  return counts;
}
