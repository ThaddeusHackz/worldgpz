/**
 * GridPulse — the autonomous heartbeat of GOD'S EYE.
 *
 * Continuously re-acquires every configured feed in the background so the
 * public dashboard is always served from hot caches (this also keeps
 * serverless containers warm), diffs each acquisition against the previous
 * one to detect genuinely NEW signals, and pushes both heartbeats and fresh
 * intercepts to realtime subscribers (server-sent events).
 */
export class GridPulse {
  constructor({ config, liveSources, providers, media }) {
    this.config = config;
    this.liveSources = liveSources;
    this.providers = providers;
    this.media = media;
    this.timer = null;
    this.startedAt = null;
    this.lastBeatAt = null;
    this.beatCount = 0;
    this.lastError = null;
    this.feeds = null;
    this.listeners = new Set();
    this.knownSignalIds = new Set();
    this.primed = false;
    this.intervalMs = Math.max(
      60_000,
      (config.sourceCacheSeconds - 30) * 1000 || 270_000,
    );
  }

  start() {
    this.startedAt = new Date().toISOString();
    // First beat immediately (warms every cache before first page view).
    void this.#beat();
    this.timer = setInterval(() => void this.#beat(), this.intervalMs);
    this.timer.unref?.();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.listeners.clear();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  #emit(event, payload) {
    for (const listener of this.listeners) {
      try {
        listener(event, payload);
      } catch {
        this.listeners.delete(listener);
      }
    }
  }

  async #beat() {
    try {
      const snapshot = await this.liveSources.snapshot({ fresh: true });
      const media = await this.media
        .list()
        .catch(() => ({ liveCount: 0, channels: [] }));
      if (this.providers) {
        // Providers refresh themselves debounced on access; poke each once so
        // configured keys stay hot between beats.
        await Promise.allSettled(
          [
            this.providers.webcams(),
            this.providers.markets(),
            this.providers.fires(),
            this.providers.conflicts(),
            this.providers.ships(),
            this.providers.flights(),
            this.providers.outages(),
            this.providers.energy(),
            this.providers.macro(),
            this.providers.weather(),
          ].map((task) => task.catch(() => null)),
        );
      }
      this.feeds = {
        earthquakes: snapshot.earthquakes?.length || 0,
        weather: snapshot.weather?.length || 0,
        naturalEvents: snapshot.natural?.length || 0,
        worldNews: snapshot.globalNews?.length || 0,
        reports: snapshot.news?.length || 0,
        liveChannels: media.liveCount || 0,
      };

      // Diff against the previous acquisition: brand-new signal IDs are
      // broadcast as live intercepts over SSE.
      const current = [
        ...(snapshot.earthquakes || []),
        ...(snapshot.weather || []),
        ...(snapshot.natural || []),
        ...(snapshot.globalNews || []),
      ];
      const fresh = [];
      for (const signal of current) {
        if (!this.knownSignalIds.has(signal.id)) fresh.push(signal);
      }
      if (!this.primed) {
        // First beat establishes the baseline without flooding clients.
        this.primed = true;
      } else if (fresh.length) {
        this.#emit("signals", fresh.slice(0, 8));
      }
      this.knownSignalIds = new Set(current.map((item) => item.id));

      this.lastError = null;
    } catch (error) {
      this.lastError = error?.message || "heartbeat error";
    } finally {
      this.beatCount += 1;
      this.lastBeatAt = new Date().toISOString();
      this.#emit("pulse", this.view());
      if (this.config.env !== "test") {
        console.log(
          JSON.stringify({
            level: "info",
            message: "grid-pulse",
            beat: this.beatCount,
            feeds: this.feeds,
            at: this.lastBeatAt,
          }),
        );
      }
    }
  }

  /** Public-safe heartbeat view (no credentials, no infrastructure detail). */
  view() {
    return {
      alive: true,
      autonomous: true,
      startedAt: this.startedAt,
      lastBeatAt: this.lastBeatAt,
      beatCount: this.beatCount,
      intervalSeconds: Math.round(this.intervalMs / 1000),
      feeds: this.feeds,
      lastError: this.lastError,
    };
  }
}
