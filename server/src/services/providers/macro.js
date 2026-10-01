import { BaseProvider } from './base.js';
import { fetchJson, safeNumber } from '../../lib/http.js';

export const FRED_SERIES = [
  { id: 'GDP', name: 'Gross domestic product', unit: 'Billions USD' },
  { id: 'UNRATE', name: 'Unemployment rate', unit: '%' },
  { id: 'CPIAUCSL', name: 'Consumer price index', unit: 'Index' },
  { id: 'FEDFUNDS', name: 'Federal funds rate', unit: '%' },
  { id: 'DGS10', name: '10-year Treasury yield', unit: '%' },
  { id: 'VIXCLS', name: 'VIX volatility index', unit: 'Index' },
  { id: 'DCOILWTICO', name: 'WTI crude oil', unit: 'USD / barrel' },
  { id: 'PAYEMS', name: 'Nonfarm payrolls', unit: 'Thousands' },
];

export class MacroProvider extends BaseProvider {
  constructor() { super('macro', { ttlMs: 60 * 60_000, requiredKeys: ['FRED_API_KEY'], emptyValue: [] }); }
  async _fetchFresh() {
    const key = this.secret('FRED_API_KEY');
    const results = await Promise.allSettled(FRED_SERIES.map(async (series) => {
      const params = new URLSearchParams({ series_id: series.id, api_key: key, file_type: 'json', sort_order: 'desc', limit: '2' });
      const response = await fetchJson(`https://api.stlouisfed.org/fred/series/observations?${params}`);
      const observation = (response.observations || []).find((item) => item.value !== '.' && safeNumber(item.value) !== null);
      if (!observation) return null;
      return { type: 'economic', series: series.id, name: series.name, value: safeNumber(observation.value), unit: series.unit, date: observation.date, source: 'FRED' };
    }));
    const data = results.filter((item) => item.status === 'fulfilled' && item.value).map((item) => item.value);
    if (!data.length) throw new Error('FRED returned no observations for the requested indicators');
    if (data.length < FRED_SERIES.length) data.partial = true;
    return data;
  }
}
