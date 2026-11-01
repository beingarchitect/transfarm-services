import assert from "node:assert/strict";
import { test } from "node:test";
import { chooseSuccessor } from "./plan";

const owner = { profileId: "owner", role: "owner", addedAt: "2026-01-01" };

test("no other members: no successor", () => {
  assert.equal(chooseSuccessor([owner], "owner"), undefined);
});

test("managers and guests never inherit", () => {
  const members = [
    owner,
    { profileId: "m", role: "manager", addedAt: "2026-01-02" },
    { profileId: "g", role: "guest", addedAt: "2026-01-03" },
  ];
  assert.equal(chooseSuccessor(members, "owner"), undefined);
});

test("a co-owner who hasn't signed up can't inherit", () => {
  const members = [owner, { profileId: "pending_123", role: "coowner", addedAt: "2026-01-02" }];
  assert.equal(chooseSuccessor(members, "owner"), undefined);
});

test("the longest-standing co-owner inherits", () => {
  const members = [
    owner,
    { profileId: "newer", role: "coowner", addedAt: "2026-03-01" },
    { profileId: "older", role: "coowner", addedAt: "2026-02-01" },
    { profileId: "m", role: "manager", addedAt: "2026-01-02" },
  ];
  assert.equal(chooseSuccessor(members, "owner"), "older");
});
