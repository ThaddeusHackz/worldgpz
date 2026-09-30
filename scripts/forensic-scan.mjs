#!/usr/bin/env node
const baseUrl = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '');
const endpoints = [
  ['/api/health', 'System health'], ['/api/providers/health', 'Provider health'], ['/api/events', 'Geospatial events'],
  ['/api/events/seismic', 'Seismic feed'], ['/api/events/natural', 'Natural events'], ['/api/events/conflicts', 'Conflict feed'],
  ['/api/events/fires', 'Fire detections'], ['/api/weather', 'Global weather'], ['/api/news', 'News wire'],
  ['/api/markets', 'Market quotes'], ['/api/energy', 'Energy indicators'], ['/api/economics', 'Economic series'],
  ['/api/flights', 'Aircraft positions'], ['/api/ships', 'Vessel positions'], ['/api/iss', 'ISS position'],
  ['/api/media/webcams', 'Live webcams'], ['/api/intel/briefing', 'AI briefing'],
  ['/api/situational/countries', 'Country risk estimates'], ['/api/situational/chokepoints', 'Trade routes'],
];

async function scan([path, name]) {
  const start = Date.now();
  try {
    const response = await fetch(`${baseUrl}${path}`, { signal: AbortSignal.timeout(25_000) });
    const body = await response.json().catch(() => ({}));
    const data = Array.isArray(body) ? body : body.events || body.articles || body.providers || body.webcams || body.data || body;
    const count = Array.isArray(data) ? data.length : data && typeof data === 'object' ? 1 : 0;
    return { name, status: response.ok ? 'OK' : `HTTP ${response.status}`, latency: Date.now() - start, count };
  } catch (error) { return { name, status: 'ERROR', latency: Date.now() - start, count: 0, error: error.message }; }
}

console.log(`WORLDGPZ FORENSIC HEALTH SCAN · by ThaddeusTechz\nTarget: ${baseUrl}\n`);
const results = await Promise.all(endpoints.map(scan));
for (const result of results) console.log(`${result.status.padEnd(9)} ${result.name.padEnd(25)} ${String(result.latency).padStart(5)}ms  ${result.count} records${result.error ? ` · ${result.error}` : ''}`);
const passed = results.filter((result) => result.status === 'OK').length;
console.log(`\n${passed}/${results.length} endpoints returned HTTP 2xx. Provider records depend on configuration and upstream availability.`);
process.exitCode = passed >= results.length * 0.7 ? 0 : 1;
