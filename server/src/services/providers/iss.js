import { BaseProvider } from './base.js';
import { fetchJson, safeNumber } from '../../lib/http.js';

export class ISSProvider extends BaseProvider {
  constructor() { super('iss', { ttlMs: 5_000, emptyValue: null }); }
  async _fetchFresh() {
    const data = await fetchJson('https://api.wheretheiss.at/v1/satellites/25544', {}, 5_000);
    return {
      latitude: safeNumber(data.latitude), longitude: safeNumber(data.longitude),
      altitude: safeNumber(data.altitude), velocity: safeNumber(data.velocity),
      timestamp: safeNumber(data.timestamp, Math.floor(Date.now() / 1000)), source: 'Where The ISS At',
    };
  }
}
