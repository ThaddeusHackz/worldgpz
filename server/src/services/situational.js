const COUNTRY_BASELINES = [
  ['Ukraine', 85, 'Europe'], ['Russia', 77, 'Europe'], ['Syria', 72, 'Asia'], ['Israel', 70, 'Asia'],
  ['Yemen', 70, 'Asia'], ['Pakistan', 70, 'Asia'], ['Iran', 69, 'Asia'], ['Myanmar', 66, 'Asia'],
  ['Iraq', 62, 'Asia'], ['China', 60, 'Asia'], ['North Korea', 60, 'Asia'], ['Afghanistan', 60, 'Asia'],
  ['Lebanon', 60, 'Asia'], ['Turkey', 58, 'Europe'], ['Venezuela', 52, 'Americas'], ['Saudi Arabia', 50, 'Asia'],
  ['India', 50, 'Asia'], ['Brazil', 50, 'Americas'], ['United Arab Emirates', 50, 'Asia'], ['Qatar', 50, 'Asia'],
  ['United Kingdom', 38, 'Europe'], ['Poland', 36, 'Europe'], ['Germany', 36, 'Europe'], ['Cuba', 36, 'Americas'],
  ['France', 35, 'Europe'], ['Taiwan', 32, 'Asia'], ['South Korea', 31, 'Asia'], ['United States', 30, 'Americas'],
  ['Egypt', 26, 'Africa'], ['Japan', 26, 'Asia'], ['Singapore', 15, 'Asia'],
];

export const CHOKEPOINTS = [
  { name: 'Strait of Hormuz', lat: 26.5, lon: 56.3, region: 'Middle East', importance: 'critical', keywords: ['hormuz', 'persian gulf'] },
  { name: 'Strait of Malacca', lat: 1.5, lon: 103.5, region: 'Asia Pacific', importance: 'critical', keywords: ['malacca', 'strait of malacca'] },
  { name: 'Suez Canal', lat: 30.0, lon: 32.5, region: 'Middle East', importance: 'critical', keywords: ['suez', 'canal blockage'] },
  { name: 'Bab el-Mandeb', lat: 12.5, lon: 43.5, region: 'Middle East', importance: 'high', keywords: ['bab el-mandeb', 'red sea', 'gulf of aden'] },
  { name: 'Turkish Straits', lat: 41.0, lon: 29.0, region: 'Europe', importance: 'high', keywords: ['bosporus', 'turkish straits', 'dardanelles'] },
  { name: 'Panama Canal', lat: 9.0, lon: -79.5, region: 'Americas', importance: 'high', keywords: ['panama canal'] },
  { name: 'South China Sea', lat: 15.0, lon: 115.0, region: 'Asia Pacific', importance: 'critical', keywords: ['south china sea', 'spratly', 'paracel'] },
  { name: 'Strait of Gibraltar', lat: 36.0, lon: -5.5, region: 'Europe', importance: 'high', keywords: ['gibraltar'] },
  { name: 'English Channel', lat: 50.0, lon: 0.0, region: 'Europe', importance: 'high', keywords: ['english channel', 'channel crossing'] },
  { name: 'Kerch Strait', lat: 45.3, lon: 36.5, region: 'Europe', importance: 'medium', keywords: ['kerch strait', 'kerch bridge'] },
  { name: 'Denmark Strait', lat: 66.0, lon: -25.0, region: 'Arctic', importance: 'medium', keywords: ['denmark strait', 'giuk'] },
  { name: 'Cape of Good Hope', lat: -34.5, lon: 18.5, region: 'Africa', importance: 'medium', keywords: ['cape of good hope'] },
  { name: 'Northern Sea Route', lat: 72.0, lon: 100.0, region: 'Arctic', importance: 'medium', keywords: ['northern sea route', 'arctic shipping'] },
];

const levelFor = (score) => score >= 71 ? 'critical' : score >= 51 ? 'high' : score >= 31 ? 'medium' : score >= 16 ? 'low' : 'minimal';
const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));

export function buildCountries({ conflicts = [], events = [], news = [] } = {}) {
  return COUNTRY_BASELINES.map(([name, baseline, continent]) => {
    const conflictEvents = conflicts.filter((event) => String(event.country || '').toLowerCase() === name.toLowerCase());
    const disasterEvents = events.filter((event) => String(event.title || '').toLowerCase().includes(name.toLowerCase()));
    const newsHits = news.filter((article) => String(article.title || '').toLowerCase().includes(name.toLowerCase())).length;
    const conflict = Math.min(15, conflictEvents.length * 3 + conflictEvents.reduce((sum, event) => sum + Math.min(4, Number(event.fatalities) || 0), 0));
    const disaster = Math.min(8, disasterEvents.length * 2);
    const information = Math.min(5, newsHits);
    const score = clamp(Math.round(baseline * 0.82 + conflict + disaster + information));
    return {
      name, continent, score, baseline, level: levelFor(score), movement: 'stable',
      components: { baseline, conflict, disaster, information },
      basis: 'Heuristic baseline plus currently available signal counts; not an official country-risk rating.',
    };
  }).sort((a, b) => b.score - a.score);
}

export function buildChokepoints({ events = [], news = [], ships = [] } = {}) {
  const corpus = [...events, ...news].map((item) => `${item.title || ''} ${item.description || ''}`.toLowerCase()).join(' ');
  return CHOKEPOINTS.map((point) => {
    const signalCount = point.keywords.reduce((count, keyword) => count + (corpus.includes(keyword) ? 1 : 0), 0);
    const shipsNearby = ships.filter((ship) => Math.abs(ship.latitude - point.lat) < 2.5 && Math.abs(ship.longitude - point.lon) < 3.5).length;
    const status = signalCount >= 3 ? 'disrupted' : signalCount >= 1 ? 'strained' : 'monitoring';
    return {
      ...point, longitude: point.lon, latitude: point.lat, signalCount, shipsNearby, status,
      assessment: 'Signal-derived watch status; not a vessel-traffic or closure feed.',
    };
  });
}

export function buildStrategicRisk(countries, chokepoints, events) {
  const topFive = countries.slice(0, 5);
  const countryComponent = topFive.length ? topFive.reduce((sum, country) => sum + country.score, 0) / topFive.length : 0;
  const convergence = clamp(chokepoints.reduce((sum, point) => sum + (point.status === 'disrupted' ? 18 : point.status === 'strained' ? 8 : 2), 0) / Math.max(1, chokepoints.length));
  const incidentComponent = clamp(events.filter((event) => ['critical', 'high'].includes(event.severity)).length * 2);
  const score = Math.round(countryComponent * 0.5 + convergence * 0.3 + incidentComponent * 0.2);
  return {
    score, level: score >= 76 ? 'critical' : score >= 51 ? 'high' : score >= 26 ? 'medium' : 'low',
    factors: [
      { name: 'Country baseline index', weight: 0.5, score: Math.round(countryComponent) },
      { name: 'Geographic signal convergence', weight: 0.3, score: Math.round(convergence) },
      { name: 'High-priority incident volume', weight: 0.2, score: Math.round(incidentComponent) },
    ],
    generatedAt: new Date().toISOString(),
    note: 'Heuristic indicator only. It is not an official risk assessment or operational advice.',
  };
}
