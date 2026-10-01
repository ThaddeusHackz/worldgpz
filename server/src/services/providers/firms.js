import { BaseProvider } from './base.js';
import { fetchText, safeNumber, validCoordinate } from '../../lib/http.js';

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"' && quoted && text[index + 1] === '"') { cell += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(cell); cell = '';
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
    } else cell += char;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  if (rows.length < 2) return [];
  const headers = rows.shift().map((header) => header.trim());
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() || ''])));
}

export class FIRMSProvider extends BaseProvider {
  constructor() { super('firms', { ttlMs: 6 * 60 * 60_000, requiredKeys: ['NASA_FIRMS_API_KEY'], emptyValue: [] }); }
  async _fetchFresh() {
    const apiKey = this.secret('NASA_FIRMS_API_KEY');
    const sources = String(process.env.FIRMS_SOURCES || 'VIIRS_SNPP_NRT').split(',').map((item) => item.trim()).filter(Boolean).slice(0, 2);
    const days = Math.min(10, Math.max(1, Number(process.env.FIRMS_DAYS) || 1));
    const all = [];
    for (const source of sources) {
      const area = encodeURIComponent(process.env.FIRMS_AREA || 'world');
      const csv = await fetchText(`https://firms.modaps.eosdis.nasa.gov/api/area/csv/${encodeURIComponent(apiKey)}/${encodeURIComponent(source)}/${area}/${days}`, {}, 20_000);
      const records = parseCsv(csv);
      for (const record of records) {
        const latitude = safeNumber(record.latitude);
        const longitude = safeNumber(record.longitude);
        if (!validCoordinate(latitude, longitude)) continue;
        all.push({
          id: `firms-${source}-${record.latitude}-${record.longitude}-${record.acq_date}-${record.acq_time}`,
          type: 'fire', severity: record.confidence === 'h' || record.confidence === 'high' ? 'high' : 'medium',
          title: 'Satellite thermal anomaly', latitude, longitude,
          brightness: safeNumber(record.bright_ti4 ?? record.brightness), confidence: record.confidence || 'n/a',
          frp: safeNumber(record.frp, 0), satellite: record.satellite || source, daynight: record.daynight,
          date: record.acq_date, time: record.acq_time, source: 'NASA FIRMS', external_id: `${source}-${record.latitude}-${record.longitude}-${record.acq_date}-${record.acq_time}`,
        });
      }
    }
    if (all.length <= 700) return all;
    const stride = Math.ceil(all.length / 700);
    return all.filter((_, index) => index % stride === 0).slice(0, 700);
  }
}
