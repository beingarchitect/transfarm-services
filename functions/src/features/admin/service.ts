import { getAuth, UserRecord } from "firebase-admin/auth";
import { DocumentData } from "firebase-admin/firestore";
import { db } from "../../common/firebaseAdmin";
import {
  ADMIN_GRANT_PRODUCT,
  auditEntry,
  GrantableTier,
  grantedSubscription,
  isPurchased,
  normalisePhone,
} from "./grants";
import { AdminStats, perWeek, RECORD_COLLECTIONS, toDate, within } from "./stats";

const STATS_DOC = db.collection("admin_stats").doc("latest");

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

/** Every account's created and last-active times, a page of 1000 at a time. */
async function userActivity(): Promise<{ created: Date | null; active: Date | null }[]> {
  const auth = getAuth();
  const users: { created: Date | null; active: Date | null }[] = [];
  let pageToken: string | undefined;
  do {
    const page = await auth.listUsers(1000, pageToken);
    for (const u of page.users) {
      // lastRefreshTime moves while the app is in use (tokens refresh hourly);
      // lastSignInTime only on a fresh sign-in.
      const active = u.metadata.lastRefreshTime ?? u.metadata.lastSignInTime;
      users.push({ created: toDate(u.metadata.creationTime), active: active ? toDate(active) : null });
    }
    pageToken = page.pageToken;
  } while (pageToken);
  return users;
}

/** Works out the Overview numbers now. Reads: one per farm, plus counts. */
export async function computeStats(now = new Date()): Promise<AdminStats> {
  const [users, farms, records, premiumFarms, premiumOwners, grantedOwners] = await Promise.all([
    userActivity(),
    db.collection("farms").select("createdAt").get(),
    Promise.all(
      Object.entries(RECORD_COLLECTIONS).map(async ([key, label]) => ({
        key,
        label,
        count: (await db.collection(key).count().get()).data().count,
      })),
    ),
    db.collection("farm_subscriptions").where("tier", "==", "premium").count().get(),
    db.collection("user_subscriptions").where("tier", "==", "premium").count().get(),
    db
      .collection("user_subscriptions")
      .where("productId", "==", ADMIN_GRANT_PRODUCT)
      .where("tier", "==", "premium")
      .count()
      .get(),
  ]);

  const farmDates = farms.docs.map((f) => toDate(f.get("createdAt")));
  return {
    generatedAt: now.toISOString(),
    users: {
      total: users.length,
      active7: within(users.map((u) => u.active), 7, now),
      active30: within(users.map((u) => u.active), 30, now),
      new7: within(users.map((u) => u.created), 7, now),
      new30: within(users.map((u) => u.created), 30, now),
    },
    farms: {
      total: farms.size,
      new7: within(farmDates, 7, now),
      new30: within(farmDates, 30, now),
      perWeek: perWeek(farmDates, now),
    },
    plans: {
      premiumFarms: premiumFarms.data().count,
      premiumOwners: premiumOwners.data().count,
      grantedOwners: grantedOwners.data().count,
    },
    records: records.sort((a, b) => b.count - a.count),
  };
}

/** Recomputes and keeps the result, with a dated copy for trends later. */
export async function refreshStats(): Promise<AdminStats> {
  const stats = await computeStats();
  await STATS_DOC.set(stats);
  await db.collection("admin_stats_history").doc(stats.generatedAt.slice(0, 10)).set(stats);
  return stats;
}

/** The last saved numbers, working them out first if there are none. */
export async function latestStats(): Promise<AdminStats> {
  const saved = await STATS_DOC.get();
  return saved.exists ? (saved.data() as AdminStats) : refreshStats();
}

// ---------------------------------------------------------------------------
// Tiers
// ---------------------------------------------------------------------------

export interface FoundUser {
  uid: string;
  label: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  createdAt: string | null;
  lastActiveAt: string | null;
  subscription: {
    tier: string;
    until: string | null;
    productId: string | null;
    purchased: boolean;
    grantedBy: string | null;
    reason: string | null;
  };
  farms: { id: string; name: string; role: string }[];
}

/** By email, phone (10 digits taken as Indian) or uid; null if none. */
export async function findUser(query: string): Promise<UserRecord | null> {
  const auth = getAuth();
  const q = query.trim();
  try {
    if (q.includes("@")) return await auth.getUserByEmail(q);
    const phone = normalisePhone(q);
    if (phone.startsWith("+")) return await auth.getUserByPhoneNumber(phone);
    return await auth.getUser(q);
  } catch (e) {
    if ((e as { code?: string }).code === "auth/user-not-found") return null;
    throw e;
  }
}

function labelOf(user: UserRecord): string {
  return user.phoneNumber ?? user.email ?? user.uid;
}

function day(value: unknown): string | null {
  return toDate(value)?.toISOString().slice(0, 10) ?? null;
}

/** Everything the Tiers page shows about one person. */
export async function describeUser(user: UserRecord): Promise<FoundUser> {
  const [subscription, owned, memberships] = await Promise.all([
    db.collection("user_subscriptions").doc(user.uid).get(),
    db.collection("farms").where("ownerId", "==", user.uid).select("name").get(),
    db.collectionGroup("members").where("profileId", "==", user.uid).get(),
  ]);
  const farms = new Map<string, { id: string; name: string; role: string }>();
  for (const f of owned.docs) farms.set(f.id, { id: f.id, name: f.get("name") ?? f.id, role: "owner" });
  const others = memberships.docs.filter((m) => !farms.has(m.ref.parent.parent!.id));
  const otherFarms = await Promise.all(others.map((m) => m.ref.parent.parent!.get()));
  others.forEach((m, i) => {
    if (!otherFarms[i].exists) return; // Farm since deleted.
    farms.set(otherFarms[i].id, {
      id: otherFarms[i].id,
      name: otherFarms[i].get("name") ?? otherFarms[i].id,
      role: m.get("role") ?? "member",
    });
  });

  const sub = subscription.data();
  const active = user.metadata.lastRefreshTime ?? user.metadata.lastSignInTime;
  return {
    uid: user.uid,
    label: labelOf(user),
    name: user.displayName ?? null,
    phone: user.phoneNumber ?? null,
    email: user.email ?? null,
    createdAt: day(user.metadata.creationTime),
    lastActiveAt: active ? day(active) : null,
    subscription: {
      tier: sub?.tier ?? "free",
      until: day(sub?.expiryDate),
      productId: sub?.productId ?? null,
      purchased: isPurchased(sub),
      grantedBy: sub?.grantedBy ?? null,
      reason: sub?.grantReason ?? null,
    },
    farms: [...farms.values()],
  };
}

export class GrantRefused extends Error {}

/** Sets [uid]'s tier and records it; returns the updated details. */
export async function setTier(
  uid: string,
  grant: { tier: GrantableTier; until: Date | null; untilText: string | null; reason: string; force: boolean },
  by: string,
): Promise<FoundUser> {
  const user = await getAuth().getUser(uid);
  const ref = db.collection("user_subscriptions").doc(uid);
  const existing: DocumentData | undefined = (await ref.get()).data();
  if (isPurchased(existing) && !grant.force) {
    throw new GrantRefused("They bought a subscription on Google Play. Confirm to replace it anyway.");
  }
  const now = new Date();
  await ref.set(grantedSubscription(uid, { tier: grant.tier, until: grant.until, grantedBy: by, reason: grant.reason }, now));
  await db.collection("admin_audit").add(
    auditEntry(
      "grant_tier",
      { uid, label: labelOf(user) },
      {
        tier: grant.tier,
        until: grant.untilText,
        reason: grant.reason,
        previousTier: existing?.tier ?? "free",
        replacedPurchase: isPurchased(existing),
      },
      by,
      now,
    ),
  );
  return describeUser(user);
}

/** Everyone currently on a tier given by an admin, soonest to end first. */
export async function listGrants(): Promise<
  { uid: string; label: string; name: string | null; tier: string; until: string | null; grantedBy: string | null; reason: string | null }[]
> {
  const grants = await db
    .collection("user_subscriptions")
    .where("productId", "==", ADMIN_GRANT_PRODUCT)
    .where("tier", "==", "premium")
    .get();
  if (grants.empty) return [];
  const users = await getAuth().getUsers(grants.docs.map((g) => ({ uid: g.id })));
  const byUid = new Map(users.users.map((u) => [u.uid, u]));
  return grants.docs
    .map((g) => {
      const user = byUid.get(g.id);
      return {
        uid: g.id,
        label: user ? labelOf(user) : g.id,
        name: user?.displayName ?? null,
        tier: g.get("tier"),
        until: day(g.get("expiryDate")),
        grantedBy: g.get("grantedBy") ?? null,
        reason: g.get("grantReason") ?? null,
      };
    })
    .sort((a, b) => (a.until ?? "9999").localeCompare(b.until ?? "9999"));
}
