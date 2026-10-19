import { onSchedule } from "firebase-functions/v2/scheduler";
import { recordRainfallForAllFarms } from "./service";

/**
 * Scheduled job running daily at 6:30 AM IST. Stores yesterday's rainfall
 * (and re-checks the previous week) for every farm with a location, under
 * `rainfall_records/{farmId}_{YYYY-MM-DD}`. Runs server-side so the history
 * has no gaps even when nobody opens the app.
 */
export const recordDailyRainfall = onSchedule(
  {
    schedule: "30 6 * * *",
    timeZone: "Asia/Kolkata",
    minInstances: 0,
    timeoutSeconds: 540,
  },
  async () => {
    await recordRainfallForAllFarms();
  },
);
