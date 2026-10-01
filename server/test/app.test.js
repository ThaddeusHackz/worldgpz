import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../src/app.js';
import { PulseEngine } from '../src/services/pulse.js';

class MockProvider {
  constructor(name, data = []) { this.name = name; this.data = data; this.status = 'online'; this.lastSuccess = Date.now(); this.latencyMs = 2; this.lastError = null; this.isConfigured = true; }
  async fetch() { return { data: this.data, configured: true, cached: false }; }
  async fetchWatchlist() { return { data: [], configured: false, error: 'FINNHUB_API_KEY is not configured.' }; }
  getHealth() { return { name: this.name, status: this.status, configured: this.isConfigured, latencyMs: this.latencyMs, lastSuccess: new Date(this.lastSuccess).toISOString(), lastError: null, cached: true, dataPoints: Array.isArray(this.data) ? this.data.length : 1 }; }
  invalidate() {}
}

function mockRegistry() {
  const providers = new Map();
  for (const name of ['usgs', 'eonet', 'gdelt', 'swpc', 'reliefweb', 'weather', 'news', 'acled', 'flights', 'ships', 'firms', 'markets', 'energy', 'macro', 'windy', 'youtube', 'openai', 'iss', 'outbreaks', 'predictions', 'launches']) providers.set(name, new MockProvider(name, []));
  providers.set('usgs', new MockProvider('usgs', [{ id: 'eq-1', type: 'seismic', severity: 'high', title: 'M5.1 test event', latitude: 20, longitude: 30, magnitude: 5.1, source: 'USGS', time: Date.now() }]));
  providers.set('news', new MockProvider('news', [{ id: 'news-1', type: 'news', title: 'Test headline', region: 'GLOBAL', source: 'Test feed', publishedAt: new Date().toISOString() }]));
  const registry = {
    get: (name) => providers.get(name),
    getAll: () => [...providers.values()],
    getData: (name) => providers.get(name)?.data ?? null,
    getHealthReport: () => [...providers.values()].map((provider) => provider.getHealth()),
    refreshAll: async () => Object.fromEntries([...providers].map(([name]) => [name, { status: 'online', latencyMs: 1, dataPoints: 0 }])),
    stop: () => {},
  };
  return registry;
}

async function withServer(t, app) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

test('health API returns operational status and the provider mesh', async (t) => {
  const registry = mockRegistry();
  const app = createApp({ registry, store: { persistent: false, initialized: false }, vault: {}, pulse: { addClient() {} }, startedAt: Date.now() });
  const base = await withServer(t, app);
  const response = await fetch(`${base}/api/health`);
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.status, 'ok');
  assert.equal(data.providers.length, 21);
  assert.equal(data.author, 'ThaddeusTechz');
});

test('events API combines provider records and labels static context points', async (t) => {
  const registry = mockRegistry();
  const app = createApp({ registry, store: { persistent: false }, vault: {}, pulse: { addClient() {} }, startedAt: Date.now() });
  const base = await withServer(t, app);
  const response = await fetch(`${base}/api/events?type=seismic`);
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.events.length, 1);
  assert.equal(payload.events[0].type, 'seismic');
});

test('news headline alias and situational snapshot expose the documented dashboard feeds', async (t) => {
  const registry = mockRegistry();
  const app = createApp({ registry, store: { persistent: false }, vault: {}, pulse: { addClient() {} }, startedAt: Date.now() });
  const base = await withServer(t, app);
  const headlines = await fetch(`${base}/api/news/headlines`);
  assert.equal(headlines.status, 200);
  assert.equal((await headlines.json()).articles[0].title, 'Test headline');
  const situational = await fetch(`${base}/api/situational`);
  const snapshot = await situational.json();
  assert.equal(situational.status, 200);
  assert.equal(snapshot.countries.length, 31);
  assert.equal(snapshot.chokepoints.length, 13);
  assert.match(snapshot.strategicRisk.note, /not an official/);
});

test('new public outbreak and prediction endpoints return provider states', async (t) => {
  const registry = mockRegistry();
  const app = createApp({ registry, store: { persistent: false }, vault: {}, pulse: { addClient() {} }, startedAt: Date.now() });
  const base = await withServer(t, app);
  const outbreaks = await fetch(`${base}/api/outbreaks`);
  const outbreakPayload = await outbreaks.json();
  assert.equal(outbreaks.status, 200);
  assert.deepEqual(outbreakPayload.outbreaks, []);
  assert.equal(outbreakPayload.provider, 'outbreaks');
  const predictions = await fetch(`${base}/api/predictions`);
  const predictionPayload = await predictions.json();
  assert.equal(predictions.status, 200);
  assert.deepEqual(predictionPayload.markets, []);
  assert.equal(predictionPayload.provider, 'predictions');
  const launches = await fetch(`${base}/api/launches`);
  const launchPayload = await launches.json();
  assert.equal(launches.status, 200);
  assert.deepEqual(launchPayload.launches, []);
  assert.equal(launchPayload.provider, 'launches');
});

test('market watchlist API is same-origin, bounded and reports missing provider keys', async (t) => {
  const registry = mockRegistry();
  const app = createApp({ registry, store: { persistent: false }, vault: {}, pulse: { addClient() {} }, startedAt: Date.now() });
  const base = await withServer(t, app);
  const empty = await fetch(`${base}/api/markets/watchlist`);
  assert.equal(empty.status, 400);
  const response = await fetch(`${base}/api/markets/watchlist?symbols=AAPL%2CBINANCE%3ABTCUSDT`);
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.status, 'unconfigured');
  assert.deepEqual(payload.quotes, []);
});

test('OpenAI analyst endpoint validates questions and rejects unconfigured keys', async (t) => {
  const registry = mockRegistry();
  const app = createApp({ registry, store: { persistent: false }, vault: {}, pulse: { addClient() {} }, startedAt: Date.now() });
  const base = await withServer(t, app);
  const invalid = await fetch(`${base}/api/intel/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question: 'no' }) });
  assert.equal(invalid.status, 400);
  const unavailable = await fetch(`${base}/api/intel/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question: 'What changed in the latest reports?' }) });
  assert.equal(unavailable.status, 503);
  assert.match((await unavailable.json()).error, /OPENAI_API_KEY/);
  const countryBrief = await fetch(`${base}/api/intel/country-brief`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ country: 'Ukraine' }) });
  assert.equal(countryBrief.status, 503);
  assert.match((await countryBrief.json()).error, /OPENAI_API_KEY/);
});

test('OpenAI country briefs use the server analyst and only linked records for supported countries', async (t) => {
  const registry = mockRegistry();
  const openai = registry.get('openai');
  let suppliedEvidence = null;
  openai.isOpenAIConfigured = true;
  openai.askQuestion = async (_question, evidence) => {
    suppliedEvidence = evidence;
    return { answer: 'A source-linked test brief.', model: 'test-model', sources: evidence };
  };
  registry.get('news').data = [
    { title: 'Ukraine development', country: 'Ukraine', source: 'Test source', url: 'https://example.test/ukraine' },
    { title: 'Unrelated event', country: 'Elsewhere', source: 'Test source', url: 'https://example.test/elsewhere' },
  ];
  const app = createApp({ registry, store: { persistent: false }, vault: {}, pulse: { addClient() {} }, startedAt: Date.now() });
  const base = await withServer(t, app);
  const invalid = await fetch(`${base}/api/intel/country-brief`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ country: 'U' }) });
  assert.equal(invalid.status, 400);
  const response = await fetch(`${base}/api/intel/country-brief`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ country: 'Ukraine' }) });
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.country, 'Ukraine');
  assert.equal(payload.heuristicIndex.basis.includes('not an official'), true);
  assert.equal(payload.signalCounts.linkedSources, 1);
  assert.deepEqual(suppliedEvidence.map((item) => item.url), ['https://example.test/ukraine']);
});

test('read-only MCP endpoint negotiates, lists safe tools and executes bounded calls', async (t) => {
  const registry = mockRegistry();
  const app = createApp({ registry, store: { persistent: false }, vault: {}, pulse: { addClient() {} }, startedAt: Date.now() });
  const base = await withServer(t, app);
  const initialize = await fetch(`${base}/api/mcp`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'test-client', version: '1' } } }) });
  const initPayload = await initialize.json();
  assert.equal(initialize.status, 200);
  assert.equal(initialize.headers.get('mcp-protocol-version'), '2025-03-26');
  assert.equal(initPayload.result.serverInfo.name, 'worldgpz');
  assert.equal(initPayload.result.capabilities.tools.listChanged, false);
  const notification = await fetch(`${base}/api/mcp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) });
  assert.equal(notification.status, 202);
  const listed = await fetch(`${base}/api/mcp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 'tools', method: 'tools/list' }) });
  const tools = (await listed.json()).result.tools;
  assert.ok(tools.length >= 7);
  assert.ok(tools.every((tool) => tool.annotations.readOnlyHint === true && tool.annotations.destructiveHint === false));
  const call = await fetch(`${base}/api/mcp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'get_latest_events', arguments: { limit: 1 } } }) });
  const callPayload = await call.json();
  assert.equal(callPayload.result.isError, false);
  assert.ok(callPayload.result.structuredContent.events.length <= 1);
  const get = await fetch(`${base}/api/mcp`);
  assert.equal(get.status, 405);
});

test('protected admin routes reject unauthenticated requests', async (t) => {
  const registry = mockRegistry();
  const app = createApp({ registry, store: { persistent: false }, vault: {}, pulse: { addClient() {} }, startedAt: Date.now() });
  const base = await withServer(t, app);
  const response = await fetch(`${base}/api/admin`);
  assert.equal(response.status, 401);
  const logs = await fetch(`${base}/api/admin/logs`);
  assert.equal(logs.status, 401);
});

test('malformed session cookies fail closed without crashing the auth status endpoint', async (t) => {
  const registry = mockRegistry();
  const app = createApp({ registry, store: { persistent: false }, vault: {}, pulse: { addClient() {} }, startedAt: Date.now() });
  const base = await withServer(t, app);
  const response = await fetch(`${base}/api/auth/me`, { headers: { Cookie: 'worldgpz_session=%E0%A4%A' } });
  assert.equal(response.status, 401);
  assert.match((await response.json()).error, /not signed in/i);
});

test('admin login fails closed when deployment authentication is not configured', async (t) => {
  const old = { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD, hash: process.env.ADMIN_PASSWORD_HASH, jwt: process.env.JWT_SECRET };
  delete process.env.ADMIN_EMAIL; delete process.env.ADMIN_PASSWORD; delete process.env.ADMIN_PASSWORD_HASH; delete process.env.JWT_SECRET;
  t.after(() => {
    for (const [key, value] of [['ADMIN_EMAIL', old.email], ['ADMIN_PASSWORD', old.password], ['ADMIN_PASSWORD_HASH', old.hash], ['JWT_SECRET', old.jwt]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  const registry = mockRegistry();
  const app = createApp({ registry, store: { persistent: false }, vault: {}, pulse: { addClient() {} }, startedAt: Date.now() });
  const base = await withServer(t, app);
  const response = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'admin@example.test', password: 'not-a-real-password' }) });
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /not configured/i);
});

test('SSE stream announces a new connection and sends provider health', async (t) => {
  const registry = mockRegistry();
  const pulse = new PulseEngine(registry, { intervalMs: 60_000, heartbeatMs: 60_000 });
  const app = createApp({ registry, store: { persistent: false }, vault: {}, pulse, startedAt: Date.now() });
  const base = await withServer(t, app);
  const controller = new AbortController();
  t.after(() => { controller.abort(); pulse.stop(); });
  const response = await fetch(`${base}/api/stream`, { signal: controller.signal });
  assert.ok(response.headers.get('content-type')?.startsWith('text/event-stream'));
  const reader = response.body.getReader();
  const chunk = await reader.read();
  const text = new TextDecoder().decode(chunk.value);
  assert.match(text, /event: connected/);
  assert.match(text, /event: health/);
  controller.abort();
});
