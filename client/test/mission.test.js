import test from 'node:test';
import assert from 'node:assert/strict';
import { createSnapshot, filterEvents, hasCoordinates, normalizeEvents, relativeTime, safeUrl, timestamp } from '../src/lib/mission.js';

test('source timestamps accept ISO, seconds and milliseconds without inventing recency', () => {
  assert.equal(timestamp('2026-10-11T12:00:00Z'), 1791720000000);
  assert.equal(timestamp(1791720000), 1791720000000);
  assert.equal(timestamp('1791720000000'), 1791720000000);
  assert.equal(timestamp(null), null);
  assert.equal(timestamp('bad date'), null);
  assert.equal(relativeTime(null), 'Time unavailable');
});

test('only original HTTP(S) links are accepted', () => {
  assert.equal(safeUrl('javascript:alert(1)'), null);
  assert.equal(safeUrl('data:text/html,test'), null);
  assert.equal(safeUrl('/unverified'), null);
  assert.equal(safeUrl('https://example.org/report'), 'https://example.org/report');
});

test('missing coordinates do not appear at the origin', () => {
  assert.equal(hasCoordinates({ latitude: null, longitude: '' }), false);
  assert.equal(hasCoordinates({ latitude: 0, longitude: 0 }), true);
  assert.equal(hasCoordinates({ latitude: 100, longitude: 0 }), false);
});

test('records deduplicate and unspecified severity remains unknown', () => {
  const events = normalizeEvents([{ id: 'a', title: 'Source record' }, { id: 'a', title: 'Duplicate' }]);
  assert.equal(events.length, 1);
  assert.equal(events[0].severity, 'unknown');
  assert.equal(events[0].observedAt, null);
});

test('category, severity, source time, search and watchlist filters compose', () => {
  const now = Date.parse('2026-10-11T12:00:00Z');
  const events = normalizeEvents([
    { id: 'a', title: 'Tokyo earthquake', source: 'USGS', type: 'seismic', severity: 'high', time: now - 1800000 },
    { id: 'b', title: 'Tokyo undated', source: 'USGS', type: 'seismic', severity: 'high' },
    { id: 'c', title: 'Tokyo older', source: 'USGS', type: 'seismic', severity: 'high', time: now - 7200000 },
    { id: 'd', title: 'Future record', source: 'USGS', type: 'seismic', severity: 'high', time: now + 60000 },
  ]);
  assert.deepEqual(filterEvents(events, { category: 'seismic', severity: 'high', hours: '1', search: 'usgs', saved: true }, ['a', 'b', 'c', 'd'], now).map((event) => event.id), ['a']);
});

test('export retains coverage, filters and source provenance without live claims', () => {
  const report = createSnapshot({ events: [{ id: 'a', source: 'USGS', provenance: 'source' }], filters: { severity: 'high' }, mission: { method: 'rule-based', limitations: ['partial'], coverage: [] }, health: [], watchlist: [], briefing: null, errors: {} });
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.events[0].provenance, 'source');
  assert.equal(report.mission.method, 'rule-based');
  assert.ok(report.limitations.length);
  assert.equal(report.filters.severity, 'high');
});
