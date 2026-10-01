import { BaseProvider } from './base.js';
import { fetchJson, safeNumber, validCoordinate } from '../../lib/http.js';

const USGS_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson';

function seismicSeverity(magnitude) {
  if (magnitude >= 7) return 'critical';
  if (magnitude >= 6) return 'high';
  if (magnitude >= 5) return 'medium';
  return 'low';
}

export class USGSProvider extends BaseProvider {
  constructor() { super('usgs', { ttlMs: 5 * 60_000, emptyValue: [] }); }
  async _fetchFresh() {
    const json = await fetchJson(USGS_URL);
    return (json.features || []).map((feature) => {
      const [longitude, latitude, depth] = feature.geometry?.coordinates || [];
      const properties = feature.properties || {};
      const magnitude = safeNumber(properties.mag, 0);
      return {
        id: `usgs-${feature.id}`, type: 'seismic', severity: seismicSeverity(magnitude),
        title: `M${magnitude.toFixed(1)} · ${properties.place || 'Earthquake'}`,
        description: `Depth ${safeNumber(depth, 0).toFixed(1)} km${properties.tsunami ? ' · tsunami alert flag' : ''}`,
        latitude, longitude, magnitude, place: properties.place || 'Unknown location',
        depth: safeNumber(depth, 0), tsunami: Boolean(properties.tsunami),
        time: properties.time, publishedAt: properties.time ? new Date(properties.time).toISOString() : null,
        url: properties.url, source: 'USGS', external_id: String(feature.id),
      };
    }).filter((event) => validCoordinate(event.latitude, event.longitude));
  }
}

export class EONETProvider extends BaseProvider {
  constructor() { super('eonet', { ttlMs: 10 * 60_000, emptyValue: [] }); }
  async _fetchFresh() {
    const json = await fetchJson('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=100');
    const events = [];
    for (const event of json.events || []) {
      const geometry = event.geometry || [];
      const point = [...geometry].reverse().find((item) => item.type === 'Point' && Array.isArray(item.coordinates));
      const [longitude, latitude] = point?.coordinates || [];
      const category = event.categories?.[0]?.title || 'Natural event';
      const title = event.title || category;
      events.push({
        id: `eonet-${event.id}`, type: 'natural', severity: /volcano|wildfire|storm/i.test(category) ? 'medium' : 'low',
        title, description: category, latitude, longitude, category,
        time: point?.date ? Date.parse(point.date) : Date.now(), publishedAt: point?.date || null,
        source: 'NASA EONET', external_id: String(event.id), url: event.sources?.[0]?.url || null,
        metadata: { categories: event.categories || [], closed: event.closed || null },
      });
    }
    return events.filter((event) => validCoordinate(event.latitude, event.longitude));
  }
}

export async function fetchGdeltArticles() {
  const query = encodeURIComponent('(conflict OR crisis OR earthquake OR wildfire OR sanctions OR diplomacy)');
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${query}&mode=ArtList&format=json&maxrecords=60&sort=DateDesc&sourcelang=english`;
  const json = await fetchJson(url);
  return (json.articles || []).map((article, index) => {
    const title = article.title || 'Untitled report';
    const lowered = title.toLowerCase();
    const severity = /mass casualty|declares war|missile strike|major earthquake|killed [5-9][0-9]/.test(lowered) ? 'critical'
      : /attack|clash|airstrike|war|killed|explosion|evacuat/.test(lowered) ? 'high'
        : /conflict|crisis|earthquake|fire|storm|sanction/.test(lowered) ? 'medium' : 'low';
    let publishedAt = article.seendate || null;
    if (typeof publishedAt === 'string' && /^\d{14}$/.test(publishedAt)) {
      publishedAt = `${publishedAt.slice(0, 4)}-${publishedAt.slice(4, 6)}-${publishedAt.slice(6, 8)}T${publishedAt.slice(8, 10)}:${publishedAt.slice(10, 12)}:${publishedAt.slice(12, 14)}Z`;
    }
    return {
      id: `gdelt-${article.url || index}`, type: 'news', severity, title,
      description: article.domain || 'Global news index', source: `GDELT · ${article.domain || 'publisher'}`,
      domain: article.domain || null, url: article.url || null, publishedAt,
      time: publishedAt ? Date.parse(publishedAt) : Date.now(), external_id: article.url || `gdelt-${index}`,
      latitude: safeNumber(article.lat), longitude: safeNumber(article.lon),
    };
  });
}

export class GDELTProvider extends BaseProvider {
  constructor() { super('gdelt', { ttlMs: 10 * 60_000, emptyValue: [] }); }
  async _fetchFresh() { return fetchGdeltArticles(); }
}

export class SWPCProvider extends BaseProvider {
  constructor() { super('swpc', { ttlMs: 5 * 60_000, emptyValue: { currentKp: null, series: [], alerts: [] } }); }
  async _fetchFresh() {
    const [kpResult, forecastResult] = await Promise.allSettled([
      fetchJson('https://services.swpc.noaa.gov/json/planetary_k_index_1m.json'),
      fetchJson('https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json'),
    ]);
    if (kpResult.status !== 'fulfilled' && forecastResult.status !== 'fulfilled') throw new Error('NOAA space-weather feeds are unavailable');
    const rows = kpResult.status === 'fulfilled' && Array.isArray(kpResult.value) ? kpResult.value : [];
    const series = rows.slice(-120).map((row) => ({
      timestamp: row.time_tag || row[0] || null,
      kp: safeNumber(row.estimated_kp ?? row.kp ?? row[1]),
    })).filter((row) => row.kp !== null);
    const currentKp = series.at(-1)?.kp ?? null;
    const alerts = [];
    if (currentKp >= 5) alerts.push({ level: currentKp >= 7 ? 'high' : 'medium', message: `Geomagnetic activity elevated (Kp ${currentKp}).` });
    const forecast = forecastResult.status === 'fulfilled' ? forecastResult.value : [];
    return { currentKp, series, forecast, alerts, updatedAt: new Date().toISOString() };
  }
}

export class ReliefWebProvider extends BaseProvider {
  constructor() { super('reliefweb', { ttlMs: 15 * 60_000, emptyValue: [] }); }
  async _fetchFresh() {
    const url = 'https://api.reliefweb.int/v1/disasters?appname=worldgpz&limit=30&sort[]=date:desc&fields[include][]=name&fields[include][]=country&fields[include][]=type&fields[include][]=date&fields[include][]=url';
    const json = await fetchJson(url, { headers: { Accept: 'application/json' } });
    return (json.data || []).map((item) => {
      const fields = item.fields || {};
      const country = fields.country?.[0] || {};
      const coords = country.location || {};
      return {
        id: `reliefweb-${item.id}`, type: 'humanitarian', severity: 'medium', title: fields.name || 'Humanitarian situation',
        description: fields.type?.[0]?.name || 'Reported humanitarian disaster', source: 'ReliefWeb',
        external_id: String(item.id), url: fields.url || null, country: country.name || null,
        latitude: safeNumber(coords.lat), longitude: safeNumber(coords.lon), publishedAt: fields.date?.created || null,
        time: fields.date?.created ? Date.parse(fields.date.created) : Date.now(),
      };
    });
  }
}
