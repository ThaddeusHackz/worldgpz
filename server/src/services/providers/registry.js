import { USGSProvider, EONETProvider, GDELTProvider, SWPCProvider, ReliefWebProvider } from './base-providers.js';
import { WeatherProvider } from './weather.js';
import { NewsProvider } from './news.js';
import { MarketsProvider } from './markets.js';
import { ACLEDProvider } from './acled.js';
import { FlightsProvider } from './flights.js';
import { FIRMSProvider } from './firms.js';
import { ShipsProvider } from './ships.js';
import { EnergyProvider } from './energy.js';
import { MacroProvider } from './macro.js';
import { YouTubeProvider, WindyProvider } from './media.js';
import { AIProvider } from './ai.js';
import { ISSProvider } from './iss.js';

const DEFAULT_REFRESH_MS = {
  usgs: 5 * 60_000, eonet: 10 * 60_000, gdelt: 10 * 60_000, swpc: 5 * 60_000,
  reliefweb: 15 * 60_000, weather: 15 * 60_000, acled: 60 * 60_000,
  firms: 6 * 60 * 60_000, flights: 30_000, ships: 30_000, markets: 60_000,
  energy: 60 * 60_000, macro: 60 * 60_000, windy: 60 * 60_000,
  youtube: 3 * 60 * 60_000, openai: 30 * 60_000, news: 15 * 60_000, iss: 15_000,
};

export class ProviderRegistry {
  constructor() { this.providers = new Map(); this.timers = new Set(); }
  register(provider, intervalMs = DEFAULT_REFRESH_MS[provider.name]) {
    this.providers.set(provider.name, provider);
    return { provider, intervalMs };
  }
  get(name) { return this.providers.get(name); }
  getAll() { return [...this.providers.values()]; }
  getHealthReport() { return this.getAll().map((provider) => provider.getHealth()); }
  getData(name) { return this.get(name)?.data ?? null; }

  static createDefault({ secretResolver } = {}) {
    const registry = new ProviderRegistry();
    const providers = [
      new USGSProvider(), new EONETProvider(), new GDELTProvider(), new SWPCProvider(),
      new ReliefWebProvider(), new WeatherProvider(), new NewsProvider(), new ACLEDProvider(),
      new FlightsProvider(), new ShipsProvider(), new FIRMSProvider(), new MarketsProvider(),
      new EnergyProvider(), new MacroProvider(), new WindyProvider(), new YouTubeProvider(),
      new ISSProvider(),
    ];
    for (const provider of providers) {
      provider.setSecretResolver(secretResolver);
      registry.register(provider);
    }
    const ai = new AIProvider(async () => {
      const news = registry.get('news');
      const result = await news.fetch();
      return result.data || [];
    });
    ai.setSecretResolver(secretResolver);
    registry.register(ai);
    return registry;
  }

  startRefreshCycles({ staggerMs = 1_200 } = {}) {
    this.getAll().forEach((provider, index) => {
      const interval = DEFAULT_REFRESH_MS[provider.name];
      const initialTimer = setTimeout(() => {
        provider.fetch().catch(() => {});
        const timer = setInterval(() => provider.fetch().catch(() => {}), interval);
        timer.unref?.();
        this.timers.add(timer);
      }, index * staggerMs);
      initialTimer.unref?.();
      this.timers.add(initialTimer);
    });
  }

  async refreshAll({ force = true, concurrency = 4 } = {}) {
    const providers = this.getAll();
    const results = {};
    let cursor = 0;
    const worker = async () => {
      while (cursor < providers.length) {
        const provider = providers[cursor++];
        const result = await provider.fetch({ force });
        results[provider.name] = { status: provider.status, latencyMs: provider.latencyMs, dataPoints: Array.isArray(result.data) ? result.data.length : result.data ? 1 : 0, error: result.error || null };
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, providers.length) }, worker));
    return results;
  }

  stop() {
    for (const timer of this.timers) { clearInterval(timer); clearTimeout(timer); }
    this.timers.clear();
    this.get('ships')?.stop();
  }
}
