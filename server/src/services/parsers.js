/**
 * Pure parsers for GOD'S EYE open-source intelligence feeds.
 * Kept dependency-free and side-effect-free so they are trivially testable:
 * every parser takes raw provider payloads and returns view models.
 */

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

const firstUrl = (html) => {
  const match = /https?:\/\/[^\s"'<>]+/.exec(html || "");
  return match ? match[0] : "";
};

/**
 * GDELT GEO 2.0 API — GeoJSON of world-news attention by location.
 * Returns geolocated "world is watching" signals, severities scaled by the
 * article-volume share GDELT reports for each point.
 */
export function parseGdeltGeo(
  payload,
  { limit = 40, now = new Date().toISOString() } = {},
) {
  const features = Array.isArray(payload?.features) ? payload.features : [];
  const counts = features
    .map((feature) => Number(feature?.properties?.count) || 0)
    .sort((a, b) => a - b);
  const q = (p) =>
    counts[
      Math.min(counts.length - 1, Math.floor((p / 100) * counts.length))
    ] || 0;
  const highThreshold = q(80);
  const mediumThreshold = q(45);

  return features
    .map((feature) => {
      const [longitude, latitude] = feature?.geometry?.coordinates || [];
      const props = feature.properties || {};
      const title = String(props.name || "").slice(0, 180);
      if (!title || !Number.isFinite(Number(latitude))) return null;
      const count = Number(props.count) || 0;
      return {
        id: `gdelt-${longitude},${latitude}-${title.slice(0, 48).replace(/\W+/g, "-").toLowerCase()}`,
        title,
        summary: `${count} global news articles reference this location in the last 24 hours (GDELT 2.0 world-news index).`,
        category: classifyGdelt(title),
        severity:
          count >= highThreshold
            ? "high"
            : count >= mediumThreshold
              ? "medium"
              : "low",
        status: "monitoring",
        region: "Global",
        country: title,
        latitude: Number(latitude),
        longitude: Number(longitude),
        articleVolume: count,
        sourceName: "GDELT 2.0",
        sourceUrl: firstUrl(props.html) || "https://www.gdeltproject.org/",
        publishedAt: now,
        live: true,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.articleVolume - a.articleVolume)
    .slice(0, limit);
}

/** NOAA SWPC planetary K-index product (array of row arrays). */
export function parsePlanetaryKp(rows) {
  if (!Array.isArray(rows) || rows.length < 2) return null;
  const last = rows[rows.length - 1];
  const kp = Number(last?.[1]);
  if (!Number.isFinite(kp)) return null;
  return {
    kp,
    time: last[0],
    storm: kp >= 5,
    level:
      kp >= 8
        ? "severe"
        : kp >= 7
          ? "strong"
          : kp >= 5
            ? "storm"
            : kp >= 4
              ? "unsettled"
              : "quiet",
  };
}

/** NOAA SWPC solar-wind speed product (array of row arrays). */
export function parseSolarWindSpeed(rows) {
  if (!Array.isArray(rows) || rows.length < 2) return null;
  for (let i = rows.length - 1; i >= 1; i -= 1) {
    const speed = Number(rows[i]?.[1]);
    if (Number.isFinite(speed) && speed > 150) {
      return { speed, time: rows[i][0] };
    }
  }
  return null;
}

const WANTED_SATELLITES = [
  "ISS (ZARYA)",
  "CSS (TIANHE)",
  "HST",
  "TERRA",
  "AQUA",
  "NOAA 19",
  "NOAA 20",
  "SUOMI NPP",
  "SENTINEL-2A",
  "LANDSAT 9",
];

/** CelesTrak TLE text → [{ name, line1, line2 }] for wanted assets, in order. */
export function parseTleFile(text) {
  const lines = String(text || "").split(/\r?\n/);
  const catalogue = [];
  for (let i = 0; i + 2 < lines.length + 1; i += 1) {
    if (!/^1 /.test(lines[i + 1] || "") || !/^2 /.test(lines[i + 2] || ""))
      continue;
    catalogue.push({
      name: lines[i].trim(),
      line1: lines[i + 1].trim(),
      line2: lines[i + 2].trim(),
    });
  }
  const wanted = WANTED_SATELLITES.map((name) =>
    catalogue.find((item) => item.name === name),
  ).filter(Boolean);
  return wanted.length ? wanted : catalogue.slice(0, 10);
}
