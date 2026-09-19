import { z } from "zod";
import { DEFAULT_FORECAST_DAYS, MAX_FORECAST_DAYS } from "./constants";

/** Request shape accepted by the `getWeatherForecast` callable function. */
export const weatherQuerySchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  days: z.number().int().positive().max(MAX_FORECAST_DAYS).default(DEFAULT_FORECAST_DAYS),
});

export type WeatherQuery = z.infer<typeof weatherQuerySchema>;

/**
 * Normalized shapes below intentionally mirror the Flutter app's
 * WeatherModel/ForecastDayModel/HourlyForecastModel `toJson()` /
 * `fromJsonCache()` contract (see transfarm-app), so the client can parse
 * the callable's result the same way it parses its own local cache, with
 * no extra mapping code.
 */
export interface NormalizedHourlyForecast {
  time: string;
  temperature: number;
  conditionText: string;
  iconUrl: string;
  chanceOfRain: number;
  windSpeed: number;
  humidity: number;
}

export interface NormalizedForecastDay {
  date: string;
  maxTemp: number;
  minTemp: number;
  conditionText: string;
  iconUrl: string;
  hourlyForecasts: NormalizedHourlyForecast[];
  totalPrecipitation: number;
  chanceOfRain: number;
}

export interface NormalizedWeather {
  temperature: number;
  feelsLike: number;
  condition: string;
  conditionText: string;
  humidity: number;
  windSpeed: number;
  windDirection: string;
  visibility: number;
  precipitation: number;
  uvIndex: number;
  airQualityIndex: string | null;
  iconUrl: string;
  lastUpdated: string;
  locationName: string;
  region: string;
  country: string;
  forecastDays: NormalizedForecastDay[];
  alerts: unknown[];
  sunrise: string | null;
  sunset: string | null;
}

/** Raw response shape from Open-Meteo's `/v1/forecast` endpoint (fields we use). */
export interface OpenMeteoResponse {
  timezone?: string;
  current: {
    time: string;
    temperature_2m: number;
    relative_humidity_2m: number;
    apparent_temperature: number;
    precipitation: number;
    weather_code: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
    uv_index: number;
    visibility: number;
  };
  daily?: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_sum: number[];
    precipitation_probability_max: number[];
    uv_index_max: number[];
    wind_speed_10m_max: number[];
    sunrise: string[];
    sunset: string[];
  };
  hourly?: {
    time: string[];
    temperature_2m: number[];
    precipitation_probability: number[];
    weather_code: number[];
    wind_speed_10m: number[];
    relative_humidity_2m: number[];
  };
}
