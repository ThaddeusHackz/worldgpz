import test from 'node:test';
import assert from 'node:assert/strict';
import { countEventsByRollingHour } from '../src/lib/signalVelocity.js';

const HOUR = 60 * 60 * 1000;

test('rolling signal velocity buckets are chronological and count only the last 24 hours', () => {
  const now = Date.UTC(2026, 8, 30, 12, 30);
  const events = [
    { time: now - 30 * 60 * 1000 },
    { publishedAt: new Date(now - 90 * 60 * 1000).toISOString() },
    { time: now - 23 * HOUR - 30 * 60 * 1000 },
    { time: now - 24 * HOUR },
    { time: now + 1 },
    { time: 'not-a-time' },
  ];
  const buckets = countEventsByRollingHour(events, now);
  assert.equal(buckets.length, 24);
  assert.equal(buckets[23], 1);
  assert.equal(buckets[22], 1);
  assert.equal(buckets[0], 1);
  assert.equal(buckets.reduce((sum, value) => sum + value, 0), 3);
});
