import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEvents } from '../src/lib/mission.js';
import { applyLens, DEFAULT_LENS, geographicClusters, observedSignals, sourceTimeline, updateObservedInbox } from '../src/lib/watchroom.js';

const now = Date.parse('2026-10-11T12:00:00Z');
const records = normalizeEvents([
  { id: 'seismic', title: 'Japan source observation', source: 'USGS', severity: 'high', type: 'seismic', latitude: 35, longitude: 139, time: now - 3600000, provenance: 'observed' },
  { id: 'low', title: 'Japan low observation', source: 'USGS', severity: 'low', type: 'seismic', latitude: 35.2, longitude: 139.2, time: now - 7200000, provenance: 'observed' },
  { id: 'baseline', title: 'Baseline', time: now, provenance: 'baseline' },
  { id: 'stale', title: 'Stale', time: now, provenance: 'stale' },
  { id: 'static', title: 'Static', time: now, metadata: { static: true } },
  { id: 'future', title: 'Future', time: now + 1000 },
  { id: 'undated', title: 'Undated' },
]);

test('Watchroom excludes baseline, stale, static, future and undated observations', () => {
  assert.deepEqual(observedSignals(records, now).map((item) => item.id), ['seismic', 'low']);
});
test('named lenses compose minimum severity, query, source time and region', () => {
  assert.deepEqual(applyLens(records, { ...DEFAULT_LENS, minSeverity: 'medium', region: 'asia', query: 'usgs' }, now).map((item) => item.id), ['seismic']);
  assert.equal(applyLens(records, { ...DEFAULT_LENS, region: 'europe' }, now).length, 0);
  assert.equal(applyLens(records, { ...DEFAULT_LENS, hours: 1 }, now).length, 1);
});
test('geographic sectors aggregate actual records without inferring risk', () => {
  const clusters = geographicClusters(observedSignals(records, now));
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0].count, 2);
  assert.equal(clusters[0].sourceCount, 1);
  assert.equal(clusters[0].severity, 'high');
  assert.deepEqual(clusters[0].eventIds, ['seismic', 'low']);
});
test('source timeline buckets count loaded observations, not replayed activity', () => {
  const timeline = sourceTimeline(records, now);
  assert.equal(timeline.length, 24);
  assert.equal(timeline.reduce((sum, item) => sum + item.count, 0), 2);
  assert.equal(timeline.reduce((sum, item) => sum + item.highCount, 0), 1);
});
test('local inbox deduplicates identifiers across missions and repeated polls', () => {
  const missions = [{ name: 'All observations', lens: DEFAULT_LENS }, { name: 'Seismic', lens: { ...DEFAULT_LENS, category: 'seismic' } }];
  const inbox = updateObservedInbox([], missions, records, now);
  assert.equal(inbox.length, 2);
  assert.deepEqual(inbox[0].missionNames, ['All observations', 'Seismic']);
  assert.equal(inbox[0].firstSeenAt, new Date(now).toISOString());
  assert.equal(updateObservedInbox(inbox, missions, records, now).length, 2);
  assert.equal(updateObservedInbox([], missions, records, now, ['seismic', 'low']).length, 0, 'previously observed identifiers remain deduplicated after inbox retention evicts them');
});
