import assert from "node:assert/strict";
import { test } from "node:test";
import { recordConsentSchema } from "./schema";

const valid = {
  termsVersion: "2026-11-12",
  privacyVersion: "2026-11-12",
  language: "kn",
  appVersion: "1.0.0+12",
  method: "login_checkbox",
};

test("accepts what the app sends", () => {
  assert.equal(recordConsentSchema.safeParse(valid).success, true);
  assert.equal(recordConsentSchema.safeParse({ ...valid, appVersion: undefined }).success, true);
});

test("needs both versions, a language and a known method", () => {
  for (const bad of [
    { ...valid, termsVersion: "" },
    { ...valid, privacyVersion: undefined },
    { ...valid, language: "" },
    { ...valid, method: "assumed" },
  ]) {
    assert.equal(recordConsentSchema.safeParse(bad).success, false);
  }
});

test("the time can't be supplied by the app", () => {
  const parsed = recordConsentSchema.parse({ ...valid, acceptedAt: "2020-01-01" });
  assert.equal("acceptedAt" in parsed, false);
});
