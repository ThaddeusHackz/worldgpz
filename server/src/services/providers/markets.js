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
  }

  async _fetchFresh() {
    const token = this.secret('FINNHUB_API_KEY');
    const results = await Promise.allSettled(MARKET_WATCHLIST.map(async (item) => {
      const params = new URLSearchParams({ symbol: item.symbol, token });
      const endpoint = CRYPTO.has(item.type) ? 'crypto/quote' : 'quote';
      const quote = await fetchJson(`https://finnhub.io/api/v1/${endpoint}?${params}`);
      const current = safeNumber(quote.c, 0);
      if (!current) return null;
      return {
        ...item, current, change: safeNumber(quote.d, current - safeNumber(quote.pc, current)),
        changePercent: safeNumber(quote.dp, 0), high: safeNumber(quote.h), low: safeNumber(quote.l),
        open: safeNumber(quote.o), previousClose: safeNumber(quote.pc), timestamp: safeNumber(quote.t), source: 'Finnhub',
      };
    }));
    const quotes = results.filter((result) => result.status === 'fulfilled' && result.value).map((result) => result.value);
    if (!quotes.length) {
      const failed = results.find((result) => result.status === 'rejected');
      throw new Error(failed?.reason?.message || 'Finnhub returned no valid quotes. The market may be closed or the symbols may not be enabled.');
    }
    if (quotes.length < MARKET_WATCHLIST.length) quotes.partial = true;
    return quotes;
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
