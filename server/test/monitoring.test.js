import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { parseNewsFeed, fetchPublicNews } from '../src/services/providers/rss.js';
import { NewsProvider } from '../src/services/providers/news.js';
import { buildWatchroom, answerQuestion, collectObservations } from '../src/services/watchroom.js';
import { ResearchService } from '../src/services/research.js';
import { API_KEY_DEFINITIONS } from '../src/services/keyRegistry.js';
import { createApp } from '../src/app.js';
import { issueToken } from '../src/middleware/auth.js';
import { ProviderRegistry } from '../src/services/providers/registry.js';

const now = Date.parse('2026-10-11T18:30:00Z');
const item = (title = 'World report', url = 'https://example.test/report', date = 'Sun, 11 Oct 2026 18:00:00 GMT') => `<item><title><![CDATA[${title}]]></title><link>${url}</link>${date === null ? '' : `<pubDate>${date}</pubDate>`}<description>&lt;p&gt;Source description &amp; context&lt;/p&gt;</description></item>`;
const feed = (items) => `<?xml version="1.0"?><rss version="2.0"><channel><title>World feed</title>${items}</channel></rss>`;
const event = (id, extra = {}) => ({ id, title: 'Earthquake near Japan', type: 'seismic', source: 'USGS', severity: 'high', latitude: 35.1, longitude: 139.1, url: `https://example.test/${id}`, time: now - 60_000, ...extra });
function restoreFetch(t) { const original = globalThis.fetch; t.after(() => { globalThis.fetch = original; }); }

test('RSS parses CDATA/entities, preserves dates, sanitizes markup/URLs and never invents dates', () => {
  const articles = parseNewsFeed(feed(item('Trade &amp; diplomacy') + item('Undated report', 'https://example.test/undated', null) + item('Unsafe', 'javascript:alert(1)') + item('Credentials', 'https://user:password@example.test/secret')), { source: 'BBC World', now });
  assert.equal(articles.length, 2);
  assert.equal(articles[0].title, 'Trade & diplomacy');
  assert.equal(articles[0].time, Date.parse('2026-10-11T18:00:00Z'));
  assert.equal(articles[0].source, 'BBC World');
  assert.equal(articles[0].description, 'Source description & context');
  assert.equal(articles[1].time, null);
  assert.equal(articles[1].publishedAt, null);
  assert.equal(articles[1].provenance.timestampKnown, false);
});

test('RSS supports Atom links and excludes duplicate, future and old reports', () => {
  const xml = '<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Atom title</title><link href="https://example.test/atom?a=1&amp;b=2"/><published>2026-10-11T18:00:00Z</published></entry></feed>';
  assert.equal(parseNewsFeed(xml, { now })[0].url, 'https://example.test/atom?a=1&b=2');
  const articles = parseNewsFeed(feed(item() + item() + item('Future', 'https://example.test/future', '2026-10-12') + item('Old', 'https://example.test/old', '2026-09-01')), { now });
  assert.equal(articles.length, 1);
  const large = feed(Array.from({ length: 150 }, (_, index) => item(`Report ${index}`, `https://example.test/${index}`)).join(''));
  assert.equal(parseNewsFeed(large, { now }).length, 80);
});

test('RSS rejects malformed XML, DTD/entities, excessive depth and size', () => {
  for (const xml of ['<rss><channel></rss>', '<rss><item>', '<html>not feed</html>', '<!DOCTYPE rss [<!ENTITY x SYSTEM "file:///etc/passwd">]><rss/>', '<rss bad=unquoted/>', '<rss>' + '<a>'.repeat(40) + '</a>'.repeat(40) + '</rss>', 'x'.repeat(1024 * 1024 + 1)]) {
    assert.throws(() => parseNewsFeed(xml, { now }), /RSS|XML/);
  }
});

test('public RSS fallback tolerates one feed failure, bounds network response, and rejects total failure', async (t) => {
  restoreFetch(t);
  globalThis.fetch = async (url) => String(url).includes('bbci') ? new Response(feed(item())) : new Response('unavailable', { status: 503 });
  const articles = await fetchPublicNews({ now });
  assert.equal(articles.length, 1);
  assert.equal(articles.partial, true);
  assert.equal(articles[0].source, 'BBC World');
  globalThis.fetch = async () => new Response('x'.repeat(1024 * 1024 + 1));
  await assert.rejects(fetchPublicNews({ now }), /no usable reports/);
});

test('no-key news switches from failed GDELT to real publisher RSS and caches the snapshot', async (t) => {
  restoreFetch(t);
  let calls = 0;
  globalThis.fetch = async (url) => {
    calls++;
    if (String(url).includes('gdeltproject')) return new Response('busy', { status: 503 });
    return new Response(feed(item('Publisher report', 'https://example.test/publisher', new Date().toUTCString())));
  };
  const provider = new NewsProvider(); provider.setSecretResolver(() => undefined);
  const result = await provider.fetch();
  assert.equal(result.data[0].title, 'Publisher report');
  assert.equal(result.data[0].source, 'BBC World');
  assert.equal(result.data.fallback, true);
  assert.equal(result.data.length, 1);
  assert.equal(calls, 3);
  await provider.fetch();
  assert.equal(calls, 3);
});

test('all newsroom failures cool down instead of amplifying public refresh traffic', async (t) => {
  restoreFetch(t); let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response('offline', { status: 503 }); };
  const provider = new NewsProvider(); provider.setSecretResolver(() => undefined);
  await provider.fetch(); await provider.fetch({ force: true });
  assert.equal(calls, 3);
  assert.equal(provider.status, 'offline');
});

test('watchroom deterministic clusters, threads and timeline are grounded, bounded and exclude baseline/old events', () => {
  const events = [event('one'), event('two', { latitude: 35.3, source: 'NASA', severity: 'critical', time: now - 3_600_000 }), event('news', { type: 'news', latitude: null, longitude: null, severity: 'info' }), event('old', { time: now - 200 * 3_600_000 }), event('watch-baseline', { provenance: { kind: 'baseline' } })];
  const before = JSON.stringify(events);
  const watch = buildWatchroom(events, { now, hours: 24 });
  assert.deepEqual(watch, buildWatchroom(events, { now, hours: 24 }));
  assert.equal(watch.summary.total, 3);
  assert.equal(watch.hotspots.length, 1);
  assert.equal(watch.hotspots[0].latitude, 35.2);
  assert.equal(watch.hotspots[0].sourceCount, 2);
  assert.equal(watch.hotspots[0].severity, 'critical');
  assert.equal(watch.timeline.reduce((sum, row) => sum + row.count, 0), 3);
  assert.equal(watch.timeline.reduce((sum, row) => sum + row.highCount, 0), 2);
  assert.ok(watch.timeline.length <= 25);
  assert.equal(watch.threads.length, 2);
  for (const thread of watch.threads) assert.deepEqual(thread.citations.map((cite) => cite.id), thread.signals.map((signal) => signal.id));
  assert.match(watch.limitations.join(' '), /not inferred locations/);
  assert.equal(JSON.stringify(events), before);
  const many = Array.from({ length: 1000 }, (_, index) => event(`many-${index}`, { latitude: (index % 35) * 5 - 85, longitude: (index % 70) * 5 - 175 }));
  const bounded = buildWatchroom(many, { now, hours: 999 });
  assert.equal(bounded.windowHours, 168);
  assert.ok(bounded.hotspots.length <= 24 && bounded.threads.length <= 12 && bounded.timeline.length <= 169);
  assert.ok(bounded.threads.every((thread) => thread.signals.length <= 8));
  assert.ok(bounded.hotspots.every((hotspot) => hotspot.eventIds.length <= 50));
});

test('local analyst retrieves relevant reports with citations and honestly reports no evidence', () => {
  const events = [event('japan'), event('other', { title: 'Trade talks in Brazil', type: 'news', severity: 'low' })];
  const answer = answerQuestion('What happened in Japan?', events, { now });
  assert.equal(answer.signals.length, 1);
  assert.equal(answer.citations[0].id, 'japan');
  assert.match(answer.answer, /\[japan\]/);
  assert.match(answer.method, /no model or paid request/);
  const missing = answerQuestion('Any cyclone reports in Atlantis?', events, { now });
  assert.equal(missing.citations.length, 0);
  assert.match(missing.answer, /No matching dated reports/);
  assert.match(missing.answer, /does not establish safety/);
});

test('analyst category synonyms retrieve observations whose titles omit category words', () => {
  const events = [event('magnitude', { title: 'M4.2 - 18 km NE of Tokyo' }),
    event('thermal', { title: 'Satellite anomaly near coast', type: 'fire' }),
    event('incident', { title: 'Reported incident in district', type: 'conflict' }),
    event('unrelated', { title: 'Trade talks', type: 'news' })];
  for (const [words, id] of [[['earthquake', 'earthquakes', 'quake', 'quakes'], 'magnitude'], [['wildfire', 'wildfires', 'fire', 'fires', 'thermal'], 'thermal'], [['conflict', 'violence'], 'incident']]) {
    for (const word of words) {
      const answer = answerQuestion(`What ${word} observations are available?`, events, { now });
      assert.deepEqual(answer.citations.map((cite) => cite.id), [id]);
      assert.match(answer.method, /category synonyms/);
    }
  }
  assert.equal(answerQuestion('earthquakes', [], { now }).citations.length, 0);
});

test('generic analyst priority questions rank actual fresh observations without broadening specific queries', () => {
  const events = [event('low', { severity: 'low', time: now - 1000 }),
    event('high', { severity: 'high' }), event('critical', { severity: 'critical' }),
    event('old', { severity: 'critical', time: now - 200 * 3_600_000 }),
    event('baseline', { severity: 'critical', provenance: { kind: 'baseline' } })];
  for (const question of ['What needs attention?', 'highest severity', 'Show top priorities', 'What observations are available?']) {
    const answer = answerQuestion(question, events, { now });
    assert.deepEqual(answer.citations.map((cite) => cite.id), ['critical', 'high', 'low']);
    assert.match(answer.answer, /General priority query/);
  }
  assert.equal(answerQuestion('What needs attention in Atlantis?', events, { now }).citations.length, 0);
});

test('observation collector handles rejecting or hanging sources within deadline', async () => {
  const registry = { get: (name) => name === 'usgs' ? { status: 'online', fetch: async () => ({ data: [event('available')] }) } : name === 'news' ? { fetch: () => new Promise(() => {}) } : undefined };
  const result = await collectObservations(registry, { timeoutMs: 10 });
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].provenance.provider, 'usgs');
  assert.ok(result.unavailableSources.includes('news'));
});

test('automated briefing input includes real publisher reports and observed incidents without public paid calls', async (t) => {
  restoreFetch(t);
  const keys = ['AI_API_KEY', 'OPENAI_API_KEY', 'OPENROUTER_API_KEY'];
  const old = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  keys.forEach((key) => delete process.env[key]);
  t.after(() => { keys.forEach((key) => old[key] === undefined ? delete process.env[key] : process.env[key] = old[key]); });
  globalThis.fetch = async () => { throw new Error('No external network allowed in this test'); };
  const registry = ProviderRegistry.createDefault({ secretResolver: () => undefined });
  t.after(() => registry.stop());
  for (const provider of registry.getAll().filter((provider) => provider.name !== 'openai')) {
    provider.fetch = async () => ({ data: provider.name === 'usgs' ? [event('quake', { time: Date.now() - 1000 })]
      : provider.name === 'news' ? [event('wire', { title: 'Reported diplomacy update', type: 'news', source: 'BBC World', time: Date.now() - 2000 })] : [] });
  }
  const result = await registry.get('openai').fetch();
  assert.equal(result.data.fallbackCode, 'no_key');
  assert.equal(result.data.citations.length, 2);
  assert.ok(result.data.citations.some((cite) => cite.source === 'USGS'));
  assert.ok(result.data.citations.some((cite) => cite.source === 'BBC World'));
});

test('research basic request is bounded, sanitizes results, caches and applies cross-query cooldown', async (t) => {
  restoreFetch(t); let calls = 0; let clock = now;
  globalThis.fetch = async (url, options) => {
    calls++; assert.equal(url, 'https://api.tavily.com/search');
    assert.deepEqual(JSON.parse(options.body), { query: 'Japan earthquake', search_depth: 'basic', max_results: 5, include_answer: false, include_raw_content: false, include_images: false });
    return new Response(JSON.stringify({ results: [{ title: '<b>Source report</b>', url: 'https://example.test/report', content: 'Reported <script>markup</script>' }, { title: 'Unsafe', url: 'javascript:alert(1)' }, { title: 'Duplicate', url: 'https://example.test/report' }] }));
  };
  const research = new ResearchService(() => 'unit-test-key-only', { now: () => clock });
  const result = await research.search('Japan earthquake');
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].title, 'Source report');
  assert.equal(result.results[0].source, 'example.test');
  assert.equal((await research.search('Japan earthquake')).cached, true);
  assert.equal(calls, 1);
  await assert.rejects(research.search('different query'), (error) => error.status === 429 && error.retryAfterSeconds === 600);
  clock += 10 * 60_000;
  globalThis.fetch = async () => { calls++; return new Response(JSON.stringify({ results: [] })); };
  await research.search('different query');
  assert.equal(calls, 2);
  assert.ok(API_KEY_DEFINITIONS.some((definition) => definition.keyName === 'TAVILY_API_KEY'));
});

test('research singleflight and failures never retry automatically or expose keys', async (t) => {
  restoreFetch(t); let calls = 0;
  globalThis.fetch = async () => { calls++; await new Promise((resolve) => setTimeout(resolve, 10)); return new Response(JSON.stringify({ results: [] })); };
  const service = new ResearchService(() => 'unit-test-secret');
  await Promise.all(Array.from({ length: 8 }, () => service.search('one query')));
  assert.equal(calls, 1);
  globalThis.fetch = async () => { calls++; throw new Error('unit-test-secret'); };
  const failed = new ResearchService(() => 'unit-test-secret');
  await assert.rejects(failed.search('outage'), (error) => error.status === 502 && !error.message.includes('unit-test-secret'));
  await assert.rejects(failed.search('outage'), (error) => error.status === 429);
  assert.equal(calls, 2);
  await assert.rejects(new ResearchService(() => undefined).search('query'), (error) => error.status === 503);
  await assert.rejects(failed.search('x'.repeat(501)), (error) => error.status === 400);
});

test('research rejects malformed, oversized and HTTP error responses without retries', async (t) => {
  restoreFetch(t);
  for (const makeResponse of [() => new Response('{broken'), () => new Response(JSON.stringify({ wrong: [] })), () => new Response('x'.repeat(270_000)), () => new Response('blocked', { status: 429 })]) {
    let calls = 0;
    globalThis.fetch = async () => { calls++; return makeResponse(); };
    const research = new ResearchService(() => 'unit-test-key');
    await assert.rejects(research.search('question'), (error) => error.status === 502);
    await assert.rejects(research.search('different question'), (error) => error.status === 429);
    assert.equal(calls, 1);
  }
});

test('public analyst/watchroom routes work without AI; research requires auth and missing key fails closed', async (t) => {
  restoreFetch(t);
  const registry = { get: (name) => name === 'usgs' ? { status: 'online', fetch: async () => ({ data: [event('route', { time: Date.now() - 1000 })] }) } : undefined, getHealthReport: () => [] };
  const priorJwt = process.env.JWT_SECRET; const priorKey = process.env.TAVILY_API_KEY;
  process.env.JWT_SECRET = 'unit-test-signing-secret-longer-than-thirty-two-chars'; delete process.env.TAVILY_API_KEY;
  t.after(() => { if (priorJwt === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = priorJwt; if (priorKey === undefined) delete process.env.TAVILY_API_KEY; else process.env.TAVILY_API_KEY = priorKey; });
  const vault = { get: () => undefined, setTestResult: async () => {} };
  const server = http.createServer(createApp({ registry, vault, store: {}, pulse: {} }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const watch = await (await fetch(`${base}/api/intel/watchroom?hours=999`)).json();
  assert.equal(watch.windowHours, 168); assert.equal(watch.summary.total, 1);
  const ask = await fetch(`${base}/api/intel/ask`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question: 'Japan earthquake' }) });
  assert.equal(ask.status, 200); assert.equal((await ask.json()).citations.length, 1);
  const invalid = await fetch(`${base}/api/intel/ask`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question: 'x'.repeat(501) }) });
  assert.equal(invalid.status, 400);
  const unauth = await fetch(`${base}/api/admin/research`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"query":"Japan"}' });
  assert.equal(unauth.status, 401);
  const token = issueToken({ email: 'test@example.test', name: 'Test', role: 'admin' });
  const missing = await fetch(`${base}/api/admin/research`, { method: 'POST', headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` }, body: '{"query":"Japan"}' });
  assert.equal(missing.status, 503);
  const originalFetch = globalThis.fetch;
  let paidCalls = 0;
  process.env.TAVILY_API_KEY = 'unit-test-research-key';
  globalThis.fetch = async (url, options) => {
    if (String(url).startsWith(base)) return originalFetch(url, options);
    assert.equal(url, 'https://api.tavily.com/search'); paidCalls++;
    return new Response(JSON.stringify({ results: [{ title: 'Japan report', url: 'https://example.test/japan', content: 'Source snippet' }] }));
  };
  const headers = { 'content-type': 'application/json', Authorization: `Bearer ${token}` };
  const keyCheck = await fetch(`${base}/api/admin/keys/test/tavily`, { method: 'POST', headers });
  assert.equal(keyCheck.status, 200);
  assert.match((await keyCheck.json()).note, /no paid API request/);
  assert.equal(paidCalls, 0);
  const result = await fetch(`${base}/api/admin/research`, { method: 'POST', headers, body: '{"query":"Japan"}' });
  assert.equal(result.status, 200); assert.equal((await result.json()).results.length, 1);
  const cached = await fetch(`${base}/api/admin/research`, { method: 'POST', headers, body: '{"query":"Japan"}' });
  assert.equal((await cached.json()).cached, true);
  const cooldown = await fetch(`${base}/api/admin/research`, { method: 'POST', headers, body: '{"query":"different"}' });
  assert.equal(cooldown.status, 429); assert.ok(Number(cooldown.headers.get('retry-after')) > 0);
  assert.equal(paidCalls, 1);
});
