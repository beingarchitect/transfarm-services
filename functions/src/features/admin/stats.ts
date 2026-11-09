// Numbers for the admin Overview. Pure helpers here; reading Firestore and
// Auth is in service.ts. No Admin SDK setup in this file, so tests can
// import it.

/** The collections counted as "records per feature", with their labels. */
export const RECORD_COLLECTIONS: Record<string, string> = {
  expenses: "Expenses",
  income: "Income",
  tasks: "Tasks",
  notes: "Notes",
  labourers: "Labourers",
  attendance: "Attendance",
  labour_payments: "Labour payments",
  crops: "Crops",
  field_plots: "Field plots",
  irrigation_logs: "Irrigation logs",
  soil_tests: "Soil tests",
  inventory: "Inventory items",
  files: "Media",
  contacts: "Contacts",
  conversations: "MitrAI chats",
};

export interface AdminStats {
  generatedAt: string;
  users: { total: number; active7: number; active30: number; new7: number; new30: number };
  farms: { total: number; new7: number; new30: number; perWeek: { week: string; count: number }[] };
  plans: { premiumFarms: number; premiumOwners: number; grantedOwners: number };
  records: { key: string; label: string; count: number }[];
}

const DAY = 24 * 3600 * 1000;

/** How many of [dates] fall within the last [days] before [now]. */
export function within(dates: (Date | null)[], days: number, now: Date): number {
  const since = now.getTime() - days * DAY;
  return dates.filter((d) => d !== null && d.getTime() >= since && d.getTime() <= now.getTime()).length;
}

/**
 * Counts per week for the last [weeks] weeks, oldest first. Weeks start on
 * Monday (UTC) and are labelled by that Monday, e.g. "2026-11-09".
 */
export function perWeek(dates: (Date | null)[], now: Date, weeks = 8): { week: string; count: number }[] {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const mondayOffset = (new Date(today).getUTCDay() + 6) % 7;
  const thisMonday = today - mondayOffset * DAY;
  const buckets = Array.from({ length: weeks }, (_, i) => ({
    start: thisMonday - (weeks - 1 - i) * 7 * DAY,
    count: 0,
  }));
  for (const d of dates) {
    if (!d) continue;
    const t = d.getTime();
    for (let i = buckets.length - 1; i >= 0; i--) {
      if (t >= buckets[i].start) {
        if (t < buckets[i].start + 7 * DAY) buckets[i].count++;
        break;
      }
    }
  }
  return buckets.map((b) => ({ week: new Date(b.start).toISOString().slice(0, 10), count: b.count }));
}

/** A stored date (ISO string or Firestore Timestamp) as a Date, or null. */
export function toDate(value: unknown): Date | null {
  if (typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (value && typeof (value as { toDate?: unknown }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}
