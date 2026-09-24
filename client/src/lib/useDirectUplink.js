import { useEffect, useRef, useState } from "react";

/**
 * DIRECT UPLINK — multi-path acquisition.
 *
 * The browser itself connects straight to the public feeds (USGS, Open-Meteo,
 * NASA EONET, NOAA SWPC, GDELT) with the same event-shape the server relay
 * produces, and dedupes against relayed events by id. Result: the grid is
 * provably alive with real data even if the server's outbound network is
 * restricted — and every source reports its true path:
 *
 *   DIRECT  — this browser acquired it just now
 *   RELAY   — the server reported the source operational
 *   OFFLINE — neither path produced data
 *
 * All of these providers send permissive CORS headers for public read APIs.
 */
const TIMEOUT_MS = 9_000;

const SOURCES = ["usgs", "open-meteo", "eonet", "swpc", "gdelt", "iss"];

const fetchJson = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`${response.status}`);
  return response.json();
};

/* ----------------------------------------------------------- event mappers */

const mapUsgs = (payload) =>
  (payload?.features || []).slice(0, 40).map((feature) => ({
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
    path: "DIRECT",
  }));

const WEATHER_POINTS = [
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

const mapWeather = (payload) => {
  const responses = Array.isArray(payload) ? payload : [payload];
  return responses.map((item, index) => {
    const location = WEATHER_POINTS[index] || WEATHER_POINTS[0];
    const wind = item?.current?.wind_speed_10m || 0;
    const precipitation = item?.current?.precipitation || 0;
    return {
      id: `weather-${index}`,
      title: `${location.name} weather observation`,
      summary: `${item?.current?.temperature_2m ?? "—"}°C · wind ${wind} km/h · precipitation ${precipitation} mm`,
      category: "climate",
      severity:
        wind >= 60 || precipitation >= 15
          ? "high"
          : wind >= 35 || precipitation >= 5
            ? "medium"
            : "low",
      status: wind >= 60 || precipitation >= 15 ? "watch" : "verified",
      region: location.region,
      country: location.name,
      latitude: location.latitude,
      longitude: location.longitude,
      sourceName: "Open-Meteo",
      sourceUrl: "https://open-meteo.com/",
      publishedAt: item?.current?.time
        ? `${item.current.time}:00Z`
        : new Date().toISOString(),
      live: true,
      path: "DIRECT",
    };
  });
};

const mapEonet = (payload) =>
  (payload?.events || []).flatMap((event) => {
    const geometry = event.geometry?.at(-1);
    if (!geometry || geometry.type !== "Point") return [];
    const [longitude, latitude] = geometry.coordinates;
    const category = event.categories?.[0]?.title || "Natural event";
    return [
      {
        id: `eonet-${event.id}`,
        title: event.title,
        summary: `${category} tracked by NASA's Earth Observatory Natural Event Tracker.`,
        category: "natural",
        severity: ["Wildfires", "Severe Storms", "Volcanoes"].includes(category)
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
        path: "DIRECT",
      },
    ];
  });

const CONFLICT_WORDS =
  /\b(airstrike|air strike|missile|shelling|military|troops|offensive|insurgen|gunmen|bomb|war|clashes|militant|drone strike|invasion)\b/i;
const UNREST_WORDS =
  /\b(protest|demonstrat|riot|strike|blockade|march|curfew|unrest)/i;
const DISASTER_WORDS =
  /\b(earthquake|tsunami|flood|hurricane|typhoon|cyclone|wildfire|eruption|volcano|landslide|drought|storm|disaster)\b/i;
const classifyGdelt = (title) => {
  if (CONFLICT_WORDS.test(title)) return "conflict";
  if (DISASTER_WORDS.test(title)) return "climate";
  if (UNREST_WORDS.test(title)) return "civil";
  return "diplomacy";
};

const mapGdelt = (payload) => {
  const features = Array.isArray(payload?.features) ? payload.features : [];
  const counts = features
    .map((feature) => Number(feature?.properties?.count) || 0)
    .sort((a, b) => a - b);
  const pick = (p) =>
    counts[
      Math.min(counts.length - 1, Math.floor((p / 100) * counts.length))
    ] || 0;
  const high = pick(80);
  const medium = pick(45);
  return features
    .map((feature) => {
      const [longitude, latitude] = feature?.geometry?.coordinates || [];
      const props = feature.properties || {};
      const title = String(props.name || "").slice(0, 180);
      if (!title || !Number.isFinite(Number(latitude))) return null;
      const count = Number(props.count) || 0;
      const urlMatch = /https?:\/\/[^\s"'<>]+/.exec(props.html || "");
      return {
        id: `gdelt-${longitude},${latitude}-${title.slice(0, 48).replace(/\W+/g, "-").toLowerCase()}`,
        title,
        summary: `${count} global news articles reference this location in the last 24 hours (GDELT 2.0 world-news index).`,
        category: classifyGdelt(title),
        severity: count >= high ? "high" : count >= medium ? "medium" : "low",
        status: "monitoring",
        region: "Global",
        country: title,
        latitude: Number(latitude),
        longitude: Number(longitude),
        articleVolume: count,
        sourceName: "GDELT 2.0",
        sourceUrl: urlMatch ? urlMatch[0] : "https://www.gdeltproject.org/",
        publishedAt: new Date().toISOString(),
        live: true,
        path: "DIRECT",
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.articleVolume - a.articleVolume)
    .slice(0, 40);
};

const mapSpace = (kpPayload, windPayload) => {
  const kpRows = Array.isArray(kpPayload) ? kpPayload : [];
  const lastKp = kpRows.length > 1 ? Number(kpRows.at(-1)?.[1]) : Number.NaN;
  if (!Number.isFinite(lastKp)) return { events: [], space: null };
  const windRows = Array.isArray(windPayload) ? windPayload : [];
  let speed = null;
  for (let i = windRows.length - 1; i >= 1; i -= 1) {
    const value = Number(windRows[i]?.[1]);
    if (Number.isFinite(value) && value > 150) {
      speed = value;
      break;
    }
  }
  const level =
    lastKp >= 8
      ? "severe"
      : lastKp >= 7
        ? "strong"
        : lastKp >= 5
          ? "storm"
          : lastKp >= 4
            ? "unsettled"
            : "quiet";
  const space = {
    kp: { kp: lastKp, time: kpRows.at(-1)?.[0], storm: lastKp >= 5, level },
    wind: speed ? { speed } : null,
    checkedAt: new Date().toISOString(),
  };
  const events =
    lastKp >= 5
      ? [
          {
            id: `swpc-storm-${space.kp.time || "now"}`,
            title: `Geomagnetic storm in progress — planetary Kp ${lastKp}`,
            summary: `NOAA SWPC reports Kp ${lastKp} (${level}). Storm-level geomagnetic activity can disturb power grids, satellite operations, and high-frequency communications.`,
            category: "infrastructure",
            severity: lastKp >= 7 ? "critical" : "high",
            status: "monitoring",
            region: "Global",
            country: "Space weather",
            latitude: 60,
            longitude: 0,
            sourceName: "NOAA SWPC",
            sourceUrl: "https://www.swpc.noaa.gov/products/planetary-k-index",
            publishedAt: new Date().toISOString(),
            live: true,
            path: "DIRECT",
          },
        ]
      : [];
  return { events, space };
};

/* ------------------------------------------------------------------- hook */

export function useDirectUplink() {
  const [state, setState] = useState(() =>
    Object.fromEntries(SOURCES.map((source) => [source, "negotiating"])),
  );
  const [events, setEvents] = useState([]);
  const [space, setSpace] = useState(null);
  const [checkedAt, setCheckedAt] = useState(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    let alive = true;

    async function acquire() {
      const mark = (source, status) =>
        alive && setState((current) => ({ ...current, [source]: status }));

      const tasks = [
        fetchJson(
          "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson",
        )
          .then((payload) => {
            mark("usgs", "direct");
            return mapUsgs(payload);
          })
          .catch(() => {
            mark("usgs", "offline");
            return [];
          }),
        fetchJson(
          "https://api.open-meteo.com/v1/forecast?latitude=28.5,19.8,36.2,1.3,22.4,-24.2&longitude=-55.2,137.4,18.4,36.8,82.1,166.5&current=temperature_2m,precipitation,wind_speed_10m&timezone=UTC",
        )
          .then((payload) => {
            mark("open-meteo", "direct");
            return mapWeather(payload);
          })
          .catch(() => {
            mark("open-meteo", "offline");
            return [];
          }),
        fetchJson(
          "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=30",
        )
          .then((payload) => {
            mark("eonet", "direct");
            return mapEonet(payload);
          })
          .catch(() => {
            mark("eonet", "offline");
            return [];
          }),
        Promise.all([
          fetchJson(
            "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json",
          ).catch(() => null),
          fetchJson(
            "https://services.swpc.noaa.gov/products/solar-wind/speed.json",
          ).catch(() => null),
        ]).then(([kp, wind]) => {
          const mapped = mapSpace(kp, wind);
          mark("swpc", kp || wind ? "direct" : "offline");
          if (alive && mapped.space) setSpace(mapped.space);
          return mapped.events;
        }),
        fetchJson(
          "https://api.gdeltproject.org/api/v2/geo/geo?query=protest%20OR%20conflict%20OR%20airstrike%20OR%20evacuation%20OR%20blockade%20OR%20militarized%20OR%20earthquake%20OR%20flood%20OR%20wildfire&format=geojson&timespan=1d",
          { headers: { Accept: "application/json" } },
        )
          .then((payload) => {
            mark("gdelt", "direct");
            return mapGdelt(payload);
          })
          .catch(() => {
            mark("gdelt", "offline");
            return [];
          }),
      ];

      const results = await Promise.all(tasks);
      if (!alive) return;
      setEvents(results.flat());
      setCheckedAt(new Date().toISOString());
    }

    acquire();
    const interval = setInterval(acquire, 5 * 60 * 1000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, []);

  return { state, events, space, checkedAt };
}
