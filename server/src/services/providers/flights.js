import { BaseProvider } from './base.js';
import { fetchJson, safeNumber, validCoordinate } from '../../lib/http.js';

const TOKEN_URL = 'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';
const MILITARY_CALLSIGN = /^(RCH|REACH|RFF|SHF|CNV|JAKE|DUKE|EVAC|ASCOT|RRR|IAM|GAF|FAF|KAF|SVA|IAF|PLF|CFC|NATO|FORTE|LAGR)/i;

function parseBbox(raw) {
  const values = String(raw || '-10,-30,70,60').split(',').map(Number);
  if (values.length !== 4 || values.some((value) => !Number.isFinite(value))) return [-10, -30, 70, 60];
  return values;
}

export class FlightsProvider extends BaseProvider {
  constructor() { super('flights', { ttlMs: 30_000, requiredKeys: ['OPENSKY_CLIENT_ID', 'OPENSKY_CLIENT_SECRET'], emptyValue: [] }); this.token = null; this.tokenExpiry = 0; }

  async authenticate() {
    if (this.token && Date.now() < this.tokenExpiry) return this.token;
    const body = new URLSearchParams({ grant_type: 'client_credentials', client_id: this.secret('OPENSKY_CLIENT_ID'), client_secret: this.secret('OPENSKY_CLIENT_SECRET') });
    const response = await fetch(TOKEN_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body,
      signal: AbortSignal.timeout(Number(process.env.PROVIDER_TIMEOUT_MS) || 12_000),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.access_token) throw new Error(`OpenSky OAuth failed (HTTP ${response.status}).`);
    this.token = data.access_token;
    this.tokenExpiry = Date.now() + Math.max(30, Number(data.expires_in || 300) - 30) * 1000;
    return this.token;
  }

  async _fetchFresh() {
    const token = await this.authenticate();
    const [lamin, lomin, lamax, lomax] = parseBbox(process.env.OPENSKY_BBOX);
    const params = new URLSearchParams({ lamin: String(lamin), lomin: String(lomin), lamax: String(lamax), lomax: String(lomax) });
    const response = await fetchJson(`https://opensky-network.org/api/states/all?${params}`, { headers: { Authorization: `Bearer ${token}` } });
    return (response.states || []).map((state) => {
      const callsign = String(state[1] || '').trim();
      const latitude = safeNumber(state[6]);
      const longitude = safeNumber(state[5]);
      return {
        id: `opensky-${state[0]}`, type: 'flight', icao24: state[0], callsign: callsign || 'Unknown', origin: state[2] || 'Unknown',
        longitude, latitude, altitude: safeNumber(state[7]), onGround: Boolean(state[8]), velocity: safeNumber(state[9]),
        heading: safeNumber(state[10]), verticalRate: safeNumber(state[11]), lastContact: safeNumber(state[4]),
        military: MILITARY_CALLSIGN.test(callsign), source: 'OpenSky',
      };
    }).filter((flight) => validCoordinate(flight.latitude, flight.longitude)).slice(0, 1_000);
  }
}
