import { fetchJson } from '../lib/http.js';
import { LRUCache } from '../lib/cache.js';
import { safeSourceUrl } from './mission.js';

const failure = (status, message, retryAfterSeconds) => Object.assign(new Error(message), { status, retryAfterSeconds });
const clean = (value, limit) => String(value || '').replace(/<[^>]*>/g, ' ').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit);
export class ResearchService {
  constructor(getKey, { now = Date.now } = {}) {
    this.getKey = getKey; this.now = now; this.cache = new LRUCache(30, 30 * 60_000); this.lastAttempt = null; this.inFlight = null;
  }
  get configured() { return Boolean(this.getKey()); }
  async search(query) {
    if (typeof query !== 'string' || !query.trim() || query.length > 500) throw failure(400, 'Query must be a nonblank string of at most 500 characters.');
    query = query.trim();
    const cacheKey = query.toLowerCase().replace(/\s+/g, ' ');
    const cached = this.cache.get(cacheKey);
    if (cached) return { ...cached, cached: true };
    if (!this.configured) throw failure(503, 'Tavily research is not configured. Set TAVILY_API_KEY on the server or in the admin vault.');
    if (this.inFlight?.key === cacheKey) return this.inFlight.promise;
    if (this.lastAttempt !== null && this.now() - this.lastAttempt < 10 * 60_000) {
      throw failure(429, 'Research cooldown active across all queries; cached results remain available.', Math.ceil((10 * 60_000 - (this.now() - this.lastAttempt)) / 1000));
    }
    this.lastAttempt = this.now();
    const promise = this.perform(query, cacheKey);
    this.inFlight = { key: cacheKey, promise };
    try { return await promise; } finally { this.inFlight = null; }
  }
  async perform(query, cacheKey) {
    try {
      const payload = await fetchJson('https://api.tavily.com/search', {
        method: 'POST', redirect: 'error', headers: { Authorization: `Bearer ${this.getKey()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, search_depth: 'basic', max_results: 5, include_answer: false, include_raw_content: false, include_images: false }),
      }, 12_000, 256 * 1024);
      if (!Array.isArray(payload?.results)) throw new Error('Invalid research results');
      const seen = new Set();
      const results = payload.results.slice(0, 20).flatMap((item, index) => {
        const url = safeSourceUrl(item?.url);
        if (!url || !item.title || seen.has(url)) return [];
        seen.add(url);
        return [{ id: `research-${index + 1}`, title: clean(item.title, 500), url, content: clean(item.content, 1800), source: new URL(url).hostname }];
      }).slice(0, 5);
      const data = { query, results, citations: results.map(({ id, title, url, source }) => ({ id, title, url, source })), generatedAt: new Date(this.now()).toISOString(),
        method: 'Authenticated Tavily basic web search; maximum five results; no model synthesis', cached: false,
        limitations: ['Web search snippets are reported source material, not independently verified. One paid attempt per ten minutes across queries; results cached thirty minutes. No automatic retries.'] };
      this.cache.set(cacheKey, data);
      return data;
    } catch { throw failure(502, 'Research upstream failed, timed out, or exceeded response bounds. No automatic retry; ten-minute cooldown remains active.'); }
  }
}
