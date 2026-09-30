import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { authConfigurationReady, authMiddleware, cookieOptions, issueToken, SESSION_COOKIE, verifyToken } from './middleware/auth.js';
import { loginLimiter, apiLimiter } from './middleware/rateLimit.js';
import { requestLogger } from './middleware/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { API_KEY_DEFINITIONS, KEY_DEFINITION_BY_NAME } from './services/keyRegistry.js';
import { BASELINE_WATCHPOINTS } from './data/baseline.js';
import { WEATHER_CITIES } from './services/providers/weather.js';
import { buildChokepoints, buildCountries, buildStrategicRisk } from './services/situational.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = path.resolve(__dirname, '../../client/dist');
const severityRank = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
const arrayValue = (value) => Array.isArray(value) ? value : [];

function categoryFromQuery(type) {
  return ({ seismic: 'seismic', natural: 'natural', conflicts: 'conflict', conflict: 'conflict', fires: 'fire', fire: 'fire' })[type] || type;
}

function makeEventId(event) {
  return event.id || `${event.source || 'event'}-${event.external_id || `${event.type}-${event.time || event.title}`}`;
}

function uniqueEvents(items) {
  const unique = new Map();
  for (const event of items) {
    if (!event?.title) continue;
    const key = event.external_id ? `${event.source || ''}:${event.external_id}` : makeEventId(event);
    if (!unique.has(key)) unique.set(key, { ...event, id: makeEventId(event) });
  }
  return [...unique.values()].sort((a, b) => (Number(b.time) || Date.parse(b.publishedAt) || 0) - (Number(a.time) || Date.parse(a.publishedAt) || 0));
}

async function readProvider(registry, name, force = false) {
  const provider = registry.get(name);
  if (!provider) return [];
  const result = await provider.fetch({ force });
  return result.data;
}

async function aggregateEvents(registry) {
  const names = ['usgs', 'eonet', 'acled', 'firms', 'reliefweb'];
  const settled = await Promise.allSettled(names.map((name) => readProvider(registry, name)));
  const live = settled.flatMap((result) => result.status === 'fulfilled' ? arrayValue(result.value) : []);
  return uniqueEvents([...live, ...BASELINE_WATCHPOINTS]);
}

function sentimentScore(title = '') {
  const text = title.toLowerCase();
  const negative = (text.match(/attack|war|killed|crisis|strike|crash|threat|disaster|earthquake|fire|sanction|fatal|conflict|violence/g) || []).length;
  const positive = (text.match(/agreement|ceasefire|recovery|growth|surplus|peace|rescue|aid|cooperation|record high/g) || []).length;
  return Math.max(-1, Math.min(1, (positive - negative) / 3));
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function passwordMatches(input) {
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (hash) return bcrypt.compare(String(input), hash);
  return Promise.resolve(Boolean(process.env.ADMIN_PASSWORD) && safeEqual(input, process.env.ADMIN_PASSWORD));
}

function sendCollection(res, provider, data, key = 'data') {
  res.json({ [key]: data ?? [], provider: provider?.name || null, status: provider?.status || 'unknown', cached: provider?.data !== null, updatedAt: provider?.lastSuccess ? new Date(provider.lastSuccess).toISOString() : null, error: provider?.lastError || null });
}

export function createApp({ registry, store, vault, pulse, startedAt = Date.now() }) {
  const app = express();
  if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        connectSrc: ["'self'", 'https://*.basemaps.cartocdn.com'],
        frameSrc: ["'self'", 'https://www.youtube.com', 'https://www.youtube-nocookie.com'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));
  app.use(compression({
    filter: (req, res) => {
      if (String(res.getHeader('Content-Type') || '').includes('text/event-stream')) return false;
      return compression.filter(req, res);
    },
  }));
  app.use(requestLogger);
  app.use(express.json({ limit: '64kb' }));
  app.use(express.urlencoded({ extended: false, limit: '16kb' }));
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });
  app.use('/api', apiLimiter);
  app.set('registry', registry);
  app.set('store', store);
  app.set('vault', vault);
  app.set('pulse', pulse);

  app.get('/api/health', (_req, res) => {
    const providers = registry.getHealthReport();
    const active = providers.filter((provider) => ['online', 'degraded'].includes(provider.status)).length;
    res.json({
      status: 'ok', uptime: Math.floor((Date.now() - startedAt) / 1000),
      memory: process.memoryUsage(), providers,
      uplinks: { online: active, total: providers.length },
      database: store?.persistent ? (store.initialized ? 'connected' : 'configured') : 'not-configured',
      version: '2.0.0', author: 'ThaddeusTechz', timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/providers/health', (_req, res) => {
    const providers = registry.getHealthReport();
    res.json({ providers, uplinks: { online: providers.filter((item) => ['online', 'degraded'].includes(item.status)).length, total: providers.length } });
  });

  app.get('/api/events', async (req, res, next) => {
    try {
      let events = await aggregateEvents(registry);
      if (req.query.type) events = events.filter((event) => event.type === categoryFromQuery(String(req.query.type)));
      if (req.query.severity) events = events.filter((event) => event.severity === req.query.severity);
      if (req.query.search) {
        const search = String(req.query.search).slice(0, 100).toLowerCase();
        events = events.filter((event) => `${event.title} ${event.description || ''}`.toLowerCase().includes(search));
      }
      const limit = Math.min(500, Math.max(1, Number.parseInt(String(req.query.limit || '250'), 10) || 250));
      res.json({ events: events.slice(0, limit), total: events.length, generatedAt: new Date().toISOString() });
    } catch (error) { next(error); }
  });

  const eventRoutes = [
    ['/api/events/seismic', 'usgs'], ['/api/events/natural', 'eonet'], ['/api/events/conflicts', 'acled'], ['/api/events/fires', 'firms'],
  ];
  for (const [route, name] of eventRoutes) app.get(route, async (_req, res, next) => {
    try { const data = await readProvider(registry, name); res.json(arrayValue(data)); } catch (error) { next(error); }
  });

  app.get('/api/news', async (_req, res, next) => {
    try {
      const data = await readProvider(registry, 'news');
      sendCollection(res, registry.get('news'), arrayValue(data), 'articles');
    } catch (error) { next(error); }
  });
  app.get('/api/intel', async (_req, res, next) => {
    try { res.json({ articles: arrayValue(await readProvider(registry, 'gdelt')), generatedAt: new Date().toISOString() }); }
    catch (error) { next(error); }
  });

  app.get('/api/intel/briefing', async (_req, res, next) => {
    try {
      const result = await registry.get('openai').fetch();
      res.json(result.data || { content: 'Briefing not available.', model: 'none', generatedAt: new Date().toISOString(), headlineCount: 0 });
    } catch (error) { next(error); }
  });
  app.get('/api/intel/sentiment', async (_req, res, next) => {
    try {
      const articles = arrayValue(await readProvider(registry, 'news')).slice(0, 100);
      const scored = articles.map((article) => ({ title: article.title, source: article.source, score: sentimentScore(article.title), sentiment: sentimentScore(article.title) > 0.15 ? 'positive' : sentimentScore(article.title) < -0.15 ? 'negative' : 'neutral' }));
      const average = scored.length ? scored.reduce((sum, article) => sum + article.score, 0) / scored.length : 0;
      res.json({ score: Number(average.toFixed(2)), label: average > 0.15 ? 'positive' : average < -0.15 ? 'negative' : 'mixed / neutral', articles: scored, method: 'transparent keyword heuristic', generatedAt: new Date().toISOString() });
    } catch (error) { next(error); }
  });
  app.get('/api/intel/focal-points', async (_req, res, next) => {
    try {
      const [news, events] = await Promise.all([readProvider(registry, 'news'), aggregateEvents(registry)]);
      const groups = new Map();
      for (const item of [...arrayValue(news), ...events]) {
        const region = item.region || item.metadata?.region || 'GLOBAL';
        const current = groups.get(region) || { region, signalCount: 0, maxSeverity: 'low' };
        current.signalCount += 1;
        if ((severityRank[item.severity] || 0) > (severityRank[current.maxSeverity] || 0)) current.maxSeverity = item.severity || 'low';
        groups.set(region, current);
      }
      res.json([...groups.values()].sort((a, b) => b.signalCount - a.signalCount).slice(0, 10));
    } catch (error) { next(error); }
  });

  app.get('/api/flights', async (_req, res, next) => {
    try { res.json(arrayValue(await readProvider(registry, 'flights'))); } catch (error) { next(error); }
  });
  app.get('/api/flights/military', async (_req, res, next) => {
    try { res.json(arrayValue(await readProvider(registry, 'flights')).filter((flight) => flight.military)); } catch (error) { next(error); }
  });
  app.get('/api/ships', async (_req, res, next) => {
    try { res.json(arrayValue(await readProvider(registry, 'ships'))); } catch (error) { next(error); }
  });
  app.get('/api/iss', async (_req, res, next) => {
    try { res.json(await readProvider(registry, 'iss')); } catch (error) { next(error); }
  });
  app.get('/api/markets', async (_req, res, next) => {
    try { res.json(arrayValue(await readProvider(registry, 'markets'))); } catch (error) { next(error); }
  });
  app.get('/api/markets/forex', async (_req, res, next) => {
    try {
      const result = await registry.get('markets').fetchForex();
      res.json(result.data || []);
    } catch (error) { next(error); }
  });
  app.get('/api/energy', async (_req, res, next) => {
    try { res.json(arrayValue(await readProvider(registry, 'energy'))); } catch (error) { next(error); }
  });
  app.get('/api/economics', async (_req, res, next) => {
    try { res.json(arrayValue(await readProvider(registry, 'macro'))); } catch (error) { next(error); }
  });
  app.get('/api/weather', async (_req, res, next) => {
    try { res.json(arrayValue(await readProvider(registry, 'weather'))); } catch (error) { next(error); }
  });
  app.get('/api/weather/:city', async (req, res, next) => {
    try {
      const data = arrayValue(await readProvider(registry, 'weather'));
      const city = data.find((item) => item.name.toLowerCase() === String(req.params.city).toLowerCase());
      if (!city) return res.status(404).json({ error: 'City not found in the tracked weather list.' });
      res.json(city);
    } catch (error) { next(error); }
  });
  app.get('/api/webcams', async (_req, res, next) => {
    try { res.json(arrayValue(await readProvider(registry, 'windy'))); } catch (error) { next(error); }
  });
  app.get('/api/media/webcams', async (_req, res, next) => {
    try {
      const webcams = arrayValue(await readProvider(registry, 'youtube'));
      const provider = registry.get('youtube');
      res.json({ webcams, status: provider.status, error: provider.lastError, updatedAt: provider.lastSuccess ? new Date(provider.lastSuccess).toISOString() : null });
    } catch (error) { next(error); }
  });
  app.get('/api/media/webcams/:region', async (req, res, next) => {
    try {
      const webcams = arrayValue(await readProvider(registry, 'youtube'));
      const region = String(req.params.region).toLowerCase();
      const matching = region === 'all' ? webcams : webcams.filter((cam) => cam.region === region);
      res.json({ webcams: matching, status: registry.get('youtube').status });
    } catch (error) { next(error); }
  });

  app.get('/api/situational/countries', async (_req, res, next) => {
    try {
      const [conflicts, events, news] = await Promise.all([
        readProvider(registry, 'acled'), aggregateEvents(registry), readProvider(registry, 'news'),
      ]);
      res.json(buildCountries({ conflicts: arrayValue(conflicts), events, news: arrayValue(news) }));
    } catch (error) { next(error); }
  });
  app.get('/api/situational/chokepoints', async (_req, res, next) => {
    try {
      const [events, news, ships] = await Promise.all([aggregateEvents(registry), readProvider(registry, 'news'), readProvider(registry, 'ships')]);
      res.json(buildChokepoints({ events, news: arrayValue(news), ships: arrayValue(ships) }));
    } catch (error) { next(error); }
  });
  app.get('/api/situational/risk', async (_req, res, next) => {
    try {
      const [events, conflicts, news, ships] = await Promise.all([aggregateEvents(registry), readProvider(registry, 'acled'), readProvider(registry, 'news'), readProvider(registry, 'ships')]);
      const countries = buildCountries({ conflicts: arrayValue(conflicts), events, news: arrayValue(news) });
      const chokepoints = buildChokepoints({ events, news: arrayValue(news), ships: arrayValue(ships) });
      res.json(buildStrategicRisk(countries, chokepoints, events));
    } catch (error) { next(error); }
  });
  app.get('/api/situational/strategic-risk', (req, res) => app.handle({ ...req, url: '/api/situational/risk', method: 'GET' }, res));

  app.get('/api/stream', (_req, res) => pulse.addClient(res));

  app.post('/api/auth/login', loginLimiter, async (req, res) => {
    if (!authConfigurationReady()) return res.status(503).json({ error: 'Admin sign-in is not configured. Set ADMIN_EMAIL, an admin password/hash, and a strong JWT_SECRET on the server.' });
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (email.length > 255 || password.length > 4096) return res.status(400).json({ error: 'Invalid sign-in input.' });
    const expectedEmail = String(process.env.ADMIN_EMAIL).trim().toLowerCase();
    const emailOk = safeEqual(email, expectedEmail);
    const passwordOk = await passwordMatches(password);
    if (!emailOk || !passwordOk) return res.status(401).json({ error: 'Email or password is incorrect.' });
    try {
      const user = { email: expectedEmail, name: process.env.ADMIN_NAME || 'WORLDGPZ Administrator', role: 'admin' };
      const token = issueToken(user);
      res.cookie(SESSION_COOKIE, token, cookieOptions());
      res.json({ user, expiresIn: 86_400 });
    } catch (error) { res.status(503).json({ error: error.message }); }
  });
  app.get('/api/auth/me', (req, res) => {
    const cookieHeader = req.headers.cookie || '';
    const cookie = cookieHeader.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`));
    const token = cookie ? decodeURIComponent(cookie.slice(SESSION_COOKIE.length + 1)) : '';
    const payload = verifyToken(token);
    if (!payload || payload.role !== 'admin') return res.status(401).json({ error: 'Not signed in.' });
    res.json({ user: { email: payload.sub, name: payload.name, role: payload.role } });
  });
  app.post('/api/auth/logout', (_req, res) => {
    res.clearCookie(SESSION_COOKIE, { ...cookieOptions(), maxAge: undefined });
    res.json({ ok: true });
  });

  app.get('/api/admin', authMiddleware, (_req, res) => {
    const providers = registry.getHealthReport();
    res.json({ status: 'ok', uptime: Math.floor((Date.now() - startedAt) / 1000), memory: process.memoryUsage(), providers, database: store?.persistent ? 'postgresql' : 'memory-only' });
  });
  app.get('/api/admin/providers', authMiddleware, (_req, res) => res.json({ providers: registry.getHealthReport() }));
  app.post('/api/admin/providers/:name/refresh', authMiddleware, async (req, res) => {
    const provider = registry.get(String(req.params.name));
    if (!provider) return res.status(404).json({ error: 'Provider not found.' });
    const result = await provider.fetch({ force: true });
    res.json({ name: provider.name, status: provider.status, latencyMs: provider.latencyMs, dataPoints: Array.isArray(result.data) ? result.data.length : result.data ? 1 : 0, error: result.error || null });
  });
  app.get('/api/admin/logs', authMiddleware, (_req, res) => res.json({ logs: [], message: 'Provider errors are available in the source-health panel and current provider report.' }));

  app.get('/api/admin/keys', authMiddleware, (_req, res) => {
    const keys = API_KEY_DEFINITIONS.map((definition) => {
      const source = vault.source(definition.keyName);
      const value = vault.get(definition.keyName);
      const metadata = vault.getMetadata(definition.keyName);
      return {
        ...definition, placeholder: 'Paste provider credential',
        value: value ? `${value.slice(0, 3)}${'•'.repeat(Math.min(Math.max(value.length - 7, 1), 18))}${value.slice(-4)}` : '',
        hasValue: Boolean(value), source, environmentManaged: source === 'environment',
        status: metadata.status || registry.get(definition.provider)?.status || 'pending',
        lastTestedAt: metadata.lastTestedAt, lastTestResult: metadata.lastTestResult,
        latencyMs: metadata.latencyMs || 0, errorMessage: metadata.errorMessage || null,
      };
    }).sort((a, b) => a.sortOrder - b.sortOrder);
    const stats = {
      total: keys.length, configured: keys.filter((key) => key.hasValue).length,
      online: keys.filter((key) => key.status === 'online').length,
      degraded: keys.filter((key) => key.status === 'degraded').length,
      offline: keys.filter((key) => key.status === 'offline').length,
      pending: keys.filter((key) => key.status === 'pending' || key.status === 'unconfigured').length,
    };
    res.json({ keys, stats, persistence: vault.persistenceMode, note: vault.persistenceMode === 'memory' ? 'Credential changes are encrypted in process memory only because PostgreSQL is not configured.' : 'Credentials are encrypted before PostgreSQL storage.' });
  });
  app.post('/api/admin/keys', authMiddleware, async (req, res, next) => {
    const entries = req.body?.keys;
    if (!Array.isArray(entries) || entries.length > 30) return res.status(400).json({ error: 'Expected a keys array with at most 30 entries.' });
    try {
      const results = [];
      for (const entry of entries) {
        const keyName = String(entry?.keyName || '');
        const definition = KEY_DEFINITION_BY_NAME.get(keyName);
        const value = typeof entry?.value === 'string' ? entry.value.trim() : '';
        if (!definition) { results.push({ keyName, action: 'rejected', error: 'Unknown credential name.' }); continue; }
        if (!value) { results.push({ keyName, action: 'ignored', error: 'Blank values are not saved. Use Remove to delete stored credentials.' }); continue; }
        if (value.length > 4096 || /[\r\n]/.test(value)) { results.push({ keyName, action: 'rejected', error: 'Credential value is too long or contains line breaks.' }); continue; }
        await vault.save(definition, value);
        results.push({ keyName, action: 'saved', activeSource: vault.source(keyName), persistence: vault.persistenceMode });
      }
      for (const { keyName } of entries) {
        const definition = KEY_DEFINITION_BY_NAME.get(String(keyName || ''));
        if (definition) registry.get(definition.provider)?.invalidate();
      }
      res.json({ results, message: `${results.filter((item) => item.action === 'saved').length} credential(s) saved.`, persistence: vault.persistenceMode });
    } catch (error) { next(error); }
  });
  app.post('/api/admin/keys/test/:provider', authMiddleware, async (req, res) => {
    const providerName = String(req.params.provider);
    const provider = registry.get(providerName);
    if (!provider) return res.status(404).json({ error: `Provider '${providerName}' not found.` });
    provider.invalidate();
    const result = await provider.fetch({ force: true });
    const dataPoints = Array.isArray(result.data) ? result.data.length : result.data ? 1 : 0;
    const outcome = { status: provider.status, latencyMs: provider.latencyMs, dataPoints, error: result.error || provider.lastError || null, testedAt: new Date().toISOString() };
    for (const definition of API_KEY_DEFINITIONS.filter((item) => item.provider === providerName)) await vault.setTestResult(definition, outcome);
    res.json({ provider: providerName, ...outcome });
  });
  app.post('/api/admin/keys/test-all', authMiddleware, async (_req, res) => {
    const results = await registry.refreshAll({ force: true, concurrency: 3 });
    for (const [providerName, result] of Object.entries(results)) {
      for (const definition of API_KEY_DEFINITIONS.filter((item) => item.provider === providerName)) await vault.setTestResult(definition, { ...result, testedAt: new Date().toISOString() });
    }
    res.json({ results, testedAt: new Date().toISOString() });
  });
  app.delete('/api/admin/keys/:keyName', authMiddleware, async (req, res, next) => {
    const definition = KEY_DEFINITION_BY_NAME.get(String(req.params.keyName));
    if (!definition) return res.status(404).json({ error: 'Credential not found.' });
    try {
      await vault.delete(definition);
      registry.get(definition.provider)?.invalidate();
      res.json({ keyName: definition.keyName, action: 'deleted', activeSource: vault.source(definition.keyName) });
    } catch (error) { next(error); }
  });

  app.get('/api/config', (_req, res) => res.json({
    author: 'ThaddeusTechz', version: '2.0.0', authConfigured: authConfigurationReady(),
    trackedCities: WEATHER_CITIES.length,
  }));

  app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found.' }));

  // Vite build output is served in production; browser routes fall back to index.html.
  app.use(express.static(CLIENT_DIST, { index: false, maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0 }));
  app.get('*', (req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(CLIENT_DIST, 'index.html'), (error) => {
      if (error) res.status(404).send('Build the client with npm run build before opening the application.');
    });
  });
  app.use(errorHandler);
  return app;
}
