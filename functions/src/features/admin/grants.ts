import { DocumentData, Timestamp } from "firebase-admin/firestore";

// Tiers given by hand (friends, testers), rather than bought on Google Play.
// No Admin SDK setup in this file, so scripts and tests can import it.

export const GRANTABLE_TIERS = ["premium", "free"] as const;
export type GrantableTier = (typeof GRANTABLE_TIERS)[number];

/** Marks a subscription as given by an admin, not bought. */
export const ADMIN_GRANT_PRODUCT = "admin_grant";

export interface TierGrant {
  tier: GrantableTier;
  /** Last day it lasts, or null for no end. */
  until: Date | null;
  /** Who gave it: the admin's email. */
  grantedBy: string;
  reason: string;
}

/**
 * The owner's `user_subscriptions/{uid}` record for [grant]. The
 * syncOwnerSubscription trigger copies it onto each of their farms. Free
 * clears any end date, as the app reads Free as having none.
 */
export function grantedSubscription(uid: string, grant: TierGrant, now: Date): DocumentData {
  const paid = grant.tier !== "free";
  return {
    ownerId: uid,
    tier: grant.tier,
    status: "active",
    startDate: Timestamp.fromDate(now),
    expiryDate: paid && grant.until ? Timestamp.fromDate(endOfDay(grant.until)) : null,
    purchaseToken: null,
    productId: ADMIN_GRANT_PRODUCT,
    autoRenew: false,
    grantedBy: grant.grantedBy,
    grantReason: grant.reason,
    updatedAt: Timestamp.fromDate(now),
  };
}

/** A grant shouldn't silently replace a subscription someone paid for. */
export function isPurchased(existing: DocumentData | undefined): boolean {
  return typeof existing?.purchaseToken === "string" && existing.purchaseToken.length > 0;
}

/** The record kept in `admin_audit` for every admin change. */
export function auditEntry(
  action: string,
  target: { uid: string; label: string },
  details: Record<string, unknown>,
  by: string,
  now: Date,
): DocumentData {
  return {
    action,
    targetUid: target.uid,
    targetLabel: target.label,
    details,
    by,
    at: Timestamp.fromDate(now),
  };
}

/** The grant lasts through the whole of its last day, India time. */
function endOfDay(day: Date): Date {
  // 23:59:59 IST is 18:29:59 UTC.
  return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 18, 29, 59));
}

/** "YYYY-MM-DD", as a UTC date; null if it isn't one. */
export function parseDay(text: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(`${text}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text ? null : date;
}

/** A 10-digit Indian mobile number gets +91; anything else is left as is. */
export function normalisePhone(text: string): string {
  const digits = text.replace(/[\s-]/g, "");
  return /^\d{10}$/.test(digits) ? `+91${digits}` : digits;
}
