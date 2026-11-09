import assert from "node:assert/strict";
import { test } from "node:test";
import { adminRefusal } from "./access";
import { grantedSubscription, isPurchased, normalisePhone, parseDay } from "./grants";

const admin = {
  admin: true,
  email: "owner@appselerator.com",
  email_verified: true,
  firebase: { sign_in_provider: "google.com" },
};

test("a flagged, verified Workspace Google sign-in is an admin", () => {
  assert.equal(adminRefusal(admin), null);
});

test("every check is needed", () => {
  assert.equal(adminRefusal(undefined), "not signed in");
  assert.equal(adminRefusal({ ...admin, admin: undefined }), "not an admin");
  assert.equal(adminRefusal({ ...admin, email: "owner@gmail.com" }), "not an @appselerator.com account");
  assert.equal(adminRefusal({ ...admin, email: "x@appselerator.com.evil.in" }), "not an @appselerator.com account");
  assert.equal(adminRefusal({ ...admin, email_verified: false }), "email not verified");
  assert.equal(adminRefusal({ ...admin, firebase: { sign_in_provider: "phone" } }), "not a Google sign-in");
  // A truthy value that isn't exactly true doesn't count.
  assert.equal(adminRefusal({ ...admin, admin: "true" }), "not an admin");
});

const now = new Date("2026-11-09T10:00:00Z");

test("premium until a day lasts through that whole day, India time", () => {
  const record = grantedSubscription(
    "u1",
    { tier: "premium", until: parseDay("2027-03-31"), grantedBy: "a@appselerator.com", reason: "Friend" },
    now,
  );
  assert.equal(record.tier, "premium");
  assert.equal(record.status, "active");
  assert.equal(record.productId, "admin_grant");
  assert.equal(record.purchaseToken, null);
  assert.equal(record.expiryDate.toDate().toISOString(), "2027-03-31T18:29:59.000Z");
});

test("premium with no end date, and free, have no expiry", () => {
  const grant = { until: null, grantedBy: "a@appselerator.com", reason: "" };
  assert.equal(grantedSubscription("u1", { ...grant, tier: "premium" }, now).expiryDate, null);
  assert.equal(
    grantedSubscription("u1", { ...grant, tier: "free", until: parseDay("2027-01-01") }, now).expiryDate,
    null,
  );
});

test("a Play purchase is recognised so it isn't replaced by accident", () => {
  assert.equal(isPurchased({ purchaseToken: "abc" }), true);
  assert.equal(isPurchased({ purchaseToken: null, productId: "admin_grant" }), false);
  assert.equal(isPurchased(undefined), false);
});

test("dates and phone numbers", () => {
  assert.equal(parseDay("2027-02-30"), null);
  assert.equal(parseDay("31-03-2027"), null);
  assert.equal(normalisePhone("98450 12345"), "+919845012345");
  assert.equal(normalisePhone("+919845012345"), "+919845012345");
  assert.equal(normalisePhone("someUid123"), "someUid123");
});
