/**
 * Gives a farm owner a tier by hand (friends, testers), or takes it back.
 * Applies to every farm they own. Only shows what it would do unless --write
 * is passed.
 *
 *   npm run grant:tier -- <phone | email | uid> premium --until 2027-03-31 --reason "Friend, beta tester" --by you@appselerator.com --write
 *   npm run grant:tier -- <phone | email | uid> free --by you@appselerator.com --write
 *
 * A 10-digit phone number is taken as Indian (+91). Leave out --until for no
 * end date. Won't replace a subscription bought on Google Play unless --force
 * is passed. Every change is recorded in admin_audit.
 */
import { getAuth, UserRecord } from "firebase-admin/auth";
import { isAdminEmail } from "../features/admin/access";
import {
  auditEntry,
  GRANTABLE_TIERS,
  GrantableTier,
  grantedSubscription,
  isPurchased,
  normalisePhone,
  parseDay,
} from "../features/admin/grants";
import { initFirestore } from "./csvImport";

function option(args: string[], name: string): string | undefined {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
}

async function findUser(who: string): Promise<UserRecord> {
  const auth = getAuth();
  if (who.includes("@")) return auth.getUserByEmail(who);
  const phone = normalisePhone(who);
  if (phone.startsWith("+")) return auth.getUserByPhoneNumber(phone);
  return auth.getUser(who);
}

async function main() {
  const args = process.argv.slice(2);
  const [who, tierText] = args.filter((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
  const untilText = option(args, "--until");
  const reason = option(args, "--reason") ?? "";
  const by = option(args, "--by") ?? "";
  const write = args.includes("--write");
  const force = args.includes("--force");

  if (!who || !tierText) {
    throw new Error("Usage: npm run grant:tier -- <phone|email|uid> <premium|free> [--until YYYY-MM-DD] [--reason text] --by <you@appselerator.com> [--write] [--force]");
  }
  if (!GRANTABLE_TIERS.includes(tierText as GrantableTier)) {
    throw new Error(`Tier must be one of: ${GRANTABLE_TIERS.join(", ")}`);
  }
  if (!isAdminEmail(by)) throw new Error("--by must be your @appselerator.com email, for the audit log.");
  const until = untilText ? parseDay(untilText) : null;
  if (untilText && !until) throw new Error("--until must be a date like 2027-03-31.");
  if (until && until.getTime() < Date.now() - 24 * 3600 * 1000) throw new Error("--until is in the past.");

  const db = initFirestore();
  const user = await findUser(who).catch((e: { code?: string }) => {
    if (e.code === "auth/user-not-found") {
      throw new Error(`No account found for ${who}. They need to sign in to the app once first.`);
    }
    throw e; // Credentials or network: show the real problem.
  });
  const label = user.phoneNumber ?? user.email ?? user.uid;
  const ref = db.collection("user_subscriptions").doc(user.uid);
  const existing = (await ref.get()).data();
  const farms = await db.collection("farms").where("ownerId", "==", user.uid).get();

  console.log(`Account: ${label} (${user.displayName ?? "no name"}, uid ${user.uid})`);
  console.log(`Owns ${farms.size} farm(s): ${farms.docs.map((f) => f.get("name") ?? f.id).join(", ") || "none yet"}`);
  console.log(`Now: ${existing?.tier ?? "free"}${existing?.expiryDate ? ` until ${existing.expiryDate.toDate().toISOString().slice(0, 10)}` : ""}${existing?.productId ? ` (${existing.productId})` : ""}`);
  console.log(`Change to: ${tierText}${until ? ` until ${untilText}` : tierText === "free" ? "" : " with no end date"}`);

  if (isPurchased(existing) && !force) {
    throw new Error("They bought a subscription on Google Play. Pass --force to replace it anyway.");
  }
  if (!write) {
    console.log("\nDry run: nothing changed. Add --write to apply.");
    return;
  }

  const now = new Date();
  const grant = { tier: tierText as GrantableTier, until, grantedBy: by, reason };
  await ref.set(grantedSubscription(user.uid, grant, now));
  await db.collection("admin_audit").add(
    auditEntry(
      "grant_tier",
      { uid: user.uid, label },
      { tier: grant.tier, until: untilText ?? null, reason, previousTier: existing?.tier ?? "free" },
      by,
      now,
    ),
  );
  console.log("\nDone. Their farms update within a few seconds; they see it the next time the app loads their plan.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
