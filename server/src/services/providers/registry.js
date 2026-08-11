import { WindyService } from "./windy.js";
import { FinnhubService } from "./markets.js";
import { FirmsService } from "./firms.js";
import { AcledService } from "./acled.js";
import { EiaService } from "./energy.js";
import { FredService } from "./macro.js";
import { CloudflareService } from "./outages.js";
import { OpenSkyService } from "./flights.js";
import { AisStreamService } from "./ships.js";

/**
 * ProviderRegistry — one object that owns every extended provider adapter,
 * exposes a single public status view (no secrets), merges map-relevant
 * events (fires, conflicts) for the dashboard, and starts the ship relay.
 */
export class ProviderRegistry {
  constructor(config, { media, liveSources, intelligence, ...options } = {}) {
    this.config = config;
    this.media = media;
    this.liveSources = liveSources;
    this.intelligence = intelligence;
    this.windyService = new WindyService(config, options);
    this.marketsService = new FinnhubService(config, options);
    this.firmsService = new FirmsService(config, options);
    this.acledService = new AcledService(config, options);
    this.energyService = new EiaService(config, options);
    this.macroService = new FredService(config, options);
    this.outagesService = new CloudflareService(config, options);
    this.flightsService = new OpenSkyService(config, options);
    this.shipsService = new AisStreamService(config, options);
    this.lastKick = 0;
  }

  #services() {
    return [
      this.windyService,
      this.marketsService,
      this.firmsService,
      this.acledService,
      this.energyService,
      this.macroService,
      this.outagesService,
      this.flightsService,
      this.shipsService,
    ];
  }

  /** Background refresh, debounced, never awaited by requests. */
  #kickOff() {
    const now = Date.now();
    if (now - this.lastKick < 30_000) return;
    this.lastKick = now;
    void Promise.allSettled([
      ...this.#services().map((service) => service.snapshot()),
      this.media?.list(),
      this.liveSources?.snapshot(),
    ]);
  }

  #mediaView() {
    const configured = Boolean(this.config.youtubeApiKey);
    const cache = this.media?.cache;
    if (!configured)
      return {
        id: "youtube",
        name: "YouTube Live",
        group: "Media",
        configured: false,
        status: "not-configured",
        checkedAt: cache?.checkedAt || null,
      };
    if (!cache)
      return {
        id: "youtube",
        name: "YouTube Live",
        group: "Media",
        configured: true,
        status: "pending",
        checkedAt: null,
      };
    return {
      id: "youtube",
      name: "YouTube Live",
      group: "Media",
      configured: true,
      status: cache.status,
      checkedAt: cache.checkedAt,
      liveCount: cache.liveCount ?? null,
    };
  }

  #newsView() {
    const configured = Boolean(this.config.newsApiKey);
    const entry = this.liveSources?.cache?.sourceStatus?.find(
      (source) => source.id === "newsapi",
    );
    if (!configured)
      return {
        id: "news",
        name: "NewsAPI",
        group: "News",
        configured: false,
        status: "not-configured",
        checkedAt: null,
      };
    if (!entry)
      return {
        id: "news",
        name: "NewsAPI",
        group: "News",
        configured: true,
        status: "pending",
        checkedAt: null,
      };
    return {
      id: "news",
      name: "NewsAPI",
      group: "News",
      configured: true,
      status: entry.status,
      checkedAt: this.liveSources.cache.fetchedAt || null,
      fallback: "ReliefWeb",
    };
  }

  #aiView() {
    const configured = Boolean(this.config.ai?.apiKey);
    const operational = Boolean(this.intelligence?.lastSuccessAt);
    return {
      id: "ai",
      name: "AI Briefing",
      group: "Intelligence",
      configured,
      status: !configured
        ? "not-configured"
        : operational
          ? "operational"
          : "pending",
      checkedAt: this.intelligence?.lastSuccessAt || null,
      model: configured ? this.config.ai.model : null,
    };
  }

  /**
   * Public provider status. Returns instantly from cache/state and triggers a
   * debounced background refresh so configured providers populate quickly.
   */
  status() {
    this.#kickOff();
    const views = this.#services().map((service) => ({
      id: service.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      name: service.name,
      group: service.group,
      ...service.statusView(),
    }));
    views.push(
      {
        id: "youtube",
        name: "YouTube Live",
        group: "Media",
        ...this.#mediaView(),
      },
      { id: "news", name: "NewsAPI", group: "News", ...this.#newsView() },
      {
        id: "ai",
        name: "AI Briefing",
        group: "Intelligence",
        ...this.#aiView(),
      },
    );
    return views;
  }

  /** Map-relevant events (NASA FIRMS fires + ACLED conflict) for the dashboard. */
  async events() {
    const [fires, conflicts] = await Promise.allSettled([
      this.firmsService.snapshot(),
      this.acledService.snapshot(),
    ]);
    const events = [];
    if (fires.status === "fulfilled")
      events.push(...(fires.value.events || []));
    if (conflicts.status === "fulfilled")
      events.push(...(conflicts.value.events || []));
    return events;
  }

  webcams() {
    return this.windyService.snapshot();
  }

  markets() {
    return this.marketsService.snapshot();
  }

  fires() {
    return this.firmsService.snapshot();
  }

  conflicts() {
    return this.acledService.snapshot();
  }

  energy() {
    return this.energyService.snapshot();
  }

  macro() {
    return this.macroService.snapshot();
  }

  outages() {
    return this.outagesService.snapshot();
  }

  flights() {
    return this.flightsService.snapshot();
  }

  ships() {
    return this.shipsService.snapshot();
  }

  /** Graceful shutdown for long-running relays. */
  close() {
    this.shipsService.close();
  }
}
