export const WATCHLIST_KEY = 'worldgpz.watchlist.v1';

export function timestamp(value) {
  if (value == null || value === '') return null;
  const numeric = typeof value === 'number' ? value : /^\d+(\.\d+)?$/.test(String(value)) ? Number(value) : null;
  const result = numeric === null ? Date.parse(value) : numeric < 1e12 ? numeric * 1000 : numeric;
  return Number.isFinite(result) ? result : null;
}

export function safeUrl(value) {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : null; } catch { return null; }
}

export function hasCoordinates(event) {
  return [event?.latitude, event?.longitude].every((value) => value != null && value !== '' && Number.isFinite(Number(value))) && Math.abs(Number(event.latitude)) <= 90 && Math.abs(Number(event.longitude)) <= 180;
}

export function eventKey(event) {
  return String(event.id || event.external_id || `${event.source || 'unknown'}:${event.title}:${event.time || event.publishedAt || 'undated'}`);
}

export function normalizeEvents(events = []) {
  const seen = new Set();
  return events.filter((event) => event && typeof event === 'object').map((event) => ({
    ...event, id: eventKey(event), title: event.title || event.place || 'Untitled source record',
    type: String(event.type || event.category || 'other').toLowerCase(),
    severity: ['critical', 'high', 'medium', 'low'].includes(String(event.severity).toLowerCase()) ? String(event.severity).toLowerCase() : 'unknown',
    source: typeof event.source === 'string' ? event.source : event.source?.name || 'Unspecified source',
    url: safeUrl(event.url), observedAt: timestamp(event.time ?? event.publishedAt),
  })).filter((event) => { if (seen.has(event.id)) return false; seen.add(event.id); return true; });
}

export function filterEvents(events, filters, savedIds = [], now = Date.now()) {
  const query = filters.search.trim().toLowerCase();
  return events.filter((event) => (filters.category === 'all' || event.type === filters.category)
    && (filters.severity === 'all' || event.severity === filters.severity)
    && (!filters.hours || (event.observedAt != null && event.observedAt <= now && event.observedAt >= now - Number(filters.hours) * 3600000))
    && (!filters.saved || savedIds.includes(event.id))
    && (!query || [event.title, event.source, event.place, event.country, event.type].filter(Boolean).join(' ').toLowerCase().includes(query)));
}

export function relativeTime(value, now = Date.now()) {
  const time = timestamp(value);
  if (time === null) return 'Time unavailable';
  if (time > now) return 'Future source timestamp';
  const minutes = Math.floor((now - time) / 60000);
  return minutes < 1 ? 'Just now' : minutes < 60 ? `${minutes}m ago` : minutes < 1440 ? `${Math.floor(minutes / 60)}h ago` : `${Math.floor(minutes / 1440)}d ago`;
}

export function createSnapshot({ events, filters, mission, health, watchlist, briefing, errors }) {
  return {
    schemaVersion: 1, platform: 'WORLDGPZ', exportedAt: new Date().toISOString(), filters,
    scope: 'Filtered source records, not a complete global incident inventory',
    mission: mission ? { generatedAt: mission.generatedAt, windowHours: mission.windowHours, summary: mission.summary, coverage: mission.coverage, method: mission.method, limitations: mission.limitations } : null,
    events, providerHealth: health, watchlist, briefing, errors,
    limitations: ['Source timestamps and severity labels are not independently verified.', 'Unavailable feeds and missing timestamps create coverage gaps.', 'Saved records are local snapshots and may no longer reflect current source data.'],
  };
}
