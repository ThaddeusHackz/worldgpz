import test from 'node:test';
import assert from 'node:assert/strict';
import { BaseProvider } from '../src/services/providers/base.js';
import { ProviderRegistry } from '../src/services/providers/registry.js';
import { NewsProvider } from '../src/services/providers/news.js';
import { WeatherProvider } from '../src/services/providers/weather.js';
import { AIProvider } from '../src/services/providers/ai.js';
import { OutbreaksProvider } from '../src/services/providers/outbreaks.js';
import { PredictionsProvider } from '../src/services/providers/predictions.js';
import { LaunchesProvider } from '../src/services/providers/launches.js';
import { MarketsProvider } from '../src/services/providers/markets.js';
import { FlightsProvider } from '../src/services/providers/flights.js';
import { YouTubeProvider } from '../src/services/providers/media.js';
import { API_KEY_DEFINITIONS } from '../src/services/keyRegistry.js';
import { buildChokepoints, buildCountries, buildStrategicRisk } from '../src/services/situational.js';
import { decryptSecret, encryptSecret, maskSecret } from '../src/lib/vaultCrypto.js';

class ExampleProvider extends BaseProvider {
  constructor() { super('example', { ttlMs: 50, requiredKeys: ['EXAMPLE_KEY'], emptyValue: [] }); this.calls = 0; this.fail = false; }
  async _fetchFresh() { this.calls += 1; if (this.fail) throw new Error('temporary outage'); return [{ value: this.calls }]; }
}

test('provider registry has the complete 21-source dashboard mesh', () => {
  const registry = ProviderRegistry.createDefault({ secretResolver: () => undefined });
  assert.equal(registry.getAll().length, 21);
  assert.equal(registry.getHealthReport().length, 21);
  for (const name of ['usgs', 'eonet', 'gdelt', 'swpc', 'reliefweb', 'weather', 'news', 'acled', 'flights', 'ships', 'firms', 'markets', 'energy', 'macro', 'windy', 'youtube', 'openai', 'iss', 'outbreaks', 'predictions', 'launches']) {
    assert.ok(registry.get(name), `${name} provider should be registered`);
  }
  registry.stop();
});

test('provider cache deduplicates successful calls and serves fresh snapshots', async () => {
  const provider = new ExampleProvider();
  provider.setSecretResolver((key) => key === 'EXAMPLE_KEY' ? 'test-value' : undefined);
  const first = await provider.fetch();
  const cached = await provider.fetch();
  assert.deepEqual(first.data, [{ value: 1 }]);
  assert.equal(cached.cached, true);
  assert.equal(provider.calls, 1);
  assert.equal(provider.status, 'online');
});

test('provider degrades to stale cache after an upstream failure', async () => {
  const provider = new ExampleProvider();
  provider.setSecretResolver(() => 'test-value');
  const first = await provider.fetch();
  provider.fail = true;
  const stale = await provider.fetch({ force: true });
  assert.deepEqual(stale.data, first.data);
  assert.equal(stale.stale, true);
  assert.equal(provider.status, 'degraded');
  assert.match(provider.lastError, /temporary outage/);
});

test('NewsAPI failures fall back to GDELT with an explicit degraded status', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes('newsapi.org')) return new Response('{"status":"error"}', { status: 503 });
    if (url.includes('gdeltproject.org')) return new Response(JSON.stringify({ articles: [{
      title: 'Regional diplomacy update', url: 'https://example.test/story', domain: 'example.test',
      seendate: '20260930120000', lat: '10', lon: '20',
    }] }), { status: 200, headers: { 'content-type': 'application/json' } });
    throw new Error(`Unexpected test URL: ${url}`);
  };
  try {
    const provider = new NewsProvider();
    provider.setSecretResolver(() => 'test-newsapi-key');
    const result = await provider.fetch({ force: true });
    assert.equal(result.data.length, 1);
    assert.equal(result.data.fallback, true);
    assert.equal(provider.status, 'degraded');
    assert.equal(result.data[0].source, 'GDELT · example.test');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('weather provider retains baseline coverage when the configured primary feed fails', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes('openweathermap.org')) return new Response('unavailable', { status: 503 });
    if (url.includes('open-meteo.com')) return new Response(JSON.stringify(Array.from({ length: 8 }, (_, index) => ({
      current: { temperature_2m: 20 + index, relative_humidity_2m: 50, apparent_temperature: 19 + index, weather_code: 1, wind_speed_10m: 10, wind_direction_10m: 180, time: '2026-09-30T12:00' },
    }))), { status: 200, headers: { 'content-type': 'application/json' } });
    throw new Error(`Unexpected test URL: ${url}`);
  };
  try {
    const provider = new WeatherProvider();
    provider.setSecretResolver(() => 'test-openweather-key');
    const result = await provider.fetch({ force: true });
    assert.equal(result.data.length, 8);
    assert.equal(result.data.fallback, true);
    assert.equal(provider.status, 'degraded');
    assert.ok(result.data.every((item) => item.source === 'Open-Meteo'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('OpenSky renews an expired OAuth token once after an unauthorized data request', async () => {
  const originalFetch = globalThis.fetch;
  let tokenCalls = 0;
  let stateCalls = 0;
  globalThis.fetch = async (input, options = {}) => {
    const url = String(input);
    if (url.includes('/token')) {
      tokenCalls += 1;
      return new Response(JSON.stringify({ access_token: `access-${tokenCalls}`, expires_in: 300 }), { status: 200 });
    }
    stateCalls += 1;
    if (options.headers?.Authorization === 'Bearer access-1') return new Response('unauthorized', { status: 401 });
    return new Response(JSON.stringify({ states: [] }), { status: 200 });
  };
  try {
    const provider = new FlightsProvider();
    provider.setSecretResolver((key) => key === 'OPENSKY_CLIENT_ID' ? 'test-client' : key === 'OPENSKY_CLIENT_SECRET' ? 'test-secret' : undefined);
    const result = await provider.fetch({ force: true });
    assert.equal(tokenCalls, 2);
    assert.equal(stateCalls, 2);
    assert.deepEqual(result.data, []);
    assert.equal(provider.status, 'online');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('YouTube marks partially fulfilled regional searches as degraded', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    if (calls === 1) return new Response('unavailable', { status: 503 });
    return new Response(JSON.stringify({ items: [{
      id: { videoId: `video-${calls}` },
      snippet: { title: 'Verified live stream', channelTitle: 'Public broadcaster', liveBroadcastContent: 'live' },
    }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const provider = new YouTubeProvider();
    provider.setSecretResolver(() => 'test-youtube-key');
    const result = await provider.fetch({ force: true });
    assert.ok(result.data.length > 0);
    assert.equal(result.data.partial, true);
    assert.equal(provider.status, 'degraded');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('local briefing describes headline tone without inventing an elevated threat level', async () => {
  const provider = new AIProvider(async () => [{ title: 'Routine trade talks resume', region: 'GLOBAL', source: 'Test wire' }]);
  provider.setSecretResolver(() => undefined);
  const result = await provider.fetch({ force: true });
  assert.match(result.data.content, /Headline tone: mixed \/ no clear tilt/);
  assert.doesNotMatch(result.data.content, /OVERALL THREAT LEVEL/i);
  assert.equal(result.data.source, 'local-fallback');
  assert.equal(provider.getHealth().status, 'unconfigured');
  assert.equal(provider.getHealth().configured, false);
});

test('OpenAI analyst uses the server-side key and returns source-linked answers', async () => {
  const originalFetch = globalThis.fetch;
  let requestUrl = '';
  let requestOptions;
  globalThis.fetch = async (input, options = {}) => {
    requestUrl = String(input);
    requestOptions = options;
    return new Response(JSON.stringify({ model: 'gpt-4o-mini', output: [{ type: 'message', content: [{ type: 'output_text', text: 'The source reports an update [1].' }] }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const provider = new AIProvider(async () => []);
    provider.setSecretResolver((key) => key === 'OPENAI_API_KEY' ? 'test-openai-key' : undefined);
    const result = await provider.askQuestion('What changed?', [{ title: 'Example update', url: 'https://example.test/story', source: 'Example', description: 'A source summary.' }]);
    assert.equal(requestUrl, 'https://api.openai.com/v1/responses');
    assert.equal(requestOptions.headers.Authorization, 'Bearer test-openai-key');
    assert.match(JSON.parse(requestOptions.body).instructions, /untrusted evidence/);
    assert.equal(JSON.parse(requestOptions.body).max_output_tokens, 700);
    assert.equal(result.answer, 'The source reports an update [1].');
    assert.equal(result.sources[0].url, 'https://example.test/story');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('WHO outbreak provider requests recent notices and normalizes official fields', async () => {
  const originalFetch = globalThis.fetch;
  let requestUrl;
  globalThis.fetch = async (input) => {
    requestUrl = new URL(String(input));
    return new Response(JSON.stringify({ value: [{
      SystemSourceKey: 'who-123', Title: 'Disease outbreak – Exampleland', DonId: 'DON123',
      PublicationDateAndTime: '2026-09-29T12:00:00Z', Summary: '<p>WHO is monitoring cases &amp; contacts.</p>',
      UrlName: '2026-DON123', ItemDefaultUrl: '/emergencies/disease-outbreak-news/item/2026-DON123',
    }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const provider = new OutbreaksProvider();
    const result = await provider.fetch({ force: true });
    assert.equal(requestUrl.searchParams.get('$top'), '30');
    assert.equal(requestUrl.searchParams.get('$orderby'), 'PublicationDateAndTime desc');
    assert.match(requestUrl.searchParams.get('$filter'), /PublicationDateAndTime ge/);
    assert.equal(result.data[0].id, 'who-don-DON123');
    assert.equal(result.data[0].title, 'Disease outbreak – Exampleland');
    assert.equal(result.data[0].description, 'WHO is monitoring cases & contacts.');
    assert.equal(result.data[0].url, 'https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON123');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('WHO outbreak provider falls back to ordered local date filtering if OData filter fails', async () => {
  const originalFetch = globalThis.fetch;
  let requestCount = 0;
  globalThis.fetch = async (input) => {
    requestCount += 1;
    const url = new URL(String(input));
    if (url.searchParams.has('$filter')) return new Response('filter unsupported', { status: 400 });
    return new Response(JSON.stringify({ value: [{
      SystemSourceKey: 'who-fallback', Title: 'Recent notice', DonId: 'DON456',
      PublicationDateAndTime: '2026-09-28T12:00:00Z', Summary: 'Recent notice summary.',
      UrlName: '2026-DON456', ItemDefaultUrl: '/emergencies/disease-outbreak-news/item/2026-DON456',
    }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const provider = new OutbreaksProvider();
    const result = await provider.fetch({ force: true });
    assert.equal(requestCount, 2);
    assert.equal(result.data.length, 1);
    assert.equal(result.data.fallback, true);
    assert.equal(provider.status, 'degraded');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Polymarket provider extracts yes probability and ranks active markets by volume', async () => {
  const originalFetch = globalThis.fetch;
  let requestUrl;
  globalThis.fetch = async (input) => {
    requestUrl = new URL(String(input));
    return new Response(JSON.stringify([{ id: 'event-1', title: 'Election', category: 'Politics', slug: 'election', markets: [
      { id: 'market-1', question: 'Candidate A wins?', slug: 'candidate-a-wins', outcomes: '["No","Yes"]', outcomePrices: '["0.31","0.69"]', volume24hr: '35000', active: true, closed: false },
      { id: 'market-closed', question: 'Closed market', outcomes: '["Yes","No"]', outcomePrices: '["0.9","0.1"]', volume24hr: '99999', active: false, closed: true },
    ] }]), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const provider = new PredictionsProvider();
    const result = await provider.fetch({ force: true });
    assert.equal(requestUrl.searchParams.get('active'), 'true');
    assert.equal(requestUrl.searchParams.get('closed'), 'false');
    assert.equal(requestUrl.searchParams.get('order'), 'volume_24hr');
    assert.equal(result.data.length, 1);
    assert.equal(result.data[0].probability, 69);
    assert.equal(result.data[0].outcomeLabel, 'Yes');
    assert.equal(result.data[0].volume24h, 35000);
    assert.equal(result.data[0].url, 'https://polymarket.com/event/election');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Prediction provider falls back to labelled Manifold play-money markets', async () => {
  const originalFetch = globalThis.fetch;
  const requested = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    requested.push(url);
    if (url.includes('gamma-api.polymarket.com')) return new Response('temporarily unavailable', { status: 503 });
    if (url.includes('api.manifold.markets')) return new Response(JSON.stringify([{
      id: 'community-1', question: 'Will an example event occur?', url: 'https://manifold.markets/community/example-event',
      probability: 0.64, volume24Hours: 850, totalLiquidity: 4200, outcomeType: 'BINARY',
      isResolved: false, closeTime: Date.now() + 86_400_000,
    }]), { status: 200, headers: { 'content-type': 'application/json' } });
    throw new Error(`Unexpected test URL: ${url}`);
  };
  try {
    const provider = new PredictionsProvider();
    const result = await provider.fetch({ force: true });
    assert.equal(result.data.length, 1);
    assert.equal(result.data.fallback, true);
    assert.equal(provider.status, 'degraded');
    assert.equal(result.data[0].source, 'Manifold Markets');
    assert.equal(result.data[0].probability, 64);
    assert.equal(result.data[0].volumeUnit, 'MANA');
    assert.ok(requested.some((url) => url.includes('gamma-api.polymarket.com')));
    assert.ok(requested.some((url) => url.includes('api.manifold.markets')));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Launch Library provider normalizes upcoming mission schedule', async () => {
  const originalFetch = globalThis.fetch;
  let requestUrl;
  globalThis.fetch = async (input) => {
    requestUrl = new URL(String(input));
    return new Response(JSON.stringify({ results: [{
      id: 'launch-123', name: 'Falcon 9 | Example Mission', net: '2026-10-03T15:00:00Z', probability: 80,
      status: { name: 'Go for Launch' }, launch_service_provider: { name: 'SpaceX' },
      rocket: { configuration: { full_name: 'Falcon 9 Block 5' } },
      pad: { name: 'Launch Complex 39A', location: { name: 'Kennedy Space Center, FL, USA', country: { name: 'United States' } } },
      mission: { name: 'Example payload', description: 'Mission description.' },
      infoURLs: [{ url: 'https://example.test/mission' }],
    }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const provider = new LaunchesProvider();
    const result = await provider.fetch({ force: true });
    assert.equal(requestUrl.pathname, '/2.3.0/launches/upcoming/');
    assert.equal(requestUrl.searchParams.get('limit'), '30');
    assert.equal(result.data[0].provider, 'SpaceX');
    assert.equal(result.data[0].vehicle, 'Falcon 9 Block 5');
    assert.equal(result.data[0].probability, 80);
    assert.equal(result.data[0].url, 'https://example.test/mission');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Finnhub market watchlist validates symbols, uses server key and caches quotes', async () => {
  const originalFetch = globalThis.fetch;
  const requested = [];
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    requested.push(url);
    return new Response(JSON.stringify({ c: url.searchParams.get('symbol') === 'AAPL' ? 210.25 : 64000, d: 2.5, dp: 1.2, h: 211, l: 205, o: 207, pc: 207.75, t: 1790790000 }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const provider = new MarketsProvider();
    provider.setSecretResolver((key) => key === 'FINNHUB_API_KEY' ? 'server-only-test-key' : undefined);
    const result = await provider.fetchWatchlist(['aapl', 'BINANCE:BTCUSDT', 'AAPL', 'bad symbol']);
    assert.deepEqual(result.data.map((quote) => quote.symbol), ['AAPL', 'BINANCE:BTCUSDT']);
    assert.equal(result.data[0].current, 210.25);
    assert.equal(result.data[1].type, 'crypto');
    assert.equal(requested.length, 2);
    assert.ok(requested.some((url) => url.pathname.endsWith('/crypto/quote')));
    assert.ok(requested.every((url) => url.searchParams.get('token') === 'server-only-test-key'));
    assert.equal((await provider.fetchWatchlist(['AAPL', 'BINANCE:BTCUSDT'])).cached, true);
    assert.equal(requested.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('provider reports missing keys as unconfigured rather than falsely offline', async () => {
  const provider = new ExampleProvider();
  provider.setSecretResolver(() => undefined);
  const result = await provider.fetch();
  assert.equal(provider.status, 'unconfigured');
  assert.equal(result.configured, false);
  assert.deepEqual(result.data, []);
});

test('secret encryption round-trips and rejects tampering', () => {
  const previous = process.env.API_KEY_ENCRYPTION_SECRET;
  process.env.API_KEY_ENCRYPTION_SECRET = 'unit-test-encryption-secret-long-enough-32-chars';
  try {
    const encrypted = encryptSecret('provider-test-credential');
    assert.notEqual(encrypted, 'provider-test-credential');
    assert.equal(decryptSecret(encrypted), 'provider-test-credential');
    const changed = `${encrypted.slice(0, -2)}AA`;
    assert.throws(() => decryptSecret(changed));
    assert.equal(maskSecret('abcdefghijk'), 'abc••••hijk');
    assert.equal(maskSecret('short'), '•••••');
  } finally {
    if (previous === undefined) delete process.env.API_KEY_ENCRYPTION_SECRET;
    else process.env.API_KEY_ENCRYPTION_SECRET = previous;
  }
});

test('credential registry only exposes provider setting names, never live values', () => {
  assert.ok(API_KEY_DEFINITIONS.length >= 14);
  assert.ok(API_KEY_DEFINITIONS.every((definition) => /^[A-Z0-9_]+$/.test(definition.keyName)));
  assert.ok(API_KEY_DEFINITIONS.every((definition) => !('placeholder' in definition)));
  assert.ok(API_KEY_DEFINITIONS.some((definition) => definition.keyName === 'OPENAI_API_KEY'));
});

test('country and chokepoint estimates stay bounded and explicitly heuristic', () => {
  const countries = buildCountries({ conflicts: [{ country: 'Ukraine', fatalities: 2 }], news: [{ title: 'Ukraine reports' }] });
  const points = buildChokepoints({ news: [{ title: 'Shipping alert near Strait of Hormuz' }] });
  const risk = buildStrategicRisk(countries, points, []);
  assert.equal(countries.length, 31);
  assert.ok(countries.every((country) => country.score >= 0 && country.score <= 100));
  assert.equal(points.length, 13);
  assert.ok(['monitoring', 'strained', 'disrupted'].includes(points[0].status));
  assert.match(points[0].assessment, /not a vessel-traffic/);
  assert.ok(risk.score >= 0 && risk.score <= 100);
  assert.match(risk.note, /not an official/);
});
