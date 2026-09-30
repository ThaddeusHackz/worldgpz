import test from 'node:test';
import assert from 'node:assert/strict';
import { BaseProvider } from '../src/services/providers/base.js';
import { ProviderRegistry } from '../src/services/providers/registry.js';
import { NewsProvider } from '../src/services/providers/news.js';
import { WeatherProvider } from '../src/services/providers/weather.js';
import { API_KEY_DEFINITIONS } from '../src/services/keyRegistry.js';
import { buildChokepoints, buildCountries, buildStrategicRisk } from '../src/services/situational.js';
import { decryptSecret, encryptSecret, maskSecret } from '../src/lib/vaultCrypto.js';

class ExampleProvider extends BaseProvider {
  constructor() { super('example', { ttlMs: 50, requiredKeys: ['EXAMPLE_KEY'], emptyValue: [] }); this.calls = 0; this.fail = false; }
  async _fetchFresh() { this.calls += 1; if (this.fail) throw new Error('temporary outage'); return [{ value: this.calls }]; }
}

test('provider registry has the complete 18-source dashboard mesh', () => {
  const registry = ProviderRegistry.createDefault({ secretResolver: () => undefined });
  assert.equal(registry.getAll().length, 18);
  assert.equal(registry.getHealthReport().length, 18);
  for (const name of ['usgs', 'eonet', 'gdelt', 'swpc', 'reliefweb', 'weather', 'news', 'acled', 'flights', 'ships', 'firms', 'markets', 'energy', 'macro', 'windy', 'youtube', 'openai', 'iss']) {
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
