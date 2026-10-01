import { BaseProvider } from './base.js';
import { fetchJson } from '../../lib/http.js';
import { fetchGdeltArticles } from './base-providers.js';

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
  constructor() { super('news', { ttlMs: 15 * 60_000, requiredKeys: [], emptyValue: [] }); }
  get isConfigured() { return true; }
  async _fetchFresh() {
    const key = this.secret('NEWS_API_KEY');
    if (!key) {
      const articles = await fetchGdeltArticles();
      return articles.map((article) => ({ ...article, region: inferRegion(article.title), source: article.source || 'GDELT' }));
    }
    const params = new URLSearchParams({
      q: '(conflict OR diplomacy OR earthquake OR disaster OR markets OR sanctions)',
      language: 'en', sortBy: 'publishedAt', pageSize: '80', apiKey: key,
    });
    try {
      const response = await fetchJson(`https://newsapi.org/v2/everything?${params}`);
      if (response.status !== 'ok') throw new Error(`NewsAPI returned status ${response.status || 'unknown'}`);
      return (response.articles || []).filter((article) => article.title && article.url).map((article, index) => ({
        id: `newsapi-${article.url}`, type: 'news', severity: 'low',
        title: article.title, description: article.description || '',
        source: article.source?.name || 'NewsAPI', author: article.author || null,
        url: article.url, image: article.urlToImage || null,
        publishedAt: article.publishedAt || null, time: article.publishedAt ? Date.parse(article.publishedAt) : Date.now(),
        region: inferRegion(article.title), external_id: article.url || `newsapi-${index}`,
      }));
    } catch (error) {
      const fallback = await fetchGdeltArticles();
      if (!fallback.length) throw error;
      const articles = fallback.map((article) => ({ ...article, region: inferRegion(article.title) }));
      articles.fallback = true;
      return articles;
    }
  }
}
