import test from 'node:test';
import assert from 'node:assert/strict';
import {
  captureDashboardSnapshot, createDashboardSnapshot, loadDashboardSnapshots,
  SNAPSHOT_CAPTURE_INTERVAL_MS, SNAPSHOT_HISTORY_STORAGE_KEY, SNAPSHOT_RETENTION_MS,
} from '../src/lib/snapshotHistory.js';

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

const sample = {
  lastSync: 1,
  events: [{ id: 'e1', title: '  Earthquake\nreport ', type: 'seismic', latitude: 5.6, longitude: -0.2, magnitude: 4.2 }],
  news: [{ title: 'Headline', source: 'Example', url: 'https://example.test/story' }],
  markets: [{ symbol: 'AAPL', current: 210.5, changePercent: 1.2 }],
  predictions: [{ title: 'Example outcome', probability: 0.4 }],
  health: [{ status: 'online' }, { status: 'offline' }],
};

test('dashboard snapshots compact current records into a dated, source-labeled local view', () => {
  const snapshot = createDashboardSnapshot(sample, 1_800_000_000_000);
  assert.equal(snapshot.events[0].title, 'Earthquake report');
  assert.equal(snapshot.counts.events, 1);
  assert.equal(snapshot.counts.activeSources, 1);
  assert.equal(snapshot.markets[0].current, 210.5);
});

test('snapshot history captures on schedule, supports manual capture and expires after seven days', () => {
  const storage = memoryStorage();
  const first = captureDashboardSnapshot(sample, { storage, now: 1_800_000_000_000 });
  assert.equal(first.captured, true);
  const tooSoon = captureDashboardSnapshot(sample, { storage, now: 1_800_000_000_000 + SNAPSHOT_CAPTURE_INTERVAL_MS - 1 });
  assert.equal(tooSoon.captured, false);
  const manual = captureDashboardSnapshot(sample, { storage, now: 1_800_000_000_000 + 60_000, force: true });
  assert.equal(manual.captured, true);
  assert.equal(manual.snapshots.length, 2);
  const old = { ...manual.snapshots[1], timestamp: new Date(1_800_000_000_000 - SNAPSHOT_RETENTION_MS - 1).toISOString() };
  storage.setItem(SNAPSHOT_HISTORY_STORAGE_KEY, JSON.stringify([old, ...manual.snapshots]));
  assert.equal(loadDashboardSnapshots(storage, 1_800_000_000_000).length, 2);
});

test('snapshot storage handles missing data and malformed browser storage without throwing', () => {
  const storage = memoryStorage({ [SNAPSHOT_HISTORY_STORAGE_KEY]: 'broken' });
  assert.equal(loadDashboardSnapshots(storage).length, 0);
  assert.equal(captureDashboardSnapshot({ events: [] }, { storage }).captured, false);
  const unavailable = { getItem() { return null; }, setItem() { throw new Error('quota'); } };
  assert.equal(captureDashboardSnapshot(sample, { storage: unavailable }).captured, false);
});
