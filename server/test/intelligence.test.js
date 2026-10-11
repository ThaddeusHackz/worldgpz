import test from 'node:test';
import assert from 'node:assert/strict';
import { AIProvider, briefingSources } from '../src/services/providers/ai.js';
import { analyzeMission, boundedHours } from '../src/services/mission.js';
import { BASELINE_WATCHPOINTS } from '../src/data/baseline.js';
import { buildChokepoints } from '../src/services/situational.js';
import { FIRMSProvider } from '../src/services/providers/firms.js';
import { safeNumber, fetchJson } from '../src/lib/http.js';

function isolate(t) {
  const fetch = globalThis.fetch;
  const names = ['AI_API_KEY', 'OPENAI_API_KEY', 'OPENROUTER_API_KEY', 'AI_BASE_URL', 'AI_MODEL'];
  const old = Object.fromEntries(names.map((key) => [key, process.env[key]]));
  names.forEach((key) => delete process.env[key]);
  t.after(() => {
    globalThis.fetch = fetch;
    for (const key of names) { if (old[key] === undefined) delete process.env[key]; else process.env[key] = old[key]; }
  });
}
const headline = () => ({ title: 'Diplomatic talks reported', source: 'Test wire', url: 'https://example.test/report', time: Date.now() - 1000 });
const response = (content) => new Response(JSON.stringify({ model: 'mock-model', choices: [{ message: { content } }] }));

test('deterministic fallback has source citations, no paid request, and labels undated evidence', async (t) => {
  isolate(t);
  globalThis.fetch = () => { throw new Error('Must not call paid API'); };
  const provider = new AIProvider(async () => [headline(), { title: 'Undated report', source: 'Test archive', url: 'javascript:alert(1)' }]);
  const { data } = await provider.fetch();
  assert.equal(data.fallback, true);
  assert.equal(data.citations[0].url, 'https://example.test/report');
  assert.equal(data.citations[1].url, null);
  assert.match(data.content, /\[S1\]/);
  assert.match(data.content, /publication time unknown/);
  assert.equal(provider.getHealth().configured, false);
});

test('OpenAI environment alias works with a vault resolver and cost controls deduplicate force requests', async (t) => {
  isolate(t); process.env.OPENAI_API_KEY = 'unit-test-not-a-real-key';
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    calls++;
    assert.equal(url, 'https://api.openai.com/v1/chat/completions');
    const body = JSON.parse(options.body);
    assert.equal(body.max_tokens, 500);
    assert.ok(body.messages[1].content.includes('https://example.test/report'));
    assert.equal(options.redirect, 'error');
    return response('• Diplomatic talks are reported [S1].');
  };
  const provider = new AIProvider(async () => [headline()]);
  provider.setSecretResolver(() => undefined);
  const results = await Promise.all(Array.from({ length: 12 }, () => provider.fetch({ force: true })));
  assert.equal(calls, 1);
  assert.equal(results[0].data.fallback, false);
  assert.equal(results[0].data.citations[0].id, 'S1');
  provider.invalidate();
  await provider.fetch({ force: true });
  assert.equal(calls, 1);
});

test('OpenRouter alias chooses matching endpoint and model without trying another paid provider', async (t) => {
  isolate(t); process.env.OPENROUTER_API_KEY = 'unit-test-router-key';
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions');
    assert.equal(JSON.parse(options.body).model, 'openai/gpt-4o-mini');
    return response('• Talks reported [S1].');
  };
  const result = await new AIProvider(async () => [headline()]).fetch();
  assert.equal(result.data.source, 'openrouter');
});

test('AI rejects missing, invented, uncited bullet, empty and oversized responses without exposing upstream secrets', async (t) => {
  isolate(t); process.env.AI_API_KEY = 'unit-test-secret';
  for (const content of ['No citations.', '• False claim [S999].', '• Cited [S1].\n• Uncited claim.', '', 'x'.repeat(6001)]) {
    globalThis.fetch = async () => response(content);
    const provider = new AIProvider(async () => [headline()]);
    const { data } = await provider.fetch();
    assert.equal(data.source, 'local-fallback');
    assert.doesNotMatch(JSON.stringify(data), /unit-test-secret/);
  }
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('unit-test-secret'); };
  const provider = new AIProvider(async () => [headline()]);
  const first = await provider.fetch();
  assert.doesNotMatch(JSON.stringify(first), /unit-test-secret/);
  await provider.fetch({ force: true });
  assert.equal(calls, 1);
});

test('old, future, baseline and stale evidence cannot trigger paid AI', async (t) => {
  isolate(t); process.env.AI_API_KEY = 'unit-test-key';
  globalThis.fetch = async () => { throw new Error('Paid API must not run'); };
  const old = { ...headline(), time: Date.now() - 25 * 3_600_000 };
  assert.equal(briefingSources([old, { ...headline(), time: Date.now() + 60_000 }, ...BASELINE_WATCHPOINTS]).length, 0);
  const provider = new AIProvider(async () => ({ data: [headline()], stale: true }));
  const { data } = await provider.fetch();
  assert.equal(data.stale, true);
  assert.match(data.fallbackReason, /No fresh dated/);
  const failed = await new AIProvider(async () => { throw new Error('news down'); }).fetch();
  assert.equal(failed.data.fallback, true);
  assert.match(failed.data.content, /No live assessment/);
});

test('mission normalizes, deduplicates, ranks and excludes old/future/undated/baseline records without mutation', () => {
  const now = Date.parse('2026-10-11T18:00:00Z');
  const fresh = { id: 'fresh', title: 'Earthquake report', severity: 'high', source: 'USGS', time: now - 1000, latitude: '', longitude: 181, url: 'https://example.test/quake', provenance: { stale: true, provider: 'usgs' } };
  const events = [fresh, { ...fresh }, { ...fresh, id: 'critical', severity: 'critical', url: null, time: now - 2000 }, { ...fresh, time: now - 25 * 3_600_000 }, { ...fresh, time: now + 1 }, { title: 'No date' }, ...BASELINE_WATCHPOINTS];
  const before = JSON.stringify(events);
  const result = analyzeMission(events, { now, unavailableSources: ['acled'] });
  assert.deepEqual(result.summary, { total: 2, critical: 1, high: 1, sourceCount: 1 });
  assert.equal(result.priorities[0].id, 'critical');
  assert.equal(result.priorities[1].latitude, null);
  assert.equal(result.priorities[1].longitude, null);
  assert.equal(result.priorities[1].provenance.stale, true);
  assert.deepEqual(result.coverage, [{ source: 'USGS', count: 2 }]);
  assert.match(result.limitations.join(' '), /baseline watchpoints \(not live\)/);
  assert.match(result.limitations.join(' '), /stale provider caches/);
  assert.match(result.limitations.join(' '), /acled/);
  assert.equal(JSON.stringify(events), before);
  assert.equal(boundedHours('invalid'), 24);
  assert.equal(boundedHours(-1), 1);
  assert.equal(boundedHours(900), 168);
  assert.equal(analyzeMission([], { now }).summary.total, 0);
});

test('static waterway watchpoints never count as disruptions', () => {
  const points = buildChokepoints({ events: BASELINE_WATCHPOINTS });
  assert.ok(points.every((point) => point.signalCount === 0 && point.status === 'monitoring'));
});

test('FIRMS acquisition HHMM is converted to real UTC event time; absent coordinates stay absent', async (t) => {
  isolate(t);
  globalThis.fetch = async () => new Response('latitude,longitude,acq_date,acq_time,confidence\n10,20,2026-10-11,0030,h\n,20,2026-10-11,0030,h\n');
  const provider = new FIRMSProvider(); provider.setSecretResolver(() => 'unit-test-key');
  const { data } = await provider.fetch();
  assert.equal(data.length, 1);
  assert.equal(data[0].time, Date.parse('2026-10-11T00:30:00Z'));
  assert.equal(safeNumber(null), null);
  assert.equal(safeNumber(''), null);
});

test('bounded HTTP reader rejects oversized and malformed payloads', async (t) => {
  isolate(t);
  globalThis.fetch = async () => new Response('x'.repeat(100));
  await assert.rejects(fetchJson('https://example.test', {}, 1000, 20), /size limit/);
  globalThis.fetch = async () => new Response('{broken');
  await assert.rejects(fetchJson('https://example.test'), /invalid JSON/);
});

test('AI falls back on malformed/oversized JSON and HTTP rate limits with no paid retry', async (t) => {
  isolate(t); process.env.AI_API_KEY = 'unit-test-key';
  for (const makeResponse of [() => new Response('{invalid'), () => new Response('x'.repeat(70_000)), () => new Response('rate limited', { status: 429 })]) {
    let calls = 0;
    globalThis.fetch = async () => { calls++; return makeResponse(); };
    const provider = new AIProvider(async () => [headline()]);
    const result = await provider.fetch();
    assert.equal(result.data.fallback, true);
    await provider.fetch({ force: true });
    assert.equal(calls, 1);
  }
});

test('AI enforces source and paid request deadlines even when mocked upstream ignores abort', async (t) => {
  isolate(t); process.env.AI_API_KEY = 'unit-test-key';
  const sources = new AIProvider(() => new Promise(() => {}), { sourceTimeoutMs: 10 });
  assert.equal((await sources.fetch()).data.fallback, true);
  const keepAlive = setInterval(() => {}, 1000);
  t.after(() => clearInterval(keepAlive));
  globalThis.fetch = () => new Promise(() => {});
  const paid = new AIProvider(async () => [headline()], { timeoutMs: 10 });
  const result = await paid.fetch();
  assert.equal(result.data.fallback, true);
  assert.match(result.data.fallbackReason, /timed out/);
});
