/**
 * Gives an @appselerator.com account access to the admin website, or takes it
 * away. Only this script sets the flag; nothing in the apps can.
 *
 *   npm run admin:set -- you@appselerator.com
 *   npm run admin:set -- you@appselerator.com --remove
 *
 * The account must have signed in to the admin website once first, so it
 * exists. The change applies at its next sign-in (or within an hour).
 */
import { getAuth } from "firebase-admin/auth";
import { ADMIN_DOMAIN, isAdminEmail } from "../features/admin/access";
import { auditEntry } from "../features/admin/grants";
import { initFirestore } from "./csvImport";

async function main() {
  const args = process.argv.slice(2);
  const email = args.find((a) => !a.startsWith("--"));
  const remove = args.includes("--remove");
  if (!email) throw new Error("Usage: npm run admin:set -- <email> [--remove]");
  if (!isAdminEmail(email)) throw new Error(`Only @${ADMIN_DOMAIN} accounts can be admins.`);

  const db = initFirestore();
  const auth = getAuth();
  const user = await auth.getUserByEmail(email).catch((e: { code?: string }) => {
    if (e.code === "auth/user-not-found") {
      throw new Error(`${email} hasn't signed in yet. Sign in to the admin website once, then run this again.`);
    }
    throw e; // Credentials or network: show the real problem.
  });

  const claims = { ...(user.customClaims ?? {}) };
  if (remove) {
    delete claims.admin;
  } else {
    claims.admin = true;
  }
  await auth.setCustomUserClaims(user.uid, claims);
  await db
    .collection("admin_audit")
    .add(
      auditEntry(
        remove ? "admin_removed" : "admin_added",
        { uid: user.uid, label: email },
        {},
        process.env.USER ?? process.env.USERNAME ?? "script",
        new Date(),
      ),
    );
  console.log(remove ? `${email} is no longer an admin.` : `${email} is now an admin. Sign out and in again to use it.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
