/**
 * WMO weather code -> human-readable condition text.
 * Ported from transfarm-app's OpenMeteoDataSource._getWeatherCondition so
 * this mapping lives in one place and can be updated without an app release.
 */
export function getWeatherCondition(code: number): string {
  switch (code) {
    case 0:
      return "Clear sky";
    case 1:
      return "Mainly clear";
    case 2:
      return "Partly cloudy";
    case 3:
      return "Overcast";
    case 45:
    case 48:
      return "Foggy";
    case 51:
    case 53:
    case 55:
      return "Drizzle";
    case 56:
    case 57:
      return "Freezing drizzle";
    case 61:
      return "Light rain";
    case 63:
      return "Moderate rain";
    case 65:
      return "Heavy rain";
    case 66:
    case 67:
      return "Freezing rain";
    case 71:
      return "Light snow";
    case 73:
      return "Moderate snow";
    case 75:
      return "Heavy snow";
    case 77:
      return "Snow grains";
    case 80:
    case 81:
    case 82:
      return "Rain showers";
    case 85:
    case 86:
      return "Snow showers";
    case 95:
      return "Thunderstorm";
    case 96:
    case 99:
      return "Thunderstorm with hail";
    default:
      return "Unknown";
  }
}

/** Ported from OpenMeteoDataSource._getWeatherIcon. */
export function getWeatherIcon(code: number, isDay: boolean): string {
  const dayNight = isDay ? "day" : "night";

  switch (code) {
    case 0:
      return `https://cdn.weatherapi.com/weather/64x64/${dayNight}/113.png`;
    case 1:
    case 2:
      return `https://cdn.weatherapi.com/weather/64x64/${dayNight}/116.png`;
    case 3:
      return "https://cdn.weatherapi.com/weather/64x64/day/119.png";
    case 45:
    case 48:
      return "https://cdn.weatherapi.com/weather/64x64/day/248.png";
    case 51:
    case 53:
    case 55:
    case 56:
    case 57:
      return "https://cdn.weatherapi.com/weather/64x64/day/263.png";
    case 61:
      return "https://cdn.weatherapi.com/weather/64x64/day/296.png";
    case 63:
      return "https://cdn.weatherapi.com/weather/64x64/day/302.png";
    case 65:
      return "https://cdn.weatherapi.com/weather/64x64/day/308.png";
    case 66:
    case 67:
      return "https://cdn.weatherapi.com/weather/64x64/day/311.png";
    case 71:
      return "https://cdn.weatherapi.com/weather/64x64/day/326.png";
    case 73:
      return "https://cdn.weatherapi.com/weather/64x64/day/332.png";
    case 75:
      return "https://cdn.weatherapi.com/weather/64x64/day/338.png";
    case 77:
      return "https://cdn.weatherapi.com/weather/64x64/day/374.png";
    case 80:
    case 81:
    case 82:
      return "https://cdn.weatherapi.com/weather/64x64/day/356.png";
    case 85:
    case 86:
      return "https://cdn.weatherapi.com/weather/64x64/day/368.png";
    case 95:
      return "https://cdn.weatherapi.com/weather/64x64/day/386.png";
    case 96:
    case 99:
      return "https://cdn.weatherapi.com/weather/64x64/day/389.png";
    default:
      return "https://cdn.weatherapi.com/weather/64x64/day/113.png";
  }
}

/** Ported from OpenMeteoDataSource._getWindDirection. */
export function getWindDirection(degrees: number): string {
  if (degrees >= 337.5 || degrees < 22.5) return "N";
  if (degrees < 67.5) return "NE";
  if (degrees < 112.5) return "E";
  if (degrees < 157.5) return "SE";
  if (degrees < 202.5) return "S";
  if (degrees < 247.5) return "SW";
  if (degrees < 292.5) return "W";
  return "NW";
}

/** Ported from OpenMeteoDataSource._isDay. `hour` is 0-23, local to the requested location. */
export function isDaytime(hour: number): boolean {
  return hour >= 6 && hour < 18;
}
