/**
 * Situational scoring.
 *
 * Every number this module produces is derived from signals actually present in
 * the current snapshot -- there is no hard-coded "risk score" table. When a
 * country or chokepoint has no supporting signal it scores 0 and says so, which
 * keeps the dashboard from presenting invented numbers as intelligence.
 */

/** Maritime chokepoints that carry a large share of global trade. */
export const CHOKEPOINTS = [
  {
    name: "Strait of Hormuz",
    region: "Middle East",
    latitude: 26.6,
    longitude: 56.4,
    weight: 1.0,
  },
  {
    name: "Strait of Malacca",
    region: "Asia Pacific",
    latitude: 2.5,
    longitude: 101.7,
    weight: 0.95,
  },
  {
    name: "Suez Canal",
    region: "Middle East",
    latitude: 30.5,
    longitude: 32.3,
    weight: 0.9,
  },
  {
    name: "Bab el-Mandeb",
    region: "Middle East",
    latitude: 12.6,
    longitude: 43.4,
    weight: 0.85,
  },
  {
    name: "Turkish Straits",
    region: "Europe",
    latitude: 41.2,
    longitude: 29.1,
    weight: 0.7,
  },
  {
    name: "Kerch Strait",
    region: "Europe",
    latitude: 45.3,
    longitude: 36.5,
    weight: 0.7,
  },
  {
    name: "Panama Canal",
    region: "Americas",
    latitude: 9.1,
    longitude: -79.7,
    weight: 0.85,
  },
  {
    name: "Strait of Gibraltar",
    region: "Europe",
    latitude: 35.9,
    longitude: -5.5,
    weight: 0.6,
  },
  {
    name: "Danish Straits",
    region: "Europe",
    latitude: 55.5,
    longitude: 11.0,
    weight: 0.5,
  },
  {
    name: "Strait of Dover",
    region: "Europe",
    latitude: 51.0,
    longitude: 1.4,
    weight: 0.55,
  },
  {
    name: "Taiwan Strait",
    region: "Asia Pacific",
    latitude: 24.5,
    longitude: 119.5,
    weight: 0.8,
  },
  {
    name: "South China Sea",
    region: "Asia Pacific",
    latitude: 12.5,
    longitude: 113.5,
    weight: 0.9,
  },
  {
    name: "Cape of Good Hope",
    region: "Africa",
    latitude: -34.4,
    longitude: 18.5,
    weight: 0.65,
  },
];

/** Terms that indicate pressure on a maritime route. */
const DISRUPTION_TERMS = [
  "chokepoint",
  "blockade",
  "shipping lane",
  "tanker",
  "vessel seized",
  "port closure",
  "strait",
  "canal",
  "houthi",
  "piracy",
  "maritime attack",
  "freight",
  "container ship",
  "naval",
  "mine",
  "reroute",
  "red sea",
];

/** Severity weights applied when tallying signals. */
const SEVERITY_WEIGHT = {
  critical: 10,
  high: 6,
  elevated: 4,
  moderate: 2,
  low: 1,
  info: 0.5,
};

/**
 * Placeholders that appear in the `country` field but are not countries. The
 * seed data uses these, and scoring them produced an index reading
 * "Regional 72" -- fabricated-looking output from real signals.
 */
const NON_COUNTRIES = new Set([
  "unknown",
  "global",
  "regional",
  "international",
  "worldwide",
  "various",
  "multiple",
  "n/a",
  "none",
  "",
]);

/**
 * Region names, used for a rollup when no signal resolves to a specific
 * country. Several feeds (and the bundled fallback rows) only ever name a
 * region, so reporting nothing would hide real pressure. The output states
 * clearly that it is region-level.
 */
export const REGION_GAZETTEER = [
  "Horn of Africa",
  "Red Sea",
  "Eastern Europe",
  "Western Europe",
  "Central Europe",
  "South Asia",
  "East Asia",
  "Southeast Asia",
  "Central Asia",
  "Asia Pacific",
  "Western Pacific",
  "Middle East",
  "North Africa",
  "West Africa",
  "East Africa",
  "Southern Africa",
  "Central Africa",
  "Sahel",
  "Balkans",
  "Caucasus",
  "Levant",
  "Gulf",
  "Caribbean",
  "Central America",
  "South America",
  "North Atlantic",
  "South China Sea",
  "Baltic",
  "Black Sea",
  "Arctic",
  "Sahara",
];

const REGION_SORTED = [...REGION_GAZETTEER].sort((a, b) => b.length - a.length);

/** Gazetteer used to attribute signals to a real country by name. */
export const COUNTRY_GAZETTEER = [
  "Afghanistan",
  "Albania",
  "Algeria",
  "Angola",
  "Argentina",
  "Armenia",
  "Australia",
  "Austria",
  "Azerbaijan",
  "Bangladesh",
  "Belarus",
  "Belgium",
  "Bolivia",
  "Bosnia and Herzegovina",
  "Botswana",
  "Brazil",
  "Bulgaria",
  "Burkina Faso",
  "Burundi",
  "Cambodia",
  "Cameroon",
  "Canada",
  "Central African Republic",
  "Chad",
  "Chile",
  "China",
  "Colombia",
  "Congo",
  "Costa Rica",
  "Cote d'Ivoire",
  "Croatia",
  "Cuba",
  "Cyprus",
  "Czechia",
  "Denmark",
  "Ecuador",
  "Egypt",
  "El Salvador",
  "Eritrea",
  "Estonia",
  "Ethiopia",
  "Fiji",
  "Finland",
  "France",
  "Gabon",
  "Georgia",
  "Germany",
  "Ghana",
  "Greece",
  "Guatemala",
  "Guinea",
  "Haiti",
  "Honduras",
  "Hungary",
  "Iceland",
  "India",
  "Indonesia",
  "Iran",
  "Iraq",
  "Ireland",
  "Israel",
  "Italy",
  "Jamaica",
  "Japan",
  "Jordan",
  "Kazakhstan",
  "Kenya",
  "Kuwait",
  "Kyrgyzstan",
  "Laos",
  "Latvia",
  "Lebanon",
  "Lesotho",
  "Liberia",
  "Libya",
  "Lithuania",
  "Madagascar",
  "Malawi",
  "Malaysia",
  "Mali",
  "Mauritania",
  "Mexico",
  "Moldova",
  "Mongolia",
  "Montenegro",
  "Morocco",
  "Mozambique",
  "Myanmar",
  "Namibia",
  "Nepal",
  "Netherlands",
  "New Zealand",
  "Nicaragua",
  "Niger",
  "Nigeria",
  "North Korea",
  "North Macedonia",
  "Norway",
  "Oman",
  "Pakistan",
  "Panama",
  "Papua New Guinea",
  "Paraguay",
  "Peru",
  "Philippines",
  "Poland",
  "Portugal",
  "Qatar",
  "Romania",
  "Russia",
  "Rwanda",
  "Saudi Arabia",
  "Senegal",
  "Serbia",
  "Sierra Leone",
  "Singapore",
  "Slovakia",
  "Slovenia",
  "Somalia",
  "South Africa",
  "South Korea",
  "South Sudan",
  "Spain",
  "Sri Lanka",
  "Sudan",
  "Sweden",
  "Switzerland",
  "Syria",
  "Taiwan",
  "Tajikistan",
  "Tanzania",
  "Thailand",
  "Togo",
  "Trinidad and Tobago",
  "Tunisia",
  "Turkey",
  "Turkmenistan",
  "Uganda",
  "Ukraine",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
  "Uruguay",
  "Uzbekistan",
  "Venezuela",
  "Vietnam",
  "Yemen",
  "Zambia",
  "Zimbabwe",
];

/** Longest first so "South Korea" is matched before "Korea". */
const GAZETTEER_SORTED = [...COUNTRY_GAZETTEER].sort(
  (a, b) => b.length - a.length,
);

const clamp = (value, min = 0, max = 100) =>
  Math.max(min, Math.min(max, value));

const normalise = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * How much a signal counts right now. Older signals decay, so the index
 * reflects the current picture rather than accumulated history.
 */
function recencyWeight(at, now = Date.now()) {
  const time = Date.parse(at);
  if (!Number.isFinite(time)) return 0.35;
  const hours = Math.max(0, (now - time) / 3_600_000);
  if (hours <= 6) return 1;
  if (hours <= 24) return 0.75;
  if (hours <= 72) return 0.45;
  return 0.2;
}

function severityOf(item) {
  const value = normalise(item?.severity);
  return SEVERITY_WEIGHT[value] ?? 1;
}

/**
 * Absolute pressure -> 0-100 score.
 *
 * Deliberately absolute rather than relative to the busiest country: a relative
 * scale reports 100 for a single minor signal on a quiet day, which reads as
 * invented data. This saturating curve keeps a lone low-severity signal low
 * (~5) and needs sustained severe reporting to approach the top of the scale,
 * which also makes the per-pass delta meaningful.
 */
const PRESSURE_SCALE = 18;

export function scoreFromPressure(pressure) {
  if (!Number.isFinite(pressure) || pressure <= 0) return 0;
  return clamp(Math.round(100 * (1 - Math.exp(-pressure / PRESSURE_SCALE))));
}

/**
 * Real countries named in a signal.
 *
 * The `country` field is not trustworthy -- seed rows carry "Regional"/"Global"
 * and the weather/natural feeds carry region names -- so attribution is done by
 * matching the gazetteer against the signal text instead.
 */
export function extractCountries(item) {
  const declared = normalise(item?.country);
  const text = normalise(
    [
      item?.place,
      item?.title,
      item?.summary,
      item?.location,
      item?.country,
    ].join(" "),
  );
  const found = new Set();

  if (
    declared &&
    !NON_COUNTRIES.has(declared) &&
    COUNTRY_GAZETTEER.some((c) => normalise(c) === declared)
  ) {
    found.add(canonicalCountry(declared));
  }

  for (const name of GAZETTEER_SORTED) {
    if (found.size >= 3) break;
    const needle = normalise(name);
    if (needle.length > 3 && text.includes(needle)) found.add(name);
  }

  return [...found];
}

/** Region names appearing in a signal, for the region-level rollup. */
export function extractRegions(item) {
  const declared = normalise(item?.region);
  const text = normalise(
    [
      item?.place,
      item?.title,
      item?.summary,
      item?.location,
      item?.region,
    ].join(" "),
  );
  const found = new Set();

  for (const name of REGION_SORTED) {
    if (found.size >= 2) break;
    const needle = normalise(name);
    if (needle.length > 4 && text.includes(needle)) found.add(name);
  }

  if (found.size === 0 && declared && !NON_COUNTRIES.has(declared)) {
    for (const name of REGION_SORTED) {
      if (normalise(name) === declared) {
        found.add(name);
        break;
      }
    }
  }

  return [...found];
}

function canonicalCountry(value) {
  const needle = normalise(value);
  return (
    COUNTRY_GAZETTEER.find((name) => normalise(name) === needle) ??
    String(value).trim()
  );
}

/**
 * Per-country instability index, 0-100, with the drivers that produced it.
 *
 * Countries come from the gazetteer matched against live signal text, never
 * from the raw `country` field. Scores are absolute (see scoreFromPressure), so
 * they are comparable across passes and the delta reflects a real change.
 */
export function countryRisk(events = [], news = [], options = {}) {
  const now = options.now ?? Date.now();
  const history = options.history ?? new Map();
  const tally = new Map();
  const regionTally = new Map();

  const bumpInto = (map, name, points, driver) => {
    const key = normalise(name);
    if (!key || NON_COUNTRIES.has(key)) return;
    const entry = map.get(key) ?? {
      name: String(name).trim(),
      pressure: 0,
      signals: 0,
      drivers: new Map(),
    };
    entry.pressure += points;
    entry.signals += 1;
    if (driver) {
      entry.drivers.set(driver, (entry.drivers.get(driver) ?? 0) + points);
    }
    map.set(key, entry);
  };

  const bump = (country, points, driver) =>
    bumpInto(tally, country, points, driver);
  const bumpRegion = (region, points, driver) =>
    bumpInto(regionTally, region, points, driver);

  const absorb = (item, points, driver) => {
    for (const country of extractCountries(item)) bump(country, points, driver);
    for (const region of extractRegions(item))
      bumpRegion(region, points, driver);
  };

  for (const event of Array.isArray(events) ? events : []) {
    const points =
      severityOf(event) *
      recencyWeight(event?.timestamp ?? event?.createdAt, now);
    absorb(event, points, event?.category || event?.type || "signal");
  }

  for (const item of Array.isArray(news) ? news : []) {
    const points =
      1.5 * recencyWeight(item?.publishedAt ?? item?.timestamp, now);
    absorb(item, points, "media coverage");
  }

  const regions = [...regionTally.values()]
    .map((entry) => ({
      region: entry.name,
      score: scoreFromPressure(entry.pressure),
      signals: entry.signals,
    }))
    .sort((a, b) => b.score - a.score || b.signals - a.signals)
    .slice(0, 12);

  if (tally.size === 0) {
    return {
      countries: [],
      regions,
      generatedAt: new Date(now).toISOString(),
      basis: regions.length
        ? `no country-attributable signals; ${regions.length} region-level rollups`
        : "no country-attributable signals in the current snapshot",
    };
  }

  const countries = [...tally.values()]
    .map((entry) => {
      const score = scoreFromPressure(entry.pressure);
      const previous = history.get(normalise(entry.name));
      const drivers = [...entry.drivers.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([label, points]) => ({
          label,
          share:
            entry.pressure > 0
              ? Math.round((points / entry.pressure) * 100)
              : 0,
        }));
      return {
        country: entry.name,
        score,
        signals: entry.signals,
        delta: previous == null ? null : score - previous,
        drivers,
        level:
          score >= 70
            ? "critical"
            : score >= 45
              ? "high"
              : score >= 20
                ? "elevated"
                : "low",
      };
    })
    .sort((a, b) => b.score - a.score || b.signals - a.signals)
    .slice(0, 20);

  for (const country of countries) {
    history.set(normalise(country.country), country.score);
  }

  return {
    countries,
    regions,
    generatedAt: new Date(now).toISOString(),
    basis: `${countries.length} countries from ${
      (Array.isArray(events) ? events.length : 0) +
      (Array.isArray(news) ? news.length : 0)
    } live signals`,
  };
}

/**
 * Chokepoint disruption, 0-100, from keyword pressure in live signals.
 * Zero means "no current signal", which is displayed as monitoring rather
 * than being dressed up as a score.
 */
export function chokepointStatus(events = [], news = [], options = {}) {
  const now = options.now ?? Date.now();
  const corpus = [
    ...(Array.isArray(events) ? events : []),
    ...(Array.isArray(news) ? news : []),
  ]
    .map((item) => ({
      text: normalise(
        [item?.title, item?.summary, item?.place, item?.country].join(" "),
      ),
      points:
        severityOf(item) *
        recencyWeight(
          item?.timestamp ?? item?.publishedAt ?? item?.createdAt,
          now,
        ),
      label: item?.title,
    }))
    .filter((item) => item.text);

  const rows = CHOKEPOINTS.map((point) => {
    const needles = [
      normalise(point.name),
      ...normalise(point.name)
        .split(" ")
        .filter((word) => word.length > 4),
    ];
    let pressure = 0;
    let signals = 0;
    const matched = [];

    for (const item of corpus) {
      const hit = needles.some(
        (needle) => needle && item.text.includes(needle),
      );
      if (!hit) continue;
      const termHits = DISRUPTION_TERMS.filter((term) =>
        item.text.includes(term),
      ).length;
      pressure += item.points * (1 + termHits * 0.5);
      signals += 1;
      if (item.label && matched.length < 3) matched.push(item.label);
    }

    const disruption = clamp(Math.round(pressure * point.weight * 4));
    return {
      ...point,
      disruption,
      signals,
      matched,
      status:
        disruption >= 60
          ? "disrupted"
          : disruption >= 25
            ? "strained"
            : "monitoring",
    };
  }).sort((a, b) => b.disruption - a.disruption || b.signals - a.signals);

  return {
    chokepoints: rows,
    disrupted: rows.filter((row) => row.status === "disrupted").length,
    strained: rows.filter((row) => row.status === "strained").length,
    total: rows.length,
    generatedAt: new Date(now).toISOString(),
    basis:
      corpus.length > 0
        ? `scored against ${corpus.length} live signals`
        : "no live signals available — all routes at baseline",
  };
}
