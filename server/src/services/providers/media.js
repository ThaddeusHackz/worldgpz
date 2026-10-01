import { BaseProvider } from './base.js';
import { fetchJson, safeNumber } from '../../lib/http.js';

export const WEBCAM_REGIONS = [
  { id: 'middle-east', query: 'live Jerusalem news webcam', label: 'Middle East' },
  { id: 'europe', query: 'live Europe news stream webcam', label: 'Europe' },
  { id: 'americas', query: 'live New York city webcam news', label: 'Americas' },
  { id: 'asia', query: 'live Tokyo Singapore news webcam', label: 'Asia' },
  { id: 'space', query: 'NASA live space station stream', label: 'Space' },
];

export class YouTubeProvider extends BaseProvider {
  constructor() { super('youtube', { ttlMs: Math.max(60, Number(process.env.YOUTUBE_CACHE_SECONDS) || 10_800) * 1000, requiredKeys: ['YOUTUBE_API_KEY'], emptyValue: [] }); }
  async _fetchFresh() {
    const key = this.secret('YOUTUBE_API_KEY');
    const batches = await Promise.allSettled(WEBCAM_REGIONS.map(async (region) => {
      const params = new URLSearchParams({
        part: 'snippet', eventType: 'live', type: 'video', q: region.query,
        maxResults: '5', order: 'viewCount', key,
      });
      const result = await fetchJson(`https://www.googleapis.com/youtube/v3/search?${params}`);
      return (result.items || []).map((item) => ({
        videoId: item.id?.videoId, title: item.snippet?.title || 'Live stream',
        channel: item.snippet?.channelTitle || 'YouTube channel', region: region.id,
        regionLabel: region.label,
        thumbnail: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.high?.url || null,
        live: item.snippet?.liveBroadcastContent === 'live',
        publishedAt: item.snippet?.publishedAt || null,
      })).filter((item) => item.videoId);
    }));
    const feeds = batches.filter((batch) => batch.status === 'fulfilled').flatMap((batch) => batch.value);
    const unique = [...new Map(feeds.map((feed) => [feed.videoId, feed])).values()];
    if (batches.some((batch) => batch.status === 'rejected')) unique.partial = true;
    if (!unique.length) {
      const rejected = batches.find((batch) => batch.status === 'rejected');
      throw new Error(rejected?.reason?.message || 'YouTube returned no live streams.');
    }
    return unique;
  }
}

export class WindyProvider extends BaseProvider {
  constructor() { super('windy', { ttlMs: 60 * 60_000, requiredKeys: ['WINDY_API_KEY'], emptyValue: [] }); }
  async _fetchFresh() {
    const params = new URLSearchParams({ limit: '30', offset: '0', bbox: '-180,-80,180,80' });
    const json = await fetchJson(`https://api.windy.com/webcams/api/v3/webcams?${params}`, {
      headers: { 'x-windy-api-key': this.secret('WINDY_API_KEY'), Accept: 'application/json' },
    });
    const rows = json.webcams || json.result?.webcams || [];
    return rows.map((cam) => ({
      id: String(cam.webcamId || cam.id || ''), title: cam.title || 'Webcam',
      latitude: safeNumber(cam.location?.latitude), longitude: safeNumber(cam.location?.longitude),
      thumbnail: cam.images?.current?.preview || cam.images?.current?.icon || null,
      status: cam.status || 'unknown', source: 'Windy',
    })).filter((cam) => cam.id);
  }
}
