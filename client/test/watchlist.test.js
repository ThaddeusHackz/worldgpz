import test from 'node:test';
import assert from 'node:assert/strict';
import { findWatchlistMatches, normalizeWatchlist, WATCHLIST_LIMIT, WATCHLIST_TERM_LENGTH } from '../src/lib/watchlist.js';

test('watchlist terms are trimmed, case-insensitive deduplicated and bounded', () => {
  const terms = normalizeWatchlist(['  Accra  ', 'accra', 'x'.repeat(WATCHLIST_TERM_LENGTH + 8), ...Array.from({ length: 15 }, (_, index) => `topic-${index}`)]);
  assert.equal(terms[0], 'Accra');
  assert.equal(terms[1].length, WATCHLIST_TERM_LENGTH);
  assert.equal(terms.length, WATCHLIST_LIMIT);
});

test('watchlist matches title, description and location without duplicate records', () => {
  const news = [
    { id: 'story-1', title: 'Flood warning issued', description: 'Reports from Accra', source: 'News', time: 2 },
    { id: 'story-2', title: 'Routine market update', source: 'News', time: 1 },
  ];
  const events = [
    { id: 'story-1', title: 'Flood warning issued', source: 'Event duplicate', time: 2 },
    { id: 'event-1', title: 'Seismic activity', country: 'Ghana', time: 3 },
  ];
  const matches = findWatchlistMatches(news, events, ['accra', 'ghana']);
  assert.equal(matches.length, 2);
  assert.deepEqual(matches.map((item) => item.watchId), ['event-1', 'story-1']);
  assert.deepEqual(matches.map((item) => item.watchTerm), ['ghana', 'accra']);
  const locationMatch = findWatchlistMatches([{ id: 'geo-1', title: 'Coastal alert', location: 'Tema, Greater Accra' }], [], ['tema']);
  assert.equal(locationMatch[0].id, 'geo-1');
});
