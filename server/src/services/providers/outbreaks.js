import { BaseProvider } from './base.js';
import { fetchJson } from '../../lib/http.js';

const WHO_OUTBREAKS_URL = 'https://www.who.int/api/news/diseaseoutbreaknews';

function cleanText(value, limit = 520) {
  return String(value || '')
    .replace(/<\s*br\s*\/?\s*>/gi, ' ')
    .replace(/<\s*\/p\s*>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit);
}

function noticeUrl(item) {
  if (item.ItemDefaultUrl) {
    try { return new URL(item.ItemDefaultUrl, 'https://www.who.int').toString(); } catch {}
  }
  if (item.UrlName) return `https://www.who.int/emergencies/disease-outbreak-news/item/${encodeURIComponent(item.UrlName)}`;
  return null;
}

export class OutbreaksProvider extends BaseProvider {
  constructor() { super('outbreaks', { ttlMs: 15 * 60_000, requiredKeys: [], emptyValue: [] }); }
  get isConfigured() { return true; }

  async _fetchFresh() {
    const cutoff = Date.now() - 5 * 365 * 24 * 60 * 60_000;
    const since = new Date(cutoff).toISOString().replace(/\.\d{3}Z$/, 'Z');
    const baseQuery = {
      '$select': 'SystemSourceKey,Title,OverrideTitle,UseOverrideTitle,PublicationDate,PublicationDateAndTime,Summary,Overview,Assessment,Response,UrlName,ItemDefaultUrl,DonId,Provider',
      '$orderby': 'PublicationDateAndTime desc',
      '$top': '30',
    };
    let response;
    let fallback = false;
    try {
      const query = new URLSearchParams({ ...baseQuery, '$filter': `PublicationDateAndTime ge ${since}` });
      response = await fetchJson(`${WHO_OUTBREAKS_URL}?${query}`, { headers: { Accept: 'application/json' } });
    } catch (error) {
      if (!/HTTP 400\b|HTTP 501\b/.test(String(error?.message || ''))) throw error;
      // Keep the feed usable if WHO changes/restricts date filtering; still sort, cap and filter locally.
      const query = new URLSearchParams(baseQuery);
      response = await fetchJson(`${WHO_OUTBREAKS_URL}?${query}`, { headers: { Accept: 'application/json' } });
      fallback = true;
    }
    if (!Array.isArray(response.value)) throw new Error('WHO outbreak feed returned an unexpected OData response.');
    const notices = response.value.map((item) => {
      const title = cleanText(item.UseOverrideTitle && item.OverrideTitle ? item.OverrideTitle : item.Title, 240) || 'WHO Disease Outbreak Notice';
      const publishedAt = item.PublicationDateAndTime || item.PublicationDate || null;
      const summary = cleanText(item.Summary || item.Overview || item.Assessment || item.Response, 520);
      return {
        id: `who-don-${item.Id || item.DonId || item.UrlName || title}`,
        title,
        description: summary,
        publishedAt,
        time: publishedAt ? Date.parse(publishedAt) : null,
        url: noticeUrl(item),
        source: 'WHO Disease Outbreak News',
        noticeId: item.DonId || null,
        type: 'outbreak',
      };
    }).filter((item) => item.title && item.url && Number.isFinite(Date.parse(item.publishedAt || '')) && Date.parse(item.publishedAt) >= cutoff)
      .sort((left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt))
      .slice(0, 30);
    if (fallback) notices.fallback = true;
    return notices;
  }
}

export { cleanText as cleanOutbreakText };
