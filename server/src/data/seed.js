const ago = (hours) =>
  new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

export function createSeedEvents() {
  return [
    {
      id: "baseline-red-sea",
      title: "Red Sea shipping corridor remains under enhanced monitoring",
      summary:
        "Maritime traffic, route diversions, and port activity are grouped into a single regional watch signal.",
      category: "infrastructure",
      severity: "high",
      status: "monitoring",
      region: "Middle East",
      country: "Regional",
      latitude: 16.4,
      longitude: 41.2,
      sourceName: "WORLDGPZ baseline",
      sourceUrl: "",
      publishedAt: ago(2),
    },
    {
      id: "baseline-eastern-europe",
      title: "Eastern Europe conflict indicators remain elevated",
      summary:
        "A baseline watch item consolidating conflict, humanitarian, and infrastructure indicators for the region.",
      category: "conflict",
      severity: "critical",
      status: "monitoring",
      region: "Europe",
      country: "Regional",
      latitude: 49.1,
      longitude: 32.2,
      sourceName: "WORLDGPZ baseline",
      sourceUrl: "",
      publishedAt: ago(3),
    },
    {
      id: "baseline-horn-africa",
      title:
        "Humanitarian access constraints tracked across the Horn of Africa",
      summary:
        "Access, displacement, and food-security signals are tracked as a regional humanitarian watch.",
      category: "humanitarian",
      severity: "high",
      status: "watch",
      region: "Africa",
      country: "Regional",
      latitude: 8.9,
      longitude: 42.8,
      sourceName: "WORLDGPZ baseline",
      sourceUrl: "",
      publishedAt: ago(5),
    },
    {
      id: "baseline-pacific-weather",
      title: "Western Pacific severe-weather window active",
      summary:
        "Storm development and coastal exposure are monitored through live weather providers.",
      category: "climate",
      severity: "medium",
      status: "watch",
      region: "Asia Pacific",
      country: "Regional",
      latitude: 18.2,
      longitude: 135.5,
      sourceName: "WORLDGPZ baseline",
      sourceUrl: "",
      publishedAt: ago(7),
    },
    {
      id: "baseline-supply-chain",
      title: "Global supply-chain pressure watch",
      summary:
        "Key maritime chokepoints and logistics indicators are monitored for abnormal disruption patterns.",
      category: "economy",
      severity: "medium",
      status: "monitoring",
      region: "Global",
      country: "Global",
      latitude: 1.3,
      longitude: 103.8,
      sourceName: "WORLDGPZ baseline",
      sourceUrl: "",
      publishedAt: ago(9),
    },
    {
      id: "baseline-cyber",
      title: "Critical-infrastructure cyber posture under observation",
      summary:
        "Publicly reported service disruptions are correlated without exposing sensitive infrastructure detail.",
      category: "cyber",
      severity: "medium",
      status: "watch",
      region: "Global",
      country: "Global",
      latitude: 50.1,
      longitude: 8.7,
      sourceName: "WORLDGPZ baseline",
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
