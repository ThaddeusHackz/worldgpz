import { BASELINE_WATCHPOINTS } from '../data/baseline.js';
import { buildChokepoints, buildCountries } from './situational.js';

const EVENT_PROVIDERS = ['usgs', 'eonet', 'acled', 'firms', 'reliefweb'];
const MCP_VERSION = '2025-03-26';

const boundedLimit = (value, fallback = 30) => Math.max(1, Math.min(100, Number.parseInt(String(value ?? fallback), 10) || fallback));
const asArray = (value) => Array.isArray(value) ? value : [];

async function providerData(registry, name) {
  const provider = registry.get(name);
  if (!provider) return [];
  const result = await provider.fetch();
  return result?.data;
}

async function eventFeed(registry) {
  const results = await Promise.allSettled(EVENT_PROVIDERS.map((name) => providerData(registry, name)));
  const events = results.flatMap((result) => result.status === 'fulfilled' ? asArray(result.value) : []);
  const unique = new Map();
  for (const event of [...events, ...BASELINE_WATCHPOINTS]) {
    if (!event?.title) continue;
    const key = event.external_id ? `${event.source || ''}:${event.external_id}` : `${event.id || event.title}`;
    if (!unique.has(key)) unique.set(key, event);
  }
  return [...unique.values()].sort((left, right) => (Number(right.time) || Date.parse(right.publishedAt) || 0) - (Number(left.time) || Date.parse(left.publishedAt) || 0));
}

export const MCP_TOOLS = [
  {
    name: 'get_latest_events',
    description: 'Read recent public event and hazard records. Editorial context points are explicitly labeled and are not live reports.',
    inputSchema: { type: 'object', properties: { type: { type: 'string', enum: ['seismic', 'natural', 'conflict', 'fire', 'infrastructure'] }, severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'info'] }, search: { type: 'string', maxLength: 100 }, limit: { type: 'integer', minimum: 1, maximum: 100 } }, additionalProperties: false },
    run: async (registry, args) => {
      let events = await eventFeed(registry);
      if (args.type) events = events.filter((event) => event.type === args.type);
      if (args.severity) events = events.filter((event) => event.severity === args.severity);
      if (args.search) { const term = String(args.search).trim().slice(0, 100).toLowerCase(); events = events.filter((event) => `${event.title} ${event.description || ''} ${event.country || ''}`.toLowerCase().includes(term)); }
      return { events: events.slice(0, boundedLimit(args.limit)), total: events.length, generatedAt: new Date().toISOString() };
    },
  },
  {
    name: 'get_news_headlines',
    description: 'Read recent source-linked headlines from configured news providers.',
    inputSchema: { type: 'object', properties: { search: { type: 'string', maxLength: 100 }, limit: { type: 'integer', minimum: 1, maximum: 100 } }, additionalProperties: false },
    run: async (registry, args) => {
      let articles = asArray(await providerData(registry, 'news'));
      if (args.search) { const term = String(args.search).trim().slice(0, 100).toLowerCase(); articles = articles.filter((article) => `${article.title} ${article.description || ''} ${article.region || ''}`.toLowerCase().includes(term)); }
      return { articles: articles.slice(0, boundedLimit(args.limit, 40)), total: articles.length, generatedAt: new Date().toISOString() };
    },
  },
  {
    name: 'get_provider_health',
    description: 'Return configured provider availability, freshness metadata and current errors without revealing credentials.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    run: async (registry) => ({ providers: registry.getHealthReport(), generatedAt: new Date().toISOString() }),
  },
  {
    name: 'get_country_risk_signals',
    description: 'Return transparent heuristic scores for the supported country set. Scores are not official ratings, forecasts or operational advice.',
    inputSchema: { type: 'object', properties: { country: { type: 'string', maxLength: 100 } }, additionalProperties: false },
    run: async (registry, args) => {
      const [conflicts, events, news] = await Promise.all([providerData(registry, 'acled'), eventFeed(registry), providerData(registry, 'news')]);
      let countries = buildCountries({ conflicts: asArray(conflicts), events, news: asArray(news) });
      if (args.country) countries = countries.filter((country) => country.name.toLowerCase() === String(args.country).trim().toLowerCase());
      return { countries, method: 'heuristic baseline plus available feed counts', caveat: 'Not an official risk rating or forecast.', generatedAt: new Date().toISOString() };
    },
  },
  {
    name: 'get_chokepoint_signals',
    description: 'Return signal-derived strategic waterway watchpoints. Status does not prove a closure or live vessel disruption.',
    inputSchema: { type: 'object', properties: { name: { type: 'string', maxLength: 100 } }, additionalProperties: false },
    run: async (registry, args) => {
      const [events, news, ships] = await Promise.all([eventFeed(registry), providerData(registry, 'news'), providerData(registry, 'ships')]);
      let points = buildChokepoints({ events, news: asArray(news), ships: asArray(ships) });
      if (args.name) points = points.filter((point) => point.name.toLowerCase() === String(args.name).trim().toLowerCase());
      return { chokepoints: points, caveat: 'Signal-derived watch status; not vessel-traffic telemetry or verified route closure.', generatedAt: new Date().toISOString() };
    },
  },
  {
    name: 'get_market_quotes',
    description: 'Read configured market quotes. Availability depends on provider entitlements and deployment credentials.',
    inputSchema: { type: 'object', properties: { limit: { type: 'integer', minimum: 1, maximum: 100 } }, additionalProperties: false },
    run: async (registry, args) => ({ quotes: asArray(await providerData(registry, 'markets')).slice(0, boundedLimit(args.limit, 40)), generatedAt: new Date().toISOString() }),
  },
  {
    name: 'get_prediction_markets',
    description: 'Read available prediction-market records. These probabilities are market opinions, not verified event forecasts.',
    inputSchema: { type: 'object', properties: { limit: { type: 'integer', minimum: 1, maximum: 100 } }, additionalProperties: false },
    run: async (registry, args) => ({ markets: asArray(await providerData(registry, 'predictions')).slice(0, boundedLimit(args.limit, 40)), generatedAt: new Date().toISOString() }),
  },
].map(({ run, ...definition }) => ({ ...definition, annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }, run }));

export function listMcpTools() {
  return MCP_TOOLS.map(({ run: _run, ...tool }) => tool);
}

export async function handleMcpMessage(registry, message) {
  if (!message || typeof message !== 'object' || Array.isArray(message) || message.jsonrpc !== '2.0' || typeof message.method !== 'string' || (Object.hasOwn(message, 'id') && !['string', 'number'].includes(typeof message.id) && message.id !== null)) {
    return { error: { code: -32600, message: 'Invalid JSON-RPC 2.0 request.' } };
  }
  const isNotification = !Object.hasOwn(message, 'id');
  if (message.method === 'notifications/initialized') return { notification: true };
  if (message.method === 'ping') return { result: {} };
  if (message.method === 'initialize') {
    return { result: {
      protocolVersion: MCP_VERSION,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: 'worldgpz', version: '2.0.0' },
      instructions: 'Read-only public situational data by ThaddeusTechz. Provider access and data freshness vary; heuristic scores are clearly labeled.',
    } };
  }
  if (message.method === 'tools/list') return { result: { tools: listMcpTools() } };
  if (message.method === 'tools/call') {
    const name = message.params?.name;
    const tool = MCP_TOOLS.find((candidate) => candidate.name === name);
    if (!tool) return { result: { content: [{ type: 'text', text: `Unknown tool: ${String(name || '')}` }], isError: true } };
    const args = message.params?.arguments ?? {};
    if (!args || typeof args !== 'object' || Array.isArray(args)) return { error: { code: -32602, message: 'Tool arguments must be an object.' } };
    try {
      const structuredContent = await tool.run(registry, args);
      return { result: { content: [{ type: 'text', text: JSON.stringify(structuredContent) }], structuredContent, isError: false } };
    } catch (error) {
      return { result: { content: [{ type: 'text', text: error?.message || 'Tool execution failed.' }], isError: true } };
    }
  }
  if (isNotification) return { notification: true };
  return { error: { code: -32601, message: `Method not found: ${message.method}` } };
}

export const MCP_PROTOCOL_VERSION = MCP_VERSION;
