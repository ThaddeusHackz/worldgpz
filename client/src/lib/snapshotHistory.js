export const SNAPSHOT_HISTORY_STORAGE_KEY = 'worldgpz:snapshot-history:v1';
export const SNAPSHOT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export const SNAPSHOT_CAPTURE_INTERVAL_MS = 15 * 60 * 1000;
export const SNAPSHOT_LIMIT = 672;
const ITEM_LIMIT = 24;
const TITLE_LIMIT = 180;

function browserStorage() {
  try { return globalThis.localStorage; } catch { return undefined; }
}

function text(value, limit = TITLE_LIMIT) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function compactItems(items, fields) {
  return (Array.isArray(items) ? items : []).slice(0, ITEM_LIMIT).map((item) => {
    const compact = {};
    for (const field of fields) {
      const value = item?.[field];
      if (['latitude', 'longitude', 'magnitude', 'current', 'changePercent', 'probability', 'score', 'riskScore'].includes(field)) {
        const number = Number(value);
        if (Number.isFinite(number)) compact[field] = number;
      } else if (value != null && value !== '') compact[field] = text(value, field === 'url' ? 500 : TITLE_LIMIT);
    }
    return compact;
  });
}

export function createDashboardSnapshot(data, now = Date.now()) {
  const timestamp = new Date(now).toISOString();
  return {
    id: `${now}`,
    timestamp,
    counts: {
      events: Array.isArray(data?.events) ? data.events.length : 0,
      headlines: Array.isArray(data?.news) ? data.news.length : 0,
      markets: Array.isArray(data?.markets) ? data.markets.length : 0,
      predictions: Array.isArray(data?.predictions) ? data.predictions.length : 0,
      activeSources: Array.isArray(data?.health) ? data.health.filter((source) => ['online', 'degraded'].includes(source.status)).length : 0,
    },
    events: compactItems(data?.events, ['id', 'title', 'type', 'severity', 'source', 'time', 'latitude', 'longitude', 'magnitude']),
    news: compactItems(data?.news, ['id', 'title', 'source', 'publishedAt', 'url', 'region']),
    markets: compactItems(data?.markets, ['symbol', 'name', 'current', 'changePercent', 'type']),
    predictions: compactItems(data?.predictions, ['title', 'question', 'probability', 'volume', 'category', 'url']),
    countries: compactItems(data?.countries, ['code', 'name', 'riskScore', 'score', 'region']),
    chokepoints: compactItems(data?.chokepoints, ['name', 'riskScore', 'score', 'status', 'region']),
  };
}

export function loadDashboardSnapshots(storage = browserStorage(), now = Date.now()) {
  try {
    const parsed = JSON.parse(storage?.getItem(SNAPSHOT_HISTORY_STORAGE_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((snapshot) => snapshot && typeof snapshot.id === 'string' && Number.isFinite(Date.parse(snapshot.timestamp)) && now - Date.parse(snapshot.timestamp) <= SNAPSHOT_RETENTION_MS)
      .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
      .slice(0, SNAPSHOT_LIMIT);
  } catch {
    return [];
  }
}

export function captureDashboardSnapshot(data, { storage = browserStorage(), now = Date.now(), force = false } = {}) {
  if (!data || !data.lastSync || !storage) return { captured: false, snapshots: loadDashboardSnapshots(storage, now) };
  const existing = loadDashboardSnapshots(storage, now);
  if (!force && existing.length && now - Date.parse(existing[0].timestamp) < SNAPSHOT_CAPTURE_INTERVAL_MS) {
    return { captured: false, snapshots: existing };
  }
  const snapshot = createDashboardSnapshot(data, now);
  const snapshots = [snapshot, ...existing.filter((item) => item.id !== snapshot.id)].slice(0, SNAPSHOT_LIMIT);
  try {
    storage.setItem(SNAPSHOT_HISTORY_STORAGE_KEY, JSON.stringify(snapshots));
    return { captured: true, snapshots };
  } catch {
    const compacted = snapshots.slice(0, Math.max(1, Math.floor(SNAPSHOT_LIMIT / 2)));
    try {
      storage.setItem(SNAPSHOT_HISTORY_STORAGE_KEY, JSON.stringify(compacted));
      return { captured: true, snapshots: compacted, compacted: true };
    } catch {
      return { captured: false, snapshots: existing, error: 'Browser storage is full or unavailable.' };
    }
  }
}
