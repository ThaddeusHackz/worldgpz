import { BaseProvider } from './base.js';
import { fetchJson } from '../../lib/http.js';
import { fetchGdeltArticles } from './base-providers.js';
import { fetchPublicNews } from './rss.js';
import { safeSourceUrl } from '../mission.js';

const TOPICS = [
  { region: 'MIDDLE EAST', terms: ['Israel', 'Gaza', 'Iran', 'Red Sea', 'Yemen', 'Syria'] },
  { region: 'EUROPE', terms: ['Ukraine', 'Russia', 'NATO', 'European Union'] },
  { region: 'ASIA PACIFIC', terms: ['Taiwan', 'South China Sea', 'China', 'Japan', 'Korea'] },
  { region: 'AFRICA', terms: ['Sudan', 'Sahel', 'Congo', 'Horn of Africa'] },
  { region: 'AMERICAS', terms: ['United States', 'Latin America', 'Caribbean'] },
];

function inferRegion(title = '') {
  const lowered = title.toLowerCase();
  return TOPICS.find((topic) => topic.terms.some((term) => lowered.includes(term.toLowerCase())))?.region || 'GLOBAL';
}

export class NewsProvider extends BaseProvider {
  constructor() { super('news', { ttlMs: 15 * 60_000, requiredKeys: [], emptyValue: [] }); this.retryAt = 0; }
  get isConfigured() { return true; }
  async _fetchFresh() {
    if (Date.now() < this.retryAt) throw new Error('News feeds are cooling down after a failed attempt');
    try { return await this.fetchNews(); }
    catch (error) { this.retryAt = Date.now() + 60_000; throw error; }
  }
  async publicFallback() {
    try {
      const articles = await fetchGdeltArticles(6_000);
      if (articles.length) return articles.map((article) => ({ ...article, region: inferRegion(article.title), url: safeSourceUrl(article.url) }));
    } catch { /* Public publisher feeds are an independent fallback. */ }
    const rss = await fetchPublicNews();
    const articles = rss.map((article) => ({ ...article, region: inferRegion(article.title) }));
    articles.fallback = true;
    articles.partial = rss.partial;
    return articles;
  }
  async fetchNews() {
    const key = this.secret('NEWS_API_KEY');
    if (!key) {
      return this.publicFallback();
    }
    const params = new URLSearchParams({
      q: '(conflict OR diplomacy OR earthquake OR disaster OR markets OR sanctions)',
      language: 'en', sortBy: 'publishedAt', pageSize: '80', apiKey: key,
    });
    try {
      const response = await fetchJson(`https://newsapi.org/v2/everything?${params}`, {}, 6_000, 1024 * 1024);
      if (response.status !== 'ok') throw new Error(`NewsAPI returned status ${response.status || 'unknown'}`);
      const articles = (response.articles || []).filter((article) => article.title && safeSourceUrl(article.url)).slice(0, 80).map((article, index) => ({
        id: `newsapi-${article.url}`, type: 'news', severity: 'low',
        title: article.title, description: article.description || '',
        source: article.source?.name || 'NewsAPI', author: article.author || null,
        url: safeSourceUrl(article.url), image: safeSourceUrl(article.urlToImage),
        publishedAt: article.publishedAt || null, time: article.publishedAt ? Date.parse(article.publishedAt) : null,
        region: inferRegion(article.title), external_id: article.url || `newsapi-${index}`,
      }));
      if (!articles.length) return this.publicFallback();
      return articles;
    } catch (error) {
      const fallback = await this.publicFallback();
      if (!fallback.length) throw error;
      const articles = fallback.map((article) => ({ ...article, region: inferRegion(article.title) }));
      articles.fallback = true;
      articles.partial = fallback.partial;
      return articles;
    }
  }
}
