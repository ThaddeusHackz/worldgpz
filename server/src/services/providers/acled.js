import { BaseProvider } from './base.js';
import { fetchJson } from '../../lib/http.js';
import { safeNumber, validCoordinate } from '../../lib/http.js';

export class ACLEDProvider extends BaseProvider {
  constructor() {
    super('acled', { ttlMs: 60 * 60_000, requiredKeys: ['ACLED_EMAIL', 'ACLED_PASSWORD'], emptyValue: [] });
    this.token = null;
    this.tokenExpiry = 0;
  }

  async authenticate() {
    if (this.token && Date.now() < this.tokenExpiry) return this.token;
    const body = new URLSearchParams({
      username: this.secret('ACLED_EMAIL'), password: this.secret('ACLED_PASSWORD'),
      grant_type: 'password', client_id: 'acled', scope: 'authenticated',
    });
    const response = await fetch('https://acleddata.com/oauth/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body,
      signal: AbortSignal.timeout(Number(process.env.PROVIDER_TIMEOUT_MS) || 12_000),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.access_token) throw new Error(`ACLED authentication failed (HTTP ${response.status}). Confirm account/API access and credentials.`);
    this.token = data.access_token;
    this.tokenExpiry = Date.now() + Math.max(60, Number(data.expires_in || 3600) - 60) * 1000;
    return this.token;
  }

  async _fetchFresh() {
    const token = await this.authenticate();
    const end = new Date();
    const start = new Date(Date.now() - 7 * 86_400_000);
    const fmt = (date) => date.toISOString().slice(0, 10);
    const params = new URLSearchParams({
      _format: 'json', limit: '500', event_date: `${fmt(start)}|${fmt(end)}`,
      fields: 'event_id_cnty|event_date|event_type|sub_event_type|country|latitude|longitude|fatalities|notes|source',
    });
    const data = await fetchJson(`https://acleddata.com/api/acled/read?${params}`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
    if (data.status && Number(data.status) >= 400) throw new Error(`ACLED API returned status ${data.status}`);
    return (data.data || []).map((event) => {
      const latitude = safeNumber(event.latitude);
      const longitude = safeNumber(event.longitude);
      const fatalities = safeNumber(event.fatalities, 0);
      return {
        id: `acled-${event.event_id_cnty}`, type: 'conflict', severity: fatalities >= 10 ? 'critical' : fatalities > 0 ? 'high' : 'medium',
        title: `${event.event_type || 'Conflict event'} · ${event.country || 'Unknown country'}`,
        description: event.notes || event.sub_event_type || '', latitude, longitude,
        eventType: event.event_type, subEventType: event.sub_event_type, country: event.country,
        fatalities, date: event.event_date, publishedAt: event.event_date,
        source: event.source || 'ACLED', external_id: String(event.event_id_cnty),
      };
    }).filter((event) => validCoordinate(event.latitude, event.longitude));
  }
}
