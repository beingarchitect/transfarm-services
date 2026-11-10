import assert from "node:assert/strict";
import { test } from "node:test";
import { Timestamp } from "firebase-admin/firestore";
import {
  buildDefaultDocs,
  DEFAULT_FARM_LISTS,
  farmListDocSchema,
  farmingPracticeFrom,
  farmTypesFrom,
  isSupportedLanguage,
  itemsForFarm,
} from "./defaults";

const now = new Date("2026-01-01T00:00:00.000Z");

test("only the app's languages are supported", () => {
  assert.equal(isSupportedLanguage("kn"), true);
  assert.equal(isSupportedLanguage("ta"), false);
  assert.equal(isSupportedLanguage(undefined), false);
});

test("each built-in list matches what the masterData documents must hold", () => {
  for (const categories of Object.values(DEFAULT_FARM_LISTS)) {
    assert.equal(farmListDocSchema.safeParse({ categories }).success, true);
  }
});

test("a masterData document needs its items in the current shape", () => {
  const oldShape = { categories: [{ name: "Labour", description: "Wages" }] };
  assert.equal(farmListDocSchema.safeParse(oldShape).success, false);
  assert.equal(farmListDocSchema.safeParse({ categories: [] }).success, false);
  assert.equal(farmListDocSchema.safeParse(undefined).success, false);
});

test("names stay plain text, which older app versions read directly", () => {
  for (const items of Object.values(DEFAULT_FARM_LISTS)) {
    for (const item of items) assert.equal(typeof item.name, "string");
  }
});

test("keys are unique within each list", () => {
  for (const items of Object.values(DEFAULT_FARM_LISTS)) {
    const keys = items.map((item) => item.key);
    assert.equal(new Set(keys).size, keys.length);
  }
});

test("IDs are millisecond strings, like the ones the app generates", () => {
  for (const doc of buildDefaultDocs("farm1", "en", DEFAULT_FARM_LISTS, now)) {
    assert.match(doc.id, /^\d{13}$/);
    assert.equal(doc.data.id, doc.id);
  }
});

test("IDs are unique within each list, so a list can't overwrite itself", () => {
  const docs = buildDefaultDocs("farm1", "en", DEFAULT_FARM_LISTS, now);
  for (const list of Object.keys(DEFAULT_FARM_LISTS)) {
    const ids = docs.filter((doc) => doc.subcollection === list).map((doc) => doc.id);
    assert.equal(new Set(ids).size, ids.length);
  }
});

test("each farm copy records which default it came from", () => {
  const docs = buildDefaultDocs("farm1", "kn", DEFAULT_FARM_LISTS, now);
  const expense = docs.filter((doc) => doc.subcollection === "expenseCategories");
  assert.deepEqual(
    expense.map((doc) => doc.data.defaultKey),
    DEFAULT_FARM_LISTS.expenseCategories.map((item) => item.key),
  );
});

test("names use the requested language", () => {
  const fuel = (language: "en" | "hi") =>
    buildDefaultDocs("farm1", language, DEFAULT_FARM_LISTS, now).find(
      (doc) => doc.subcollection === "expenseCategories" && doc.data.defaultKey === "fuel",
    );
  assert.equal(fuel("en")?.data.name, "Fuel");
  assert.equal(fuel("hi")?.data.name, "ईंधन");
  assert.equal(fuel("hi")?.data.farmId, "farm1");
});

test("descriptions are only added in English", () => {
  const labour = (language: "en" | "kn") =>
    buildDefaultDocs("farm1", language, DEFAULT_FARM_LISTS, now).find((doc) => doc.data.defaultKey === "labour");
  assert.equal(labour("en")?.data.description, "Daily wages, piece-rate, and contract labour");
  assert.equal("description" in (labour("kn")?.data ?? {}), false);
});

test("contact roles use timestamps and the category lists use ISO strings", () => {
  for (const doc of buildDefaultDocs("farm1", "en", DEFAULT_FARM_LISTS, now)) {
    if (doc.subcollection === "contactRoles") {
      assert.ok(doc.data.createdAt instanceof Timestamp);
      assert.ok(doc.data.updatedAt instanceof Timestamp);
    } else {
      assert.equal(doc.data.createdAt, now.toISOString());
      assert.equal(doc.data.updatedAt, now.toISOString());
    }
  }
});

const keysFor = (list: keyof typeof DEFAULT_FARM_LISTS, types: string[]) =>
  itemsForFarm(DEFAULT_FARM_LISTS[list], types).map((item) => item.key);

test("a farm with no type gets the general lists, as before farm types", () => {
  const keys = keysFor("expenseCategories", []);
  assert.ok(keys.includes("labour"));
  assert.ok(!keys.includes("feed_fodder"));
  assert.ok(!keys.includes("pots_soil"));
  assert.ok(!keysFor("incomeCategories", []).includes("milk_sales"));
});

test("livestock farms get animal categories and a vet", () => {
  assert.ok(keysFor("expenseCategories", ["livestock"]).includes("feed_fodder"));
  assert.ok(keysFor("incomeCategories", ["livestock"]).includes("milk_sales"));
  assert.ok(keysFor("contactRoles", ["livestock"]).includes("veterinarian"));
});

test("a terrace garden alone drops labour and tractors; mixed with crops it keeps them", () => {
  const terrace = keysFor("expenseCategories", ["terrace_garden"]);
  assert.ok(!terrace.includes("labour"));
  assert.ok(!terrace.includes("equipment"));
  assert.ok(terrace.includes("pots_soil"));
  const mixed = keysFor("expenseCategories", ["terrace_garden", "vegetables"]);
  assert.ok(mixed.includes("labour"));
  assert.ok(mixed.includes("packing_grading"));
});

test("only known farm types are read from the farm", () => {
  assert.deepEqual(farmTypesFrom(["livestock", "spaceship", 3]), ["livestock"]);
  assert.deepEqual(farmTypesFrom("livestock"), []);
  assert.deepEqual(farmTypesFrom(undefined), []);
});

const keysWith = (list: keyof typeof DEFAULT_FARM_LISTS, types: string[], practice: string | null) =>
  itemsForFarm(DEFAULT_FARM_LISTS[list], types, practice).map((item) => item.key);

test("organic and natural farms get organic inputs; chemical farms don't", () => {
  assert.ok(keysWith("expenseCategories", [], "organic").includes("organic_inputs"));
  assert.ok(keysWith("expenseCategories", [], "natural").includes("organic_inputs"));
  assert.ok(keysWith("inventoryCategories", [], "transitioning").includes("organic_inputs"));
  assert.ok(!keysWith("expenseCategories", [], "chemical").includes("organic_inputs"));
  assert.ok(!keysWith("expenseCategories", [], null).includes("organic_inputs"));
});

test("certification is for organic and transitioning farms only", () => {
  assert.ok(keysWith("expenseCategories", [], "organic").includes("organic_certification"));
  assert.ok(!keysWith("expenseCategories", [], "natural").includes("organic_certification"));
});

test("the practice doesn't stop a terrace garden counting as terrace-only", () => {
  const keys = keysWith("expenseCategories", ["terrace_garden"], "organic");
  assert.ok(!keys.includes("labour"));
  assert.ok(keys.includes("organic_inputs"));
});

test("agroforestry farms get tree produce sales", () => {
  assert.ok(keysWith("incomeCategories", ["agroforestry"], null).includes("tree_produce"));
});

test("only known practices are read from the farm", () => {
  assert.equal(farmingPracticeFrom("organic"), "organic");
  assert.equal(farmingPracticeFrom("biodynamic"), null);
  assert.equal(farmingPracticeFrom(undefined), null);
});
