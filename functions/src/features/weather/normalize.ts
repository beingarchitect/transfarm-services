import { getWeatherCondition, getWeatherIcon, getWindDirection, isDaytime } from "./weatherCodes";
import { NormalizedForecastDay, NormalizedHourlyForecast, NormalizedWeather, OpenMeteoResponse } from "./types";

/** Extracts the `YYYY-MM-DD` date part from an Open-Meteo ISO-ish timestamp. */
function datePartOf(isoLike: string): string {
  return isoLike.slice(0, 10);
}

/** Extracts the hour (0-23) from an Open-Meteo ISO-ish timestamp, without going through Date/timezone conversion. */
function hourOf(isoLike: string): number {
  return Number(isoLike.slice(11, 13));
}

function locationNameFor(latitude: number, longitude: number): string {
  return `${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°`;
}

function hourlyForecastsForDay(hourly: NonNullable<OpenMeteoResponse["hourly"]>, date: string): NormalizedHourlyForecast[] {
  const forecasts: NormalizedHourlyForecast[] = [];

  for (let i = 0; i < hourly.time.length; i++) {
    const time = hourly.time[i];
    if (datePartOf(time) !== date) {
      continue;
    }

    const weatherCode = hourly.weather_code[i];
    forecasts.push({
      time,
      temperature: hourly.temperature_2m[i],
      chanceOfRain: hourly.precipitation_probability?.[i] ?? 0,
      conditionText: getWeatherCondition(weatherCode),
      iconUrl: getWeatherIcon(weatherCode, isDaytime(hourOf(time))),
      windSpeed: hourly.wind_speed_10m?.[i] ?? 0,
      humidity: hourly.relative_humidity_2m?.[i] ?? 0,
    });
  }

  return forecasts;
}

export function normalizeOpenMeteoResponse(
  raw: OpenMeteoResponse,
  latitude: number,
  longitude: number,
): NormalizedWeather {
  const { current, daily, hourly } = raw;

  const forecastDays: NormalizedForecastDay[] = [];
  if (daily) {
    for (let i = 0; i < daily.time.length; i++) {
      const date = daily.time[i];
      const weatherCode = daily.weather_code[i];

      forecastDays.push({
        date,
        maxTemp: daily.temperature_2m_max[i],
        minTemp: daily.temperature_2m_min[i],
        conditionText: getWeatherCondition(weatherCode),
        iconUrl: getWeatherIcon(weatherCode, true),
        totalPrecipitation: daily.precipitation_sum[i] ?? 0,
        chanceOfRain: daily.precipitation_probability_max[i] ?? 0,
        hourlyForecasts: hourly ? hourlyForecastsForDay(hourly, date) : [],
      });
    }
  }

  return {
    temperature: current.temperature_2m,
    feelsLike: current.apparent_temperature,
    condition: String(current.weather_code),
    conditionText: getWeatherCondition(current.weather_code),
    humidity: current.relative_humidity_2m,
    windSpeed: current.wind_speed_10m,
    windDirection: getWindDirection(current.wind_direction_10m),
    visibility: current.visibility / 1000,
    precipitation: current.precipitation,
    uvIndex: current.uv_index,
    airQualityIndex: null,
    iconUrl: getWeatherIcon(current.weather_code, true),
    lastUpdated: current.time,
    locationName: locationNameFor(latitude, longitude),
    region: "",
    country: "",
    forecastDays,
    alerts: [],
    sunrise: daily?.sunrise?.[0] ?? null,
    sunset: daily?.sunset?.[0] ?? null,
  };
}
