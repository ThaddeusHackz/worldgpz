import { publicSources } from "../data/seed.js";

const weatherLocations = [
  {
    name: "North Atlantic",
    region: "Americas",
    latitude: 28.5,
    longitude: -55.2,
  },
  {
    name: "Western Pacific",
    region: "Asia Pacific",
    latitude: 19.8,
    longitude: 137.4,
  },
  { name: "Mediterranean", region: "Europe", latitude: 36.2, longitude: 18.4 },
  { name: "East Africa", region: "Africa", latitude: 1.3, longitude: 36.8 },
  { name: "South Asia", region: "Asia", latitude: 22.4, longitude: 82.1 },
  {
    name: "South Pacific",
    region: "Oceania",
    latitude: -24.2,
    longitude: 166.5,
  },
];

const coordinatesByCountry = {
  Ukraine: [49, 32],
  Sudan: [15.5, 30.2],
  Palestine: [31.9, 35.2],
  Somalia: [5.1, 46.2],
  Yemen: [15.6, 48.5],
  Myanmar: [21.9, 96],
  Haiti: [19, -72.7],
  Afghanistan: [33.9, 67.7],
  Syria: [35, 38.5],
  Ethiopia: [9.1, 40.5],
  "Democratic Republic of the Congo": [-2.8, 23.7],
};

export class LiveSourcesService {
  constructor(config) {
    this.config = config;
    this.cache = null;
    this.cachedAt = 0;
  }

  async #fetchJson(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(this.config.fetchTimeoutMs),
      headers: {
        "User-Agent": "WORLDGPZ/2.0 (public monitoring dashboard)",
        ...options.headers,
      },
    });
    if (!response.ok) throw new Error(`Provider returned ${response.status}`);
    return response.json();
  }

  async #earthquakes() {
    const url =
      "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson";
    const data = await this.#fetchJson(url);
    return data.features.slice(0, 30).map((feature) => ({
      id: `usgs-${feature.id}`,
      title: feature.properties.title,
      summary: `Magnitude ${feature.properties.mag?.toFixed(1) ?? "—"} seismic event at a depth of ${feature.geometry.coordinates[2]?.toFixed(1) ?? "—"} km.`,
      category: "seismic",
      severity:
        feature.properties.mag >= 6
          ? "critical"
          : feature.properties.mag >= 5
            ? "high"
            : "medium",
      status: feature.properties.tsunami ? "monitoring" : "verified",
      region: "Global",
      country: feature.properties.place || "Unknown",
      latitude: feature.geometry.coordinates[1],
      longitude: feature.geometry.coordinates[0],
      magnitude: feature.properties.mag,
      sourceName: "USGS",
      sourceUrl: feature.properties.url,
      publishedAt: new Date(feature.properties.time).toISOString(),
      live: true,
    }));
  }

  async #weather() {
    const latitudes = weatherLocations.map((item) => item.latitude).join(",");
    const longitudes = weatherLocations.map((item) => item.longitude).join(",");
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitudes}&longitude=${longitudes}&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_gusts_10m&timezone=UTC`;
    const payload = await this.#fetchJson(url);
    const responses = Array.isArray(payload) ? payload : [payload];
    return responses.map((item, index) => {
      const location = weatherLocations[index];
      const wind = item.current?.wind_speed_10m || 0;
      const precipitation = item.current?.precipitation || 0;
      const severe = wind >= 60 || precipitation >= 15;
      return {
        id: `weather-${index}`,
        title: `${location.name} weather observation`,
        summary: `${item.current?.temperature_2m ?? "—"}°C · wind ${wind} km/h · precipitation ${precipitation} mm`,
        category: "climate",
        severity: severe
          ? "high"
          : wind >= 35 || precipitation >= 5
            ? "medium"
            : "low",
        status: severe ? "watch" : "verified",
        region: location.region,
        country: location.name,
        latitude: location.latitude,
        longitude: location.longitude,
        temperature: item.current?.temperature_2m,
        windSpeed: wind,
        sourceName: "Open-Meteo",
        sourceUrl: "https://open-meteo.com/",
        publishedAt: item.current?.time
          ? `${item.current.time}:00Z`
          : new Date().toISOString(),
        live: true,
      };
    });
  }

  async #naturalEvents() {
    const payload = await this.#fetchJson(
      "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=30",
    );
    return (payload.events || []).flatMap((event) => {
      const geometry = event.geometry?.at(-1);
      if (!geometry || geometry.type !== "Point" || !geometry.coordinates)
        return [];
      const [longitude, latitude] = geometry.coordinates;
      const category = event.categories?.[0]?.title || "Natural event";
      return [
        {
          id: `eonet-${event.id}`,
          title: event.title,
          summary: `${category} tracked by NASA's Earth Observatory Natural Event Tracker.`,
          category: "natural",
          severity: ["Wildfires", "Severe Storms", "Volcanoes"].includes(
            category,
          )
            ? "high"
            : "medium",
          status: "monitoring",
          region: "Global",
          country: category,
          latitude,
          longitude,
          sourceName: "NASA EONET",
          sourceUrl: event.link || "https://eonet.gsfc.nasa.gov/",
          publishedAt: geometry.date || new Date().toISOString(),
          live: true,
        },
      ];
    });
  }

  async #reliefWeb() {
    const url = new URL("https://api.reliefweb.int/v1/reports");
    url.searchParams.set("appname", "worldgpz");
    url.searchParams.set("preset", "latest");
    url.searchParams.set("limit", "8");
    url.searchParams.append("fields[include][]", "title");
    url.searchParams.append("fields[include][]", "date");
    url.searchParams.append("fields[include][]", "primary_country");
    url.searchParams.append("fields[include][]", "primary_type");
    url.searchParams.append("fields[include][]", "source");
    url.searchParams.append("fields[include][]", "url");
    const payload = await this.#fetchJson(url);
    return payload.data.map((item) => {
      const country = item.fields.primary_country?.name || "Global";
      const coordinates = coordinatesByCountry[country] || [20, 0];
      return {
        id: `reliefweb-${item.id}`,
        title: item.fields.title,
        category: item.fields.primary_type?.name || "Humanitarian",
        country,
        latitude: coordinates[0],
        longitude: coordinates[1],
        sourceName: item.fields.source?.[0]?.name || "ReliefWeb",
        sourceUrl: item.fields.url || `https://reliefweb.int/node/${item.id}`,
        publishedAt: item.fields.date?.created || new Date().toISOString(),
      };
    });
  }

  async #newsApi() {
    if (!this.config.newsApiKey) return [];
    const url = new URL("https://newsapi.org/v2/top-headlines");
    url.searchParams.set("category", "general");
    url.searchParams.set("language", "en");
    url.searchParams.set("pageSize", "8");
    const payload = await this.#fetchJson(url, {
      headers: { "X-Api-Key": this.config.newsApiKey },
    });
    return (payload.articles || []).map((article, index) => ({
      id: `newsapi-${index}-${article.publishedAt}`,
      title: article.title,
      category: "World news",
      country: "Global",
      latitude: 20,
      longitude: 0,
      sourceName: article.source?.name || "NewsAPI",
      sourceUrl: article.url,
      publishedAt: article.publishedAt,
    }));
  }

  async snapshot({ fresh = false } = {}) {
    if (
      !fresh &&
      this.cache &&
      Date.now() - this.cachedAt < this.config.sourceCacheSeconds * 1000
    )
      return this.cache;

    const startedAt = Date.now();
    const [
      earthquakesResult,
      weatherResult,
      naturalResult,
      reliefResult,
      newsResult,
    ] = await Promise.allSettled([
      this.#earthquakes(),
      this.#weather(),
      this.#naturalEvents(),
      this.#reliefWeb(),
      this.#newsApi(),
    ]);
    const unpack = (result) =>
      result.status === "fulfilled" ? result.value : [];
    const sourceState = (result, configured = true) => ({
      status: !configured
        ? "not-configured"
        : result.status === "fulfilled"
          ? "operational"
          : "degraded",
      latencyMs: Date.now() - startedAt,
      message: result.status === "rejected" ? result.reason.message : undefined,
    });

    const reliefNews = unpack(reliefResult);
    const premiumNews = unpack(newsResult);
    this.cache = {
      earthquakes: unpack(earthquakesResult),
      weather: unpack(weatherResult),
      natural: unpack(naturalResult),
      news: premiumNews.length ? premiumNews : reliefNews,
      sourceStatus: [
        { ...publicSources[0], ...sourceState(earthquakesResult) },
        { ...publicSources[1], ...sourceState(weatherResult) },
        { ...publicSources[2], ...sourceState(naturalResult) },
        { ...publicSources[3], ...sourceState(reliefResult) },
        { ...publicSources[4], status: "operational", latencyMs: 0 },
        {
          id: "newsapi",
          name: "NewsAPI",
          type: "News",
          cadence: "15 min",
          coverage: "Global",
          ...sourceState(newsResult, Boolean(this.config.newsApiKey)),
        },
      ],
      fetchedAt: new Date().toISOString(),
    };
    this.cachedAt = Date.now();
    return this.cache;
  }
}
