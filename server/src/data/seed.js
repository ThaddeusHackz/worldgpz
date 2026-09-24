const ago = (hours) =>
  new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

export function createSeedEvents() {
  return [
    {
      id: "baseline-red-sea",
      title: "Red Sea shipping corridor remains under enhanced monitoring",
      summary:
        "Curated baseline watch item (not a live report): maritime traffic, route diversions, and port activity grouped into a single regional signal.",
      category: "infrastructure",
      severity: "high",
      status: "monitoring",
      region: "Middle East",
      country: "Regional",
      latitude: 16.4,
      longitude: 41.2,
      sourceName: "WORLDGPZ baseline watch",
      sourceUrl: "",
      publishedAt: ago(2),
    },
    {
      id: "baseline-eastern-europe",
      title: "Eastern Europe conflict indicators remain elevated",
      summary:
        "Curated baseline watch item (not a live report): conflict, humanitarian, and infrastructure indicators consolidated for the region.",
      category: "conflict",
      severity: "critical",
      status: "monitoring",
      region: "Europe",
      country: "Regional",
      latitude: 49.1,
      longitude: 32.2,
      sourceName: "WORLDGPZ baseline watch",
      sourceUrl: "",
      publishedAt: ago(3),
    },
    {
      id: "baseline-horn-africa",
      title:
        "Humanitarian access constraints tracked across the Horn of Africa",
      summary:
        "Curated baseline watch item (not a live report): access, displacement, and food-security signals tracked regionally.",
      category: "humanitarian",
      severity: "high",
      status: "watch",
      region: "Africa",
      country: "Regional",
      latitude: 8.9,
      longitude: 42.8,
      sourceName: "WORLDGPZ baseline watch",
      sourceUrl: "",
      publishedAt: ago(5),
    },
    {
      id: "baseline-pacific-weather",
      title: "Western Pacific severe-weather window active",
      summary:
        "Curated baseline watch item (not a live report): storm development and coastal exposure monitored via live weather providers.",
      category: "climate",
      severity: "medium",
      status: "watch",
      region: "Asia Pacific",
      country: "Regional",
      latitude: 18.2,
      longitude: 135.5,
      sourceName: "WORLDGPZ baseline watch",
      sourceUrl: "",
      publishedAt: ago(7),
    },
    {
      id: "baseline-supply-chain",
      title: "Global supply-chain pressure watch",
      summary:
        "Curated baseline watch item (not a live report): maritime chokepoints and logistics monitored for abnormal disruption.",
      category: "economy",
      severity: "medium",
      status: "monitoring",
      region: "Global",
      country: "Global",
      latitude: 1.3,
      longitude: 103.8,
      sourceName: "WORLDGPZ baseline watch",
      sourceUrl: "",
      publishedAt: ago(9),
    },
    {
      id: "baseline-cyber",
      title: "Critical-infrastructure cyber posture under observation",
      summary:
        "Curated baseline watch item (not a live report): publicly reported service disruptions correlated at a coarse level.",
      category: "cyber",
      severity: "medium",
      status: "watch",
      region: "Global",
      country: "Global",
      latitude: 50.1,
      longitude: 8.7,
      sourceName: "WORLDGPZ baseline watch",
      sourceUrl: "",
      publishedAt: ago(12),
    },
  ];
}

export const publicSources = [
  {
    id: "usgs",
    name: "USGS Earthquake Hazards",
    type: "Seismic",
    cadence: "5 min",
    coverage: "Global",
  },
  {
    id: "open-meteo",
    name: "Open-Meteo",
    type: "Weather",
    cadence: "15 min",
    coverage: "Global",
  },
  {
    id: "eonet",
    name: "NASA EONET",
    type: "Natural events",
    cadence: "15 min",
    coverage: "Global",
  },
  {
    id: "reliefweb",
    name: "ReliefWeb",
    type: "Humanitarian",
    cadence: "15 min",
    coverage: "Global",
  },
  {
    id: "worldgpz",
    name: "WORLDGPZ Curated Baseline",
    type: "Editorial",
    cadence: "Admin",
    coverage: "Global",
  },
];

export const layerCatalog = [
  {
    id: "conflict",
    label: "Conflict zones",
    group: "Security",
    color: "#ff765f",
  },
  {
    id: "humanitarian",
    label: "Humanitarian",
    group: "People",
    color: "#ffad4d",
  },
  {
    id: "civil",
    label: "Civil unrest",
    group: "People",
    color: "#ff8db7",
  },
  { id: "seismic", label: "Earthquakes", group: "Natural", color: "#f3d767" },
  {
    id: "climate",
    label: "Weather & climate",
    group: "Natural",
    color: "#65b6ff",
  },
  {
    id: "natural",
    label: "Natural events",
    group: "Natural",
    color: "#8ce66a",
  },
  {
    id: "infrastructure",
    label: "Infrastructure",
    group: "Systems",
    color: "#b495ff",
  },
  { id: "cyber", label: "Cyber posture", group: "Systems", color: "#5bd9ca" },
  {
    id: "economy",
    label: "Economic signals",
    group: "Markets",
    color: "#d7a4ff",
  },
  { id: "diplomacy", label: "Diplomacy", group: "Security", color: "#89a8ff" },
  { id: "health", label: "Health", group: "People", color: "#ff8db7" },
];
