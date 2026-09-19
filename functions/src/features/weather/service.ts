import { normalizeOpenMeteoResponse } from "./normalize";
import { fetchOpenMeteoForecast } from "./openMeteoClient";
import { NormalizedWeather, WeatherQuery } from "./types";

/**
 * Fetches and normalizes a weather forecast from Open-Meteo. The returned
 * shape matches transfarm-app's WeatherModel `fromJsonCache`/`toJson`
 * contract so the client can parse it directly.
 */
export async function getWeatherForecast(query: WeatherQuery): Promise<NormalizedWeather> {
  const raw = await fetchOpenMeteoForecast(query);
  return normalizeOpenMeteoResponse(raw, query.latitude, query.longitude);
}
