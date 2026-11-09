// Who may use the admin website and its functions. No Admin SDK setup in this
// file, so scripts and tests can import it.

/** Only accounts in this Google Workspace domain can be admins. */
export const ADMIN_DOMAIN = "appselerator.com";

/** The parts of a Firebase ID token the checks read. */
export interface AdminToken {
  admin?: unknown;
  email?: unknown;
  email_verified?: unknown;
  firebase?: { sign_in_provider?: unknown };
}

export function isAdminEmail(email: unknown): email is string {
  return typeof email === "string" && email.toLowerCase().endsWith(`@${ADMIN_DOMAIN}`);
}

/**
 * Why [token] isn't an admin's, or null when it is. Every check must pass:
 * the admin flag (set only by the setAdmin script), a verified email in the
 * Workspace domain, and a Google sign-in, which is where the domain enforces
 * 2-Step Verification. A phone sign-in, or a personal Gmail with the flag
 * copied onto it somehow, is refused.
 */
export function adminRefusal(token: AdminToken | undefined): string | null {
  if (!token) return "not signed in";
  if (token.firebase?.sign_in_provider !== "google.com") return "not a Google sign-in";
  if (!isAdminEmail(token.email)) return `not an @${ADMIN_DOMAIN} account`;
  if (token.email_verified !== true) return "email not verified";
  if (token.admin !== true) return "not an admin";
  return null;
}
