import { hasCoordinates, normalizeEvents } from './mission.js';

export const MISSIONS_KEY = 'worldgpz.missions.v1';
export const INBOX_KEY = 'worldgpz.observed-inbox.v1';
export const SEEN_KEY = 'worldgpz.observed-ids.v1';
export const SEVERITY_RANK = { unknown: 0, low: 1, medium: 2, high: 3, critical: 4 };
export const REGION_LENSES = [
  { id: 'global', label: 'Global coverage' },
  { id: 'americas', label: 'Americas', bounds: [-170, -35, -60, 85] },
  { id: 'europe', label: 'Europe', bounds: [-25, 45, 35, 72] },
  { id: 'africa', label: 'Africa', bounds: [-20, 55, -36, 35] },
  { id: 'asia', label: 'Asia / Middle East', bounds: [35, 180, 0, 80] },
  { id: 'oceania', label: 'Oceania', bounds: [110, 180, -50, 0] },
];
export const DEFAULT_LENS = { query: '', category: 'all', minSeverity: 'unknown', hours: 24, region: 'global' };

export function observedSignals(events, now = Date.now(), hours = 24) {
  return normalizeEvents(events).filter((event) => !['baseline', 'stale'].includes(event.provenance) && !event.metadata?.static
    && event.observedAt != null && event.observedAt <= now && event.observedAt >= now - hours * 3600000);
}

export function applyLens(events, lens, now = Date.now()) {
  const needle = String(lens.query || '').trim().toLowerCase();
  const region = REGION_LENSES.find((item) => item.id === lens.region);
  return observedSignals(events, now, Number(lens.hours) || 24).filter((event) => (lens.category === 'all' || event.type === lens.category)
    && SEVERITY_RANK[event.severity] >= (SEVERITY_RANK[lens.minSeverity] || 0)
    && (!needle || [event.title, event.source, event.country, event.place, event.type].filter(Boolean).join(' ').toLowerCase().includes(needle))
    && (!region?.bounds || (hasCoordinates(event) && Number(event.longitude) >= region.bounds[0] && Number(event.longitude) <= region.bounds[1] && Number(event.latitude) >= region.bounds[2] && Number(event.latitude) <= region.bounds[3])))
    .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || b.observedAt - a.observedAt);
}

// Coordinate sectors describe reporting density, not risk, borders or causal relationships.
export function geographicClusters(events) {
  const buckets = new Map();
  for (const event of events.filter(hasCoordinates)) {
    const latitude = Math.floor(Number(event.latitude) / 10) * 10 + 5;
    const longitude = Math.floor(Number(event.longitude) / 10) * 10 + 5;
    const id = `sector:${latitude}:${longitude}`;
    if (!buckets.has(id)) buckets.set(id, { id, label: `${Math.abs(latitude)}°${latitude < 0 ? 'S' : 'N'} / ${Math.abs(longitude)}°${longitude < 0 ? 'W' : 'E'}`, latitude, longitude, signals: [] });
    buckets.get(id).signals.push(event);
  }
  return [...buckets.values()].map((bucket) => ({ ...bucket, count: bucket.signals.length, sourceCount: new Set(bucket.signals.map((event) => event.source)).size,
    severity: bucket.signals.reduce((best, event) => SEVERITY_RANK[event.severity] > SEVERITY_RANK[best] ? event.severity : best, 'unknown'), eventIds: bucket.signals.map((event) => event.id) }))
    .sort((a, b) => b.count - a.count).slice(0, 8);
}

export function sourceTimeline(events, now = Date.now()) {
  const start = now - 24 * 3600000;
  const buckets = Array.from({ length: 24 }, (_, index) => ({ time: start + index * 3600000, count: 0, highCount: 0 }));
  for (const event of observedSignals(events, now)) {
    const index = Math.min(23, Math.floor((event.observedAt - start) / 3600000));
    buckets[index].count++;
    if (SEVERITY_RANK[event.severity] >= 3) buckets[index].highCount++;
  }
  return buckets;
}

export function updateObservedInbox(previous, missions, events, now = Date.now(), seenIds = []) {
  const ids = new Set([...seenIds, ...previous.map((item) => item.id)]);
  const additions = new Map();
  for (const mission of missions) for (const event of applyLens(events, mission.lens, now)) {
    if (ids.has(event.id)) continue;
    const item = additions.get(event.id) || { id: event.id, event, firstSeenAt: new Date(now).toISOString(), missionNames: [], read: false };
    item.missionNames.push(mission.name); additions.set(event.id, item);
  }
  return [...additions.values(), ...previous].slice(0, 200);
}

export function readLocalList(key) {
  try { const value = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(value) ? value.filter((item) => item && typeof item === 'object').slice(0, 200) : []; } catch { return []; }
}
