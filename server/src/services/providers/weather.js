import { BaseProvider } from './base.js';
import { fetchJson, safeNumber } from '../../lib/http.js';

export const WEATHER_CITIES = [
  { name: 'Accra', country: 'Ghana', region: 'Africa', latitude: 5.6037, longitude: -0.1870 },
  { name: 'New York', country: 'United States', region: 'Americas', latitude: 40.7128, longitude: -74.0060 },
  { name: 'London', country: 'United Kingdom', region: 'Europe', latitude: 51.5074, longitude: -0.1278 },
  { name: 'Singapore', country: 'Singapore', region: 'Asia', latitude: 1.3521, longitude: 103.8198 },
  { name: 'Tokyo', country: 'Japan', region: 'Asia', latitude: 35.6762, longitude: 139.6503 },
  { name: 'Sydney', country: 'Australia', region: 'Oceania', latitude: -33.8688, longitude: 151.2093 },
  { name: 'Dubai', country: 'United Arab Emirates', region: 'Middle East', latitude: 25.2048, longitude: 55.2708 },
  { name: 'Delhi', country: 'India', region: 'Asia', latitude: 28.6139, longitude: 77.2090 },
];

const WEATHER_CODES = {
  0: 'Clear sky', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Rime fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Dense drizzle', 61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 80: 'Rain showers', 81: 'Showers', 82: 'Heavy showers',
  95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Severe thunderstorm',
};

function fromOpenWeather(city, data) {
  return {
    ...city, type: 'weather', latitude: safeNumber(data.coord?.lat, city.latitude), longitude: safeNumber(data.coord?.lon, city.longitude),
    temperature: safeNumber(data.main?.temp), feelsLike: safeNumber(data.main?.feels_like), humidity: safeNumber(data.main?.humidity),
    windSpeed: safeNumber(data.wind?.speed), windDeg: safeNumber(data.wind?.deg), description: data.weather?.[0]?.description || 'Conditions unavailable',
    icon: data.weather?.[0]?.icon || null, source: 'OpenWeather', updatedAt: new Date().toISOString(),
  };
}

function fromOpenMeteo(city, data) {
  const current = data.current || {};
  const code = safeNumber(current.weather_code, -1);
  return {
    ...city, type: 'weather', temperature: safeNumber(current.temperature_2m), feelsLike: safeNumber(current.apparent_temperature),
    humidity: safeNumber(current.relative_humidity_2m), windSpeed: safeNumber(current.wind_speed_10m, 0) / 3.6,
    windDeg: safeNumber(current.wind_direction_10m), description: WEATHER_CODES[code] || 'Current conditions',
    icon: null, source: 'Open-Meteo', updatedAt: current.time || new Date().toISOString(),
  };
}

export class WeatherProvider extends BaseProvider {
  constructor() { super('weather', { ttlMs: 10 * 60_000, requiredKeys: [], emptyValue: [] }); }
  async _fetchFresh() {
    const key = this.secret('OPENWEATHER_API_KEY');
    let openWeatherFailed = false;
    if (key) {
      const results = await Promise.allSettled(WEATHER_CITIES.map(async (city) => {
        const params = new URLSearchParams({ lat: String(city.latitude), lon: String(city.longitude), appid: key, units: 'metric' });
        return fromOpenWeather(city, await fetchJson(`https://api.openweathermap.org/data/2.5/weather?${params}`));
      }));
      const valid = results.filter((item) => item.status === 'fulfilled').map((item) => item.value);
      if (valid.length) {
        if (valid.length < WEATHER_CITIES.length) valid.partial = true;
        return valid;
      }
      // A temporary OpenWeather problem should not remove baseline weather coverage.
      openWeatherFailed = true;
    }
    const latitudes = WEATHER_CITIES.map((city) => city.latitude).join(',');
    const longitudes = WEATHER_CITIES.map((city) => city.longitude).join(',');
    const params = new URLSearchParams({
      latitude: latitudes, longitude: longitudes,
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m',
      timezone: 'UTC',
    });
    const response = await fetchJson(`https://api.open-meteo.com/v1/forecast?${params}`);
    const points = Array.isArray(response) ? response : [response];
    const data = points.map((point, index) => fromOpenMeteo(WEATHER_CITIES[index], point)).filter((item) => Number.isFinite(item.temperature));
    if (!data.length) throw new Error('Weather feeds returned no current observations');
    if (openWeatherFailed) data.fallback = true;
    return data;
  }
  get isConfigured() { return true; }
}
