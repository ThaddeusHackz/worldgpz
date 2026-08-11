import { ProviderBase } from "./base.js";

/**
 * OpenWeather Current Weather API. The free current-conditions endpoint is
 * used instead of One Call 3.0 so a billing-enabled subscription is not
 * required. Observations are sampled at globally distributed watch points.
 */
const LOCATIONS = [
  {
    id: "accra",
    name: "Accra",
    region: "Africa",
    latitude: 5.56,
    longitude: -0.2,
  },
  {
    id: "london",
    name: "London",
    region: "Europe",
    latitude: 51.51,
    longitude: -0.13,
  },
  {
    id: "new-york",
    name: "New York",
    region: "Americas",
    latitude: 40.71,
    longitude: -74.01,
  },
  {
    id: "sao-paulo",
    name: "São Paulo",
    region: "Americas",
    latitude: -23.55,
    longitude: -46.63,
  },
  {
    id: "dubai",
    name: "Dubai",
    region: "Middle East",
    latitude: 25.2,
    longitude: 55.27,
  },
  {
    id: "delhi",
    name: "Delhi",
    region: "Asia",
    latitude: 28.61,
    longitude: 77.21,
  },
  {
    id: "singapore",
    name: "Singapore",
    region: "Asia Pacific",
    latitude: 1.29,
    longitude: 103.85,
  },
  {
    id: "sydney",
    name: "Sydney",
    region: "Oceania",
    latitude: -33.87,
    longitude: 151.21,
  },
];

const severityFor = ({ windSpeedKmh, gustKmh, rainMm, conditionId }) => {
  const severeCode = conditionId >= 200 && conditionId < 600;
  if (windSpeedKmh >= 90 || gustKmh >= 110 || rainMm >= 30) return "critical";
  if (windSpeedKmh >= 60 || gustKmh >= 80 || rainMm >= 15 || severeCode)
    return "high";
  if (windSpeedKmh >= 35 || gustKmh >= 50 || rainMm >= 5) return "medium";
  return "low";
};

export class OpenWeatherService extends ProviderBase {
  constructor(config, options = {}) {
    super(config, {
      name: "OpenWeather",
      group: "Weather",
      cacheSeconds: 600,
      ...options,
    });
  }

  get configured() {
    return Boolean(this.config.weatherApiKey);
  }

  async #observation(location) {
    const url = new URL("https://api.openweathermap.org/data/2.5/weather");
    url.searchParams.set("lat", String(location.latitude));
    url.searchParams.set("lon", String(location.longitude));
    url.searchParams.set("units", "metric");
    url.searchParams.set("appid", this.config.weatherApiKey);
    const payload = await this.fetchJson(url);
    const windSpeedKmh = Number(payload.wind?.speed || 0) * 3.6;
    const gustKmh = Number(payload.wind?.gust || 0) * 3.6;
    const rainMm = Number(payload.rain?.["1h"] || payload.snow?.["1h"] || 0);
    const condition = payload.weather?.[0] || {};
    const observation = {
      id: location.id,
      name: payload.name || location.name,
      region: location.region,
      country: payload.sys?.country || null,
      latitude: Number(payload.coord?.lat ?? location.latitude),
      longitude: Number(payload.coord?.lon ?? location.longitude),
      temperatureC: Number(payload.main?.temp),
      feelsLikeC: Number(payload.main?.feels_like),
      humidity: Number(payload.main?.humidity),
      pressureHpa: Number(payload.main?.pressure),
      windSpeedKmh,
      gustKmh,
      rainMm,
      condition:
        condition.description || condition.main || "Current conditions",
      conditionId: Number(condition.id || 0),
      icon: condition.icon || null,
      observedAt: payload.dt
        ? new Date(payload.dt * 1000).toISOString()
        : new Date().toISOString(),
    };
    observation.severity = severityFor(observation);
    return observation;
  }

  async collect() {
    const settled = await Promise.allSettled(
      LOCATIONS.map((location) => this.#observation(location)),
    );
    const observations = settled.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : [],
    );
    if (!observations.length) {
      const firstError = settled.find((result) => result.status === "rejected");
      throw (
        firstError?.reason || new Error("OpenWeather returned no observations")
      );
    }
    return {
      observations,
      total: observations.length,
      partial: observations.length !== LOCATIONS.length,
      coverage: `${observations.length}/${LOCATIONS.length} global watch points`,
      attribution: "Weather data by OpenWeather",
    };
  }

  async events() {
    const snapshot = await this.snapshot();
    if (snapshot.status !== "operational") return [];
    return snapshot.observations.map((item) => ({
      id: `openweather-${item.id}-${item.observedAt}`,
      title: `${item.name} · ${item.condition}`,
      summary:
        `${Number.isFinite(item.temperatureC) ? item.temperatureC.toFixed(1) : "—"}°C · ` +
        `wind ${item.windSpeedKmh.toFixed(0)} km/h · humidity ${item.humidity || "—"}%`,
      category: "climate",
      severity: item.severity,
      status:
        item.severity === "critical" || item.severity === "high"
          ? "watch"
          : "verified",
      region: item.region,
      country: item.country || item.name,
      latitude: item.latitude,
      longitude: item.longitude,
      temperature: item.temperatureC,
      windSpeed: item.windSpeedKmh,
      sourceName: "OpenWeather",
      sourceUrl: "https://openweathermap.org/",
      publishedAt: item.observedAt,
      live: true,
    }));
  }
}
