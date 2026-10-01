import { BaseProvider } from './base.js';
import { fetchJson, safeNumber } from '../../lib/http.js';

const GAMMA_EVENTS_URL = 'https://gamma-api.polymarket.com/events';
const MANIFOLD_SEARCH_URL = 'https://api.manifold.markets/v0/search-markets';

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function isOpen(market) {
  return market && market.active !== false && market.closed !== true && market.archived !== true;
}

function normalizePolymarket(events) {
  return events.flatMap((event) => (Array.isArray(event.markets) ? event.markets : []).filter(isOpen).map((market) => {
    const outcomes = parseJsonArray(market.outcomes).map((item) => String(item));
    const prices = parseJsonArray(market.outcomePrices).map((item) => safeNumber(item));
    const yesIndex = outcomes.findIndex((outcome) => outcome.toLowerCase() === 'yes');
    const priceIndex = yesIndex >= 0 ? yesIndex : 0;
    const price = prices[priceIndex] ?? safeNumber(market.lastTradePrice);
    const volume24h = safeNumber(market.volume24hr ?? event.volume24hr, 0);
    const eventSlug = event.slug || market.slug;
    const marketSlug = market.slug || event.slug;
    const url = eventSlug ? `https://polymarket.com/event/${encodeURIComponent(eventSlug)}`
      : marketSlug ? `https://polymarket.com/event/${encodeURIComponent(marketSlug)}` : null;
    return {
      id: `poly-${market.id || marketSlug || `${event.id || event.slug}-${market.question || ''}`}`,
      question: String(market.question || event.title || 'Prediction market').slice(0, 240),
      eventTitle: String(event.title || market.question || 'Prediction market').slice(0, 240),
      category: event.category || (Array.isArray(event.tags) ? event.tags.map((tag) => tag.label || tag.name).filter(Boolean).slice(0, 3).join(', ') : '') || 'General',
      outcomes,
      probability: price === null ? null : Math.max(0, Math.min(100, Number((price * 100).toFixed(1)))),
      outcomeLabel: outcomes[priceIndex] || 'Yes',
      volume24h,
      volumeUnit: 'USD',
      liquidity: safeNumber(market.liquidity, 0),
      updatedAt: market.updatedAt || event.updatedAt || null,
      source: 'Polymarket',
      url,
    };
  }).filter((market) => market.url && market.probability !== null))
    .sort((left, right) => right.volume24h - left.volume24h)
    .slice(0, 30);
}

function normalizeManifold(markets) {
  return markets.filter((market) => market && !market.isResolved && market.outcomeType === 'BINARY'
    && (!market.closeTime || Number(market.closeTime) > Date.now()))
    .map((market) => {
      const probability = safeNumber(market.probability);
      return {
        id: `manifold-${market.id}`,
        question: String(market.question || 'Community forecast').slice(0, 240),
        eventTitle: String(market.question || 'Community forecast').slice(0, 240),
        category: 'Community forecasting',
        outcomes: ['Yes', 'No'],
        probability: probability === null ? null : Math.max(0, Math.min(100, Number((probability * 100).toFixed(1)))),
        outcomeLabel: 'Yes',
        volume24h: safeNumber(market.volume24Hours, 0),
        volumeUnit: 'MANA',
        liquidity: safeNumber(market.totalLiquidity, 0),
        updatedAt: market.lastUpdatedTime ? new Date(market.lastUpdatedTime).toISOString() : null,
        source: 'Manifold Markets',
        url: /^https:\/\/manifold\.markets\//i.test(market.url || '') ? market.url : null,
      };
    }).filter((market) => market.url && market.probability !== null)
    .sort((left, right) => right.volume24h - left.volume24h)
    .slice(0, 30);
}

export class PredictionsProvider extends BaseProvider {
  constructor() { super('predictions', { ttlMs: 10 * 60_000, requiredKeys: [], emptyValue: [] }); }
  get isConfigured() { return true; }

  async _fetchFresh() {
    let polymarketError;
    try {
      const query = new URLSearchParams({ active: 'true', closed: 'false', order: 'volume_24hr', ascending: 'false', limit: '100' });
      const events = await fetchJson(`${GAMMA_EVENTS_URL}?${query}`, { headers: { Accept: 'application/json' } });
      if (!Array.isArray(events)) throw new Error('Polymarket returned an unexpected response.');
      const markets = normalizePolymarket(events);
      if (markets.length) return markets;
      polymarketError = new Error('Polymarket returned no active market records.');
    } catch (error) { polymarketError = error; }

    try {
      const query = new URLSearchParams({ term: '', sort: '24-hour-vol', limit: '100' });
      const response = await fetchJson(`${MANIFOLD_SEARCH_URL}?${query}`, { headers: { Accept: 'application/json' } });
      if (!Array.isArray(response)) throw new Error('Manifold returned an unexpected response.');
      const markets = normalizeManifold(response);
      if (!markets.length) throw new Error('Manifold returned no open binary questions.');
      markets.fallback = true;
      return markets;
    } catch (fallbackError) {
      const primary = String(polymarketError?.message || 'request failed').slice(0, 120);
      const fallback = String(fallbackError?.message || 'request failed').slice(0, 120);
      throw new Error(`Prediction sources unavailable: Polymarket ${primary}; Manifold ${fallback}`);
    }
  }
}

export { normalizeManifold, normalizePolymarket, parseJsonArray as parsePredictionArray };
