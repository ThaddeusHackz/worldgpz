import { ProviderBase } from "./base.js";

/**
 * Finnhub — equities, indices, and crypto quotes for the markets panel.
 * Docs: https://finnhub.io/docs/api/quote
 * Auth: `token` query parameter.
 */
const WATCHLIST = [
  // Finnhub's free quote plan does not return the caret-prefixed index symbols
  // used by some finance APIs. Liquid US-listed ETFs provide reliable,
  // explicitly labelled index proxies on the same endpoint.
  { symbol: "SPY", name: "S&P 500 (SPY proxy)", type: "ETF" },
  { symbol: "QQQ", name: "Nasdaq 100 (QQQ proxy)", type: "ETF" },
  { symbol: "DIA", name: "Dow Jones (DIA proxy)", type: "ETF" },
  { symbol: "EWU", name: "United Kingdom (EWU proxy)", type: "ETF" },
  { symbol: "EWG", name: "Germany (EWG proxy)", type: "ETF" },
  { symbol: "EWJ", name: "Japan (EWJ proxy)", type: "ETF" },
  { symbol: "USO", name: "WTI crude (USO proxy)", type: "ETF" },
  { symbol: "BINANCE:BTCUSDT", name: "Bitcoin / USD", type: "Crypto" },
];

export class FinnhubService extends ProviderBase {
  constructor(config, options = {}) {
    super(config, {
      name: "Finnhub",
      group: "Markets",
      cacheSeconds: 120,
      ...options,
    });
  }

  get configured() {
    return Boolean(this.config.finnhubApiKey);
  }

  async #quote(item) {
    const url = new URL("https://finnhub.io/api/v1/quote");
    url.searchParams.set("symbol", item.symbol);
    url.searchParams.set("token", this.config.finnhubApiKey);
    const payload = await this.fetchJson(url);
    return {
      symbol: item.symbol,
      name: item.name,
      type: item.type,
      current: typeof payload.c === "number" ? payload.c : null,
      change: typeof payload.d === "number" ? payload.d : null,
      changePercent: typeof payload.dp === "number" ? payload.dp : null,
      high: typeof payload.h === "number" ? payload.h : null,
      low: typeof payload.l === "number" ? payload.l : null,
      open: typeof payload.o === "number" ? payload.o : null,
      prevClose: typeof payload.pc === "number" ? payload.pc : null,
      timestamp: payload.t ? new Date(payload.t * 1000).toISOString() : null,
    };
  }

  async collect() {
    const settled = await Promise.allSettled(
      WATCHLIST.map((item) => this.#quote(item)),
    );
    const quotes = [];
    for (const result of settled) {
      if (result.status === "fulfilled" && result.value.current != null)
        quotes.push(result.value);
    }
    if (!quotes.length) throw new Error("Finnhub returned no valid quotes");
    return {
      quotes,
      total: quotes.length,
      marketNote:
        "Quotes are indicative and delayed; verify against the exchange.",
    };
  }
}
