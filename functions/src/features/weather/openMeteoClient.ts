import { fetchJson } from "../../common/httpClient";
import { OPEN_METEO_BASE_URL } from "./constants";
import { OpenMeteoResponse, WeatherQuery } from "./types";

const CURRENT_PARAMS = [
  "temperature_2m",
  "relative_humidity_2m",
  "apparent_temperature",
  "precipitation",
  "weather_code",
  "wind_speed_10m",
  "wind_direction_10m",
  "uv_index",
  "visibility",
].join(",");

const DAILY_PARAMS = [
  "weather_code",
  "temperature_2m_max",
  "temperature_2m_min",
  "precipitation_sum",
  "precipitation_probability_max",
  "uv_index_max",
  "wind_speed_10m_max",
  "sunrise",
  "sunset",
].join(",");

// Includes wind_speed_10m/relative_humidity_2m in addition to what the
// original Flutter client requested, so hourly forecasts carry real values
// instead of the hardcoded 0s the client used to fall back to.
const HOURLY_PARAMS = [
  "temperature_2m",
  "precipitation_probability",
  "weather_code",
  "wind_speed_10m",
  "relative_humidity_2m",
].join(",");

export async function fetchOpenMeteoForecast(query: WeatherQuery): Promise<OpenMeteoResponse> {
  const url = new URL(`${OPEN_METEO_BASE_URL}/forecast`);
  url.searchParams.set("latitude", String(query.latitude));
  url.searchParams.set("longitude", String(query.longitude));
  url.searchParams.set("current", CURRENT_PARAMS);
  url.searchParams.set("daily", DAILY_PARAMS);
  url.searchParams.set("hourly", HOURLY_PARAMS);
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", String(query.days));

  return fetchJson<OpenMeteoResponse>(url.toString());
}
