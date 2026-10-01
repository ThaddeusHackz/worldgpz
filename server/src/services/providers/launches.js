import { BaseProvider } from './base.js';
import { fetchJson } from '../../lib/http.js';

const UPCOMING_LAUNCHES_URL = 'https://ll.thespacedevs.com/2.3.0/launches/upcoming/';

function firstInfoUrl(urls) {
  if (!Array.isArray(urls)) return null;
  const entry = urls.find((item) => typeof item === 'string' ? /^https:\/\//i.test(item) : /^https:\/\//i.test(item?.url || ''));
  return typeof entry === 'string' ? entry : entry?.url || null;
}

export class LaunchesProvider extends BaseProvider {
  constructor() { super('launches', { ttlMs: 30 * 60_000, requiredKeys: [], emptyValue: [] }); }
  get isConfigured() { return true; }

  async _fetchFresh() {
    const query = new URLSearchParams({ limit: '30', mode: 'list', hide_recent_previous: 'true' });
    const response = await fetchJson(`${UPCOMING_LAUNCHES_URL}?${query}`, { headers: { Accept: 'application/json' } });
    if (!Array.isArray(response.results)) throw new Error('Launch feed returned an unexpected response.');
    return response.results.map((launch) => ({
      id: String(launch.id || launch.slug || launch.name || ''),
      name: String(launch.name || launch.mission?.name || 'Scheduled launch').slice(0, 220),
      provider: launch.launch_service_provider?.name || 'Launch provider unavailable',
      vehicle: launch.rocket?.configuration?.full_name || launch.rocket?.configuration?.name || 'Vehicle unavailable',
      mission: launch.mission?.name || launch.mission?.description || 'Mission details unavailable',
      description: launch.mission?.description || '',
      net: launch.net || launch.window_start || null,
      windowStart: launch.window_start || null,
      windowEnd: launch.window_end || null,
      status: launch.status?.name || launch.status?.abbrev || 'TBD',
      pad: launch.pad?.name || 'Launch pad unavailable',
      location: launch.pad?.location?.name || 'Location unavailable',
      country: launch.pad?.location?.country?.name || null,
      probability: launch.probability === null || launch.probability === undefined || launch.probability === ''
        ? null : (Number.isFinite(Number(launch.probability)) ? Number(launch.probability) : null),
      webcastLive: Boolean(launch.webcast_live),
      image: launch.image?.image_url || launch.image || null,
      url: firstInfoUrl(launch.infoURLs || launch.info_urls),
      source: 'The Space Devs Launch Library 2',
    })).filter((launch) => launch.id && launch.net)
      .sort((left, right) => Date.parse(left.net) - Date.parse(right.net))
      .slice(0, 25);
  }
}
