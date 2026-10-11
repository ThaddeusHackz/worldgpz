import crypto from 'node:crypto';

const ranks = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
export function boundedHours(value = 24) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(168, Math.max(1, number)) : 24;
}
export function eventTime(event) {
  const value = event?.time ?? event?.publishedAt;
  if (value === null || value === undefined || value === '') return null;
  const number = typeof value === 'number' ? value : /^\d+(\.\d+)?$/.test(String(value)) ? Number(value) : Date.parse(value);
  return Number.isFinite(number) && number > 0 ? (number < 1e11 ? number * 1000 : number) : null;
}
export function safeSourceUrl(value) {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null; }
  catch { return null; }
}
export function isBaseline(event) {
  return event?.provenance?.kind === 'baseline' || event?.baseline === true || String(event?.id || '').startsWith('watch-') || event?.source === 'WORLDGPZ context';
}

// Pure, deterministic analysis of reported observations, not an AI threat prediction.
export function analyzeMission(events = [], { hours = 24, now = Date.now(), unavailableSources = [] } = {}) {
  const windowHours = boundedHours(hours);
  const unique = new Map();
  const excluded = { baseline: 0, undated: 0, outsideWindow: 0 };
  for (const event of Array.isArray(events) ? events : []) {
    if (!event || typeof event.title !== 'string' || !event.title.trim()) continue;
    if (isBaseline(event)) { excluded.baseline++; continue; }
    const time = eventTime(event);
    if (time === null) { excluded.undated++; continue; }
    if (time < now - windowHours * 3_600_000 || time > now) { excluded.outsideWindow++; continue; }
    const source = String(event.source || 'Unknown source').slice(0, 160);
    const url = safeSourceUrl(event.url);
    const identity = url || event.external_id || event.id || `${event.title}:${time}`;
    const key = `${source}:${identity}`;
    if (unique.has(key)) continue;
    const coordinate = (value, limit) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) && Math.abs(Number(value)) <= limit ? Number(value) : null;
    unique.set(key, {
      id: String(event.id || `mission-${crypto.createHash('sha256').update(key).digest('hex').slice(0, 16)}`).slice(0, 512),
      title: event.title.trim().slice(0, 500), type: String(event.type || 'report').slice(0, 80),
      severity: Object.hasOwn(ranks, event.severity) ? event.severity : 'info', source, url,
      latitude: coordinate(event.latitude, 90), longitude: coordinate(event.longitude, 180), time,
      provenance: { kind: 'reported', provider: event.provenance?.provider || null, stale: Boolean(event.provenance?.stale), verified: false },
    });
  }
  const priorities = [...unique.values()].sort((a, b) => ranks[b.severity] - ranks[a.severity] || b.time - a.time || a.id.localeCompare(b.id));
  const counts = new Map();
  for (const event of priorities) counts.set(event.source, (counts.get(event.source) || 0) + 1);
  return {
    generatedAt: new Date(now).toISOString(), windowHours,
    summary: { total: priorities.length, critical: priorities.filter((event) => event.severity === 'critical').length, high: priorities.filter((event) => event.severity === 'high').length, sourceCount: counts.size },
    priorities, coverage: [...counts].map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count || a.source.localeCompare(b.source)),
    method: 'Deterministic reported-event triage: severity, then observation time. No predictive or independently verified threat assessment.',
    limitations: [
      'Coverage is limited to connected feeds; absence of reports does not establish safety. Provider severity labels are not directly comparable.',
      `Excluded ${excluded.baseline} baseline watchpoints (not live), ${excluded.undated} undated records, and ${excluded.outsideWindow} old or future records.`,
      ...(priorities.some((event) => event.provenance.stale) ? ['Some reports came from stale provider caches; observation dates are preserved.'] : []),
      ...(unavailableSources.length ? [`Unavailable or degraded feeds: ${[...new Set(unavailableSources)].sort().join(', ')}.`] : []),
    ],
  };
}
