import { BaseProvider } from './base.js';
import { fetchJson, safeNumber } from '../../lib/http.js';

export const MARKET_WATCHLIST = [
  { symbol: 'AAPL', name: 'Apple', type: 'stock' },
  { symbol: 'MSFT', name: 'Microsoft', type: 'stock' },
  { symbol: 'NVDA', name: 'NVIDIA', type: 'stock' },
  { symbol: 'GOOGL', name: 'Alphabet', type: 'stock' },
  { symbol: 'AMZN', name: 'Amazon', type: 'stock' },
  { symbol: 'TSLA', name: 'Tesla', type: 'stock' },
  { symbol: 'SPY', name: 'S&P 500 ETF', type: 'index' },
  { symbol: 'QQQ', name: 'Nasdaq 100 ETF', type: 'index' },
  { symbol: 'BINANCE:BTCUSDT', name: 'Bitcoin', type: 'crypto' },
  { symbol: 'BINANCE:ETHUSDT', name: 'Ethereum', type: 'crypto' },
];

const CRYPTO = new Set(['crypto']);

export class MarketsProvider extends BaseProvider {
  constructor() {
    super('markets', { ttlMs: 60_000, requiredKeys: ['FINNHUB_API_KEY'], emptyValue: [] });
    this.forexData = null;
    this.forexExpiry = 0;
    this.watchlistCache = new Map();
  }

  async #fetchQuote(item, token) {
    const params = new URLSearchParams({ symbol: item.symbol, token });
    const endpoint = CRYPTO.has(item.type) || item.symbol.startsWith('BINANCE:') ? 'crypto/quote' : 'quote';
    const quote = await fetchJson(`https://finnhub.io/api/v1/${endpoint}?${params}`);
    const current = safeNumber(quote.c, 0);
    if (!current) return null;
    return {
      ...item, current, change: safeNumber(quote.d, current - safeNumber(quote.pc, current)),
      changePercent: safeNumber(quote.dp, 0), high: safeNumber(quote.h), low: safeNumber(quote.l),
      open: safeNumber(quote.o), previousClose: safeNumber(quote.pc), timestamp: safeNumber(quote.t), source: 'Finnhub',
    };
  }

  async _fetchFresh() {
    const token = this.secret('FINNHUB_API_KEY');
    const results = await Promise.allSettled(MARKET_WATCHLIST.map((item) => this.#fetchQuote(item, token)));
    const quotes = results.filter((result) => result.status === 'fulfilled' && result.value).map((result) => result.value);
    if (!quotes.length) {
      const failed = results.find((result) => result.status === 'rejected');
      throw new Error(failed?.reason?.message || 'Finnhub returned no valid quotes. The market may be closed or the symbols may not be enabled.');
    }
    if (quotes.length < MARKET_WATCHLIST.length) quotes.partial = true;
    return quotes;
  }

  async fetchWatchlist(symbols, { force = false } = {}) {
    const token = this.secret('FINNHUB_API_KEY');
    if (!token) return { data: [], configured: false, error: 'FINNHUB_API_KEY is not configured.' };
    const known = new Map(MARKET_WATCHLIST.map((item) => [item.symbol, item]));
    const requested = [...new Set((Array.isArray(symbols) ? symbols : []).map((symbol) => String(symbol || '').trim().toUpperCase())
      .filter((symbol) => /^[A-Z0-9][A-Z0-9._:-]{0,23}$/.test(symbol)))].slice(0, 50);
    const queue = requested.filter((symbol) => force || !this.watchlistCache.has(symbol) || this.watchlistCache.get(symbol).expiresAt <= Date.now());
    let cursor = 0;
    let failures = 0;
    const worker = async () => {
      while (cursor < queue.length) {
        const symbol = queue[cursor++];
        const existing = this.watchlistCache.get(symbol);
        const item = known.get(symbol) || { symbol, name: symbol, type: symbol.startsWith('BINANCE:') ? 'crypto' : 'stock' };
        try {
          const quote = await this.#fetchQuote(item, token);
          if (quote) this.watchlistCache.set(symbol, { quote, expiresAt: Date.now() + 5 * 60_000 });
          else failures += 1;
        } catch {
          failures += 1;
          if (!existing) this.watchlistCache.delete(symbol);
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(5, queue.length) }, () => worker()));
    const data = requested.map((symbol) => this.watchlistCache.get(symbol)?.quote).filter(Boolean);
    const stale = requested.some((symbol) => {
      const entry = this.watchlistCache.get(symbol);
      return entry && entry.expiresAt <= Date.now();
    });
    return { data, configured: true, cached: queue.length === 0, stale, error: failures ? `${failures} symbol${failures === 1 ? '' : 's'} could not be refreshed.` : null };
  }

  async fetchForex({ force = false } = {}) {
    const token = this.secret('FINNHUB_API_KEY');
    if (!token) return { data: [], configured: false, error: 'FINNHUB_API_KEY is not configured.' };
    if (!force && this.forexData && Date.now() < this.forexExpiry) return { data: this.forexData, configured: true, cached: true };
    const params = new URLSearchParams({ base: 'USD', token });
    const response = await fetchJson(`https://finnhub.io/api/v1/forex/rates?${params}`);
    const quotes = response.quote || response.rates || {};
    this.forexData = Object.entries(quotes).filter(([, value]) => Number.isFinite(Number(value))).slice(0, 20).map(([currency, rate]) => ({
      symbol: `USD/${currency}`, currency, rate: Number(rate), source: 'Finnhub',
    }));
    this.forexExpiry = Date.now() + 5 * 60_000;
    return { data: this.forexData, configured: true, cached: false };
  }
}
