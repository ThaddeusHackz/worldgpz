import { BaseProvider } from './base.js';
import { fetchJson, safeNumber } from '../../lib/http.js';

function eiaUrl(path, key, facets = {}) {
  const params = new URLSearchParams({ 'api_key': key, frequency: 'daily', 'data[0]': 'value', 'sort[0][column]': 'period', 'sort[0][direction]': 'desc', length: '20' });
  for (const [facet, values] of Object.entries(facets)) for (const value of values) params.append(`facets[${facet}][]`, value);
  return `https://api.eia.gov/v2/${path}?${params}`;
}

export class EnergyProvider extends BaseProvider {
  constructor() { super('energy', { ttlMs: 60 * 60_000, requiredKeys: ['EIA_API_KEY'], emptyValue: [] }); }
  async _fetchFresh() {
    const key = this.secret('EIA_API_KEY');
    const oilUrl = eiaUrl('petroleum/pri/spt/data/', key, { product: ['EPCWTI', 'EPCBRENT'], duoarea: ['RGC'] });
    const gasUrl = eiaUrl('natural-gas/pri/fut/data/', key);
    const [oilResult, gasResult] = await Promise.allSettled([fetchJson(oilUrl), fetchJson(gasUrl)]);
    const output = [];
    const readRows = (result, label, unit) => {
      if (result.status !== 'fulfilled') return;
      for (const row of result.value.response?.data || []) {
        const value = safeNumber(row.value);
        if (value === null) continue;
        const product = String(row.product || row['product-name'] || '');
        output.push({
          type: 'energy', series: row.series || product || label, name: /brent/i.test(product) ? 'Brent crude' : /wti/i.test(product) ? 'WTI crude' : label,
          value, unit: row['unit-name'] || row.units || unit, date: row.period || null, source: 'U.S. EIA',
        });
      }
    };
    readRows(oilResult, 'Crude oil spot', 'USD / barrel');
    readRows(gasResult, 'Natural gas futures', 'USD / MMBtu');
    if (!output.length) {
      const rejected = [oilResult, gasResult].find((result) => result.status === 'rejected');
      throw new Error(rejected?.reason?.message || 'EIA returned no data for the requested series');
    }
    const latestByName = new Map();
    for (const item of output) if (!latestByName.has(item.name)) latestByName.set(item.name, item);
    return [...latestByName.values()];
  }
}
