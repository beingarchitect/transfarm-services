import assert from "node:assert/strict";
import { test } from "node:test";
import { toEvent } from "./importPublicEvents";

const row = {
  id: "krishi-mela-gkvk-2026",
  title: "Krishi Mela 2026",
  titleKn: "ಕೃಷಿ ಮೇಳ 2026",
  titleHi: "",
  description: "Annual farm fair",
  descriptionKn: "",
  descriptionHi: "",
  startDate: "2026-11-20",
  endDate: "2026-11-23",
  venue: "GKVK, Bengaluru",
  organizer: "UAS Bangalore",
  link: "https://uasbangalore.edu.in",
  state: "Karnataka",
  districts: "",
};

test("a complete row becomes an event the app can read", () => {
  const { errors, data } = toEvent(row);
  assert.deepEqual(errors, []);
  assert.deepEqual(data.title, { en: "Krishi Mela 2026", kn: "ಕೃಷಿ ಮೇಳ 2026" });
  assert.equal(data.stateKey, "karnataka");
  assert.deepEqual(data.districts, []);
});

test("districts narrow it to part of the state", () => {
  const { data } = toEvent({ ...row, districts: "Ramanagara | Bengaluru Rural" });
  assert.deepEqual(data.districts, ["Ramanagara", "Bengaluru Rural"]);
});

test("national events use ALL", () => {
  assert.equal(toEvent({ ...row, state: "ALL" }).data.stateKey, "all");
});

test("problems are reported, not loaded", () => {
  const { errors } = toEvent({ ...row, startDate: "20/11/2026", endDate: "2026-11-19", link: "uas.edu" });
  assert.ok(errors.includes("startDate must be YYYY-MM-DD"));
  assert.ok(errors.includes("link must start with http"));
  assert.deepEqual(toEvent({ ...row, endDate: "2026-11-19" }).errors, ["endDate is before startDate"]);
});

test("required columns can't be left blank", () => {
  assert.deepEqual(toEvent({ ...row, venue: "", state: "" }).errors, ["missing venue", "missing state"]);
});
