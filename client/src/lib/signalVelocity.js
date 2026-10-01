const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Count events in chronological one-hour buckets covering [now - 24h, now). */
export function countEventsByRollingHour(events = [], now = Date.now()) {
  const buckets = Array(24).fill(0);
  for (const event of events) {
    const timestamp = Number(event?.time) || Date.parse(event?.publishedAt || '');
    if (!Number.isFinite(timestamp)) continue;
    const age = now - timestamp;
    if (age < 0 || age >= DAY_MS) continue;
    const bucket = 23 - Math.floor(age / HOUR_MS);
    buckets[bucket] += 1;
  }
  return buckets;
}
