export const WATCHLIST_STORAGE_KEY = 'worldgpz.watchlist.v1';
export const WATCHLIST_LIMIT = 10;
export const WATCHLIST_TERM_LENGTH = 40;

export function normalizeWatchlist(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const terms = [];
  for (const raw of value) {
    const term = String(raw || '').trim().replace(/\s+/g, ' ').slice(0, WATCHLIST_TERM_LENGTH);
    const key = term.toLocaleLowerCase();
    if (!term || seen.has(key)) continue;
    seen.add(key);
    terms.push(term);
    if (terms.length >= WATCHLIST_LIMIT) break;
  }
  return terms;
}

export function findWatchlistMatches(news = [], events = [], terms = []) {
  const normalizedTerms = normalizeWatchlist(terms);
  if (!normalizedTerms.length) return [];
  const unique = new Map();
  for (const item of [...events, ...news]) {
    const id = String(item?.id || item?.external_id || item?.url || item?.title || '');
    if (!id || unique.has(id)) continue;
    const haystack = `${item.title || ''} ${item.description || ''} ${item.country || ''} ${item.region || ''} ${item.location || ''} ${item.place || ''} ${item.city || ''} ${item.state || ''}`.toLocaleLowerCase();
    const match = normalizedTerms.find((term) => haystack.includes(term.toLocaleLowerCase()));
    if (match) unique.set(id, { ...item, watchId: id, watchTerm: match });
  }
  return [...unique.values()].sort((left, right) => {
    const leftTime = Number(left.time) || Date.parse(left.publishedAt || '') || 0;
    const rightTime = Number(right.time) || Date.parse(right.publishedAt || '') || 0;
    return rightTime - leftTime;
  }).slice(0, 100);
}
