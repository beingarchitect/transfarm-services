import assert from "node:assert/strict";
import { test } from "node:test";
import { TOOL_GROUPS, toolsAllowedBy } from "./access";
import { AI_FUNCTION_DECLARATIONS } from "./tools";

const names = (access: unknown) => toolsAllowedBy(AI_FUNCTION_DECLARATIONS, access).map((d) => d.name);

test("every lookup belongs to a group", () => {
  for (const declaration of AI_FUNCTION_DECLARATIONS) {
    assert.ok(TOOL_GROUPS[declaration.name], declaration.name);
  }
});

test("a farm that hasn't chosen allows nothing", () => {
  assert.deepEqual(names(undefined), []);
  assert.deepEqual(names(null), []);
  assert.deepEqual(names({}), []);
});

test("only the allowed groups' lookups are offered", () => {
  const offered = names({ finances: true, work: false, workers: false, land: false });
  assert.ok(offered.includes("get_expense_summary"));
  assert.ok(!offered.includes("get_tasks"));
  assert.ok(!offered.includes("get_labour_summary"));
  assert.ok(!offered.includes("get_crops"));
});

test("land covers crops, soil, plots and irrigation", () => {
  assert.deepEqual(names({ land: true }).sort(), [
    "get_crops",
    "get_farm_plots",
    "get_irrigation_logs",
    "get_soil_tests",
  ]);
});

test("anything other than true counts as not allowed", () => {
  assert.deepEqual(names({ finances: "yes", work: 1 }), []);
});
