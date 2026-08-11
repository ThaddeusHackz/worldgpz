/**
 * Shared foundation for all extended data-provider adapters.
 *
 * Every adapter:
 * - reads its credential from `config` only (never from the browser),
 * - reports `not-configured` without making network calls when no key is set,
 * - caches successful responses for `cacheSeconds` to protect provider quotas,
 * - caches failures for at most 120 seconds so recovery is fast,
 * - returns a stable public shape: `{ configured, status, checkedAt, ...data }`.
 */
export class ProviderBase {
  constructor(
    config,
    {
      name,
      group = "Data",
      cacheSeconds = 300,
      fetchFn = globalThis.fetch,
    } = {},
  ) {
    this.config = config;
    this.name = name;
    this.group = group;
    this.cacheSeconds = cacheSeconds;
    this.fetchFn = fetchFn;
    this.cache = null;
    this.cachedAt = 0;
  }

  /** Override: true when the required credential is present. */
  get configured() {
    return false;
  }

  /** Override: fetch and shape the provider payload. */
  async collect() {
    throw new Error(`${this.name} adapter does not implement collect()`);
  }

  async #request(url, options = {}) {
    const response = await this.fetchFn(url, {
      ...options,
      signal:
        options.signal ||
        AbortSignal.timeout(this.config.fetchTimeoutMs || 8_000),
      headers: {
        "User-Agent": "WORLDGPZ/2.0 (public monitoring dashboard)",
        Accept: "application/json",
        ...options.headers,
      },
    });
    if (!response.ok) {
      const error = new Error(
        `${this.name} provider returned ${response.status}`,
      );
      error.status = response.status;
      throw error;
    }
    return response;
  }

  async fetchJson(url, options = {}) {
    const response = await this.#request(url, options);
    return response.json();
  }

  async fetchText(url, options = {}) {
    const response = await this.#request(url, options);
    return response.text();
  }

  async fetchForm(url, parameters) {
    const response = await this.#request(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(parameters),
    });
    return response.json();
  }

  #safeMessage(error) {
    const message = error?.status
      ? `${this.name} provider returned ${error.status}`
      : String(error?.message || "Unknown provider error");
    return message.slice(0, 140);
  }

  notConfigured() {
    return {
      configured: false,
      status: "not-configured",
      name: this.name,
      group: this.group,
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * Returns the cached-or-fresh provider payload. Never throws: failures are
   * returned as a `degraded` status so the API surface stays stable.
   */
  async snapshot({ fresh = false } = {}) {
    if (!this.configured) return this.notConfigured();

    const ttl = this.cacheSeconds * 1000;
    const now = Date.now();
    if (!fresh && this.cache && now - this.cachedAt < ttl) return this.cache;

    const startedAt = now;
    try {
      const data = await this.collect();
      this.cache = {
        configured: true,
        status: "operational",
        name: this.name,
        group: this.group,
        checkedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
        ...data,
      };
      this.cachedAt = Date.now();
    } catch (error) {
      const errorHoldMs = Math.min(ttl, 120_000);
      this.cache = {
        configured: true,
        status: "degraded",
        name: this.name,
        group: this.group,
        checkedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
        error: this.#safeMessage(error),
      };
      // Hold the error state only briefly so the provider can recover.
      this.cachedAt = Date.now() - (ttl - errorHoldMs);
    }
    return this.cache;
  }

  /** Compact, public-safe status view for the providers registry. */
  statusView() {
    if (!this.configured) return this.notConfigured();
    if (!this.cache)
      return {
        configured: true,
        status: "pending",
        name: this.name,
        group: this.group,
        checkedAt: null,
      };
    return this.cache;
  }
}
