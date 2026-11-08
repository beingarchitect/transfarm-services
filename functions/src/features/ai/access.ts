// No Admin SDK setup in this file, so tests can import it.

/** Groups of farm records a farm can let MitrAI read; stored on the farm. */
export const AI_DATA_GROUPS = ["finances", "work", "workers", "land"] as const;
export type AiDataGroup = (typeof AI_DATA_GROUPS)[number];

/** Which group each lookup reads. A lookup missing here is never offered. */
export const TOOL_GROUPS: Record<string, AiDataGroup> = {
  get_farm_expenses: "finances",
  get_farm_income: "finances",
  get_expense_summary: "finances",
  get_income_summary: "finances",
  get_budget_overview: "finances",
  get_tasks: "work",
  get_tasks_summary: "work",
  get_notes: "work",
  get_labour_records: "workers",
  get_labour_summary: "workers",
  get_attendance_records: "workers",
  get_attendance_summary: "workers",
  get_crops: "land",
  get_soil_tests: "land",
  get_field_plots: "land",
  get_irrigation_logs: "land",
};

/**
 * The lookups a farm's `aiDataAccess` allows. A farm that hasn't chosen yet
 * allows none.
 */
export function toolsAllowedBy<T extends { name: string }>(declarations: readonly T[], access: unknown): T[] {
  const allowed = new Set<AiDataGroup>(
    AI_DATA_GROUPS.filter(
      (group) => typeof access === "object" && access !== null && (access as Record<string, unknown>)[group] === true,
    ),
  );
  return declarations.filter((d) => {
    const group = TOOL_GROUPS[d.name];
    return group !== undefined && allowed.has(group);
  });
}
