import { HttpsError, onCall } from "firebase-functions/v2/https";
import { getWeatherForecast as fetchNormalizedForecast } from "./service";
import { weatherQuerySchema } from "./types";

/**
 * Callable function used by the Flutter app to fetch a normalized weather
 * forecast (current conditions + daily/hourly forecast) for a given
 * location. Internally proxies Open-Meteo (no API key required), so the
 * condition/icon mapping logic can be updated server-side without an app
 * release.
 *
 * `days` is a plain, caller-supplied value (capped at MAX_FORECAST_DAYS).
 * If forecast range ever needs to be gated by subscription tier, that
 * check belongs here (e.g. inspect `request.auth` and clamp `days`/strip
 * hourly data) rather than trusting the client to request less.
 */
export const getWeatherForecast = onCall(async (request) => {
  const parsed = weatherQuerySchema.safeParse(request.data ?? {});

  if (!parsed.success) {
    throw new HttpsError("invalid-argument", "Invalid weather query", parsed.error.flatten());
  }

  try {
    return await fetchNormalizedForecast(parsed.data);
  } catch (err) {
    throw new HttpsError(
      "unavailable",
      `Failed to fetch weather forecast: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
});
