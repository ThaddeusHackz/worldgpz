const STATUS_MESSAGES = {
  400: "request was rejected",
  401: "credentials were rejected",
  403: "credentials or permissions were rejected",
  404: "endpoint was not found",
  408: "request timed out",
  409: "request conflicted with provider state",
  429: "quota or rate limit was reached",
};

function errorCodeFor(error) {
  if (error?.code) return error.code;
  if (
    error?.name === "AbortError" ||
    error?.name === "TimeoutError" ||
    /timed?\s*out|aborted due to timeout/i.test(String(error?.message || ""))
  ) {
    return "timeout";
  }
  const status = Number(error?.status);
  if (status === 401 || status === 403) return "credential-rejected";
  if (status === 429) return "quota-exceeded";
  if (status === 400) return "invalid-request";
  if (status >= 500) return "upstream-unavailable";
  return "provider-error";
}

/**
 * Shared foundation for all extended data-provider adapters.
 *
 * Every adapter:
 * - reads credentials from `config` only (never from the browser),
 * - reports `not-configured` without making network calls when no key is set,
 * - coalesces concurrent refreshes and caches successful responses,
 * - holds failures briefly so provider recovery is detected quickly,
 * - emits public-safe error codes without returning upstream bodies or secrets.
 */
export class ProviderBase {
  constructor(
    config,
    {
      name,
      group = "Data",
      cacheSeconds = 300,
      timeoutMs,
      fetchFn = globalThis.fetch,
    } = {},
  ) {
    this.config = config;
    this.name = name;
    this.group = group;
    this.cacheSeconds = cacheSeconds;
    this.timeoutMs = timeoutMs || config.fetchTimeoutMs || 8_000;
    this.fetchFn = fetchFn;
    this.cache = null;
    this.cachedAt = 0;
    this.inFlight = null;
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
    const timeoutMs = options.timeoutMs || this.timeoutMs;
    const { timeoutMs: _ignored, ...requestOptions } = options;
    const response = await this.fetchFn(url, {
      ...requestOptions,
      signal: requestOptions.signal || AbortSignal.timeout(timeoutMs),
      headers: {
        "User-Agent": "WORLDGPZ/2.1 (source-attributed monitoring dashboard)",
        Accept: "application/json",
        ...requestOptions.headers,
      },
    });
    if (!response.ok) {
      // Read only a bounded diagnostic fragment. It is never returned publicly,
      // but is useful in server logs/tests and lets adapters classify failures.
      const diagnostic = await response
        .clone()
        .text()
        .then((text) => text.replace(/\s+/g, " ").slice(0, 240))
        .catch(() => "");
      const phrase =
        STATUS_MESSAGES[response.status] ||
        (response.status >= 500
          ? "service is temporarily unavailable"
          : `returned HTTP ${response.status}`);
      const error = new Error(`${this.name} ${phrase}`);
      error.status = response.status;
      error.code = errorCodeFor(error);
      error.diagnostic = diagnostic;
      throw error;
    }
    return response;
  }

  async fetchJson(url, options = {}) {
    const response = await this.#request(url, options);
    try {
      return await response.json();
    } catch {
      const error = new Error(`${this.name} returned invalid JSON`);
      error.code = "invalid-response";
      throw error;
    }
  }

  async fetchText(url, options = {}) {
    const response = await this.#request(url, options);
    return response.text();
  }

  async fetchForm(url, parameters, options = {}) {
    const response = await this.#request(url, {
      ...options,
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        ...options.headers,
      },
      body: new URLSearchParams(parameters),
    });
    try {
      return await response.json();
    } catch {
      const error = new Error(
        `${this.name} returned invalid authentication data`,
      );
      error.code = "invalid-response";
      throw error;
    }
  }

  #safeMessage(error) {
    const code = errorCodeFor(error);
    const messages = {
      timeout: `${this.name} timed out; a smaller coverage window will be retried`,
      "credential-rejected": `${this.name} rejected the configured credentials or permissions`,
      "quota-exceeded": `${this.name} quota or rate limit was reached`,
      "invalid-request": `${this.name} rejected the request contract`,
      "upstream-unavailable": `${this.name} is temporarily unavailable upstream`,
      "invalid-response": `${this.name} returned an unexpected response`,
    };
    return (
      messages[code] || String(error?.message || "Provider unavailable")
    ).slice(0, 160);
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

  async #refresh() {
    const startedAt = Date.now();
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
      const ttl = this.cacheSeconds * 1000;
      const errorHoldMs = Math.min(ttl, 120_000);
      this.cache = {
        configured: true,
        status: "degraded",
        name: this.name,
        group: this.group,
        checkedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
        errorCode: errorCodeFor(error),
        error: this.#safeMessage(error),
      };
      // Hold the error briefly, not for the full success TTL.
      this.cachedAt = Date.now() - Math.max(0, ttl - errorHoldMs);
    }
    return this.cache;
  }

  /**
   * Returns the cached-or-fresh provider payload. It never throws: failures
   * become a stable `degraded` response so one provider cannot break the app.
   */
  async snapshot({ fresh = false } = {}) {
    if (!this.configured) return this.notConfigured();

    const ttl = this.cacheSeconds * 1000;
    const now = Date.now();
    if (!fresh && this.cache && now - this.cachedAt < ttl) return this.cache;
    if (this.inFlight) return this.inFlight;

    this.inFlight = this.#refresh().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  /** Compact public-safe health view; large provider payloads stay off /providers. */
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

    const summaryKeys = [
      "latencyMs",
      "error",
      "errorCode",
      "total",
      "detections",
      "outages",
      "anomalies",
      "vesselCount",
      "messageCount",
      "liveCount",
      "window",
      "coverage",
      "lastMessageAt",
      "providerNotice",
    ];
    const view = {
      configured: true,
      status: this.cache.status,
      name: this.name,
      group: this.group,
      checkedAt: this.cache.checkedAt || null,
    };
    for (const key of summaryKeys) {
      if (this.cache[key] !== undefined) view[key] = this.cache[key];
    }
    return view;
  }
}

export { errorCodeFor };
