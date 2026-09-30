export class BaseProvider {
  constructor(name, { ttlMs = 300_000, requiredKeys = [], emptyValue = [] } = {}) {
    this.name = name;
    this.ttlMs = ttlMs;
    this.requiredKeys = requiredKeys;
    this.emptyValue = emptyValue;
    this.status = 'idle';
    this.data = null;
    this.cacheExpiry = 0;
    this.lastSuccess = null;
    this.lastError = null;
    this.latencyMs = 0;
    this.inFlight = null;
    this.secretResolver = null;
  }

  setSecretResolver(resolver) {
    this.secretResolver = resolver;
  }

  secret(key) {
    return this.secretResolver ? this.secretResolver(key) : process.env[key];
  }

  get isConfigured() {
    return this.requiredKeys.every((key) => Boolean(this.secret(key)));
  }

  async fetch({ force = false } = {}) {
    if (!this.isConfigured) {
      this.status = 'unconfigured';
      this.lastError = `Missing configuration: ${this.requiredKeys.filter((key) => !this.secret(key)).join(', ')}`;
      return { data: this.data ?? this.emptyValue, configured: false, cached: Boolean(this.data), error: this.lastError };
    }

    if (!force && this.data !== null && Date.now() < this.cacheExpiry) {
      return { data: this.data, configured: true, cached: true, stale: false };
    }
    if (this.inFlight) return this.inFlight;

    this.inFlight = this.#fetchFresh();
    try {
      return await this.inFlight;
    } finally {
      this.inFlight = null;
    }
  }

  async #fetchFresh() {
    this.status = 'loading';
    const started = Date.now();
    try {
      const data = await this._fetchFresh();
      if (data === undefined || data === null) throw new Error('Provider returned no data');
      this.data = data;
      this.cacheExpiry = Date.now() + this.ttlMs;
      this.lastSuccess = Date.now();
      this.lastError = null;
      this.latencyMs = Date.now() - started;
      this.status = data?.fallback || data?.partial ? 'degraded' : 'online';
      return { data, configured: true, cached: false, stale: false };
    } catch (error) {
      this.lastError = this.#safeError(error);
      this.latencyMs = Date.now() - started;
      this.status = this.data !== null ? 'degraded' : 'offline';
      return {
        data: this.data ?? this.emptyValue,
        configured: true,
        cached: this.data !== null,
        stale: this.data !== null,
        error: this.lastError,
      };
    }
  }

  #safeError(error) {
    // Upstream URLs sometimes include credentials in query strings. Never retain those in health output.
    return String(error?.message || 'Provider request failed')
      .replace(/([?&](?:api_key|apikey|key|token|appid|apiKey)=)[^&\s]+/gi, '$1[redacted]')
      .slice(0, 240);
  }

  async _fetchFresh() {
    throw new Error('Provider implementation is missing');
  }

  invalidate() {
    this.cacheExpiry = 0;
    this.lastError = null;
    if ('token' in this) this.token = null;
    if ('tokenExpiry' in this) this.tokenExpiry = 0;
  }

  getHealth() {
    return {
      name: this.name,
      status: this.status,
      latencyMs: this.latencyMs,
      lastSuccess: this.lastSuccess ? new Date(this.lastSuccess).toISOString() : null,
      lastError: this.lastError,
      configured: this.isConfigured,
      cached: this.data !== null,
      dataPoints: Array.isArray(this.data) ? this.data.length : this.data ? 1 : 0,
    };
  }
}
