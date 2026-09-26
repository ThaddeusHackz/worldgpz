import { useEffect, useMemo, useRef, useState } from "react";

import { api } from "../lib/api.js";

/**
 * Intelligence panels: the wire, markets pulse, country risk index and
 * chokepoint board. Each panel is driven by the live dashboard payload and
 * states its own basis, so an empty panel explains itself instead of showing
 * placeholder numbers.
 */

const LEVEL_TONE = {
  critical: "critical",
  high: "high",
  elevated: "elevated",
  low: "low",
  disrupted: "critical",
  strained: "high",
  monitoring: "low",
};

function Panel({ kicker, title, basis, children, className = "" }) {
  return (
    <article className={`panel intel-panel ${className}`.trim()}>
      <div className="panel-heading inline">
        <div className="intel-heading-text">
          <span className="panel-kicker">{kicker}</span>
          <h3>{title}</h3>
        </div>
      </div>
      {basis ? <p className="intel-basis">{basis}</p> : null}
      {children}
    </article>
  );
}

function Empty({ children }) {
  return <p className="intel-empty">{children}</p>;
}

/** Scrolling headline wire, modelled on the reference sites' live ticker. */
export function WireTicker({ news = [], events = [] }) {
  const items = useMemo(() => {
    const fromNews = news.map((item) => ({
      id: `wire-news-${item.id ?? item.title}`,
      label: "WIRE",
      text: item.title,
      at: item.publishedAt ?? item.timestamp,
    }));
    const fromEvents = events.slice(0, 24).map((item) => ({
      id: `wire-event-${item.id ?? item.title}`,
      label: (item.severity ?? "signal").toUpperCase(),
      text: item.title,
      at: item.timestamp ?? item.createdAt,
    }));
    return [...fromNews, ...fromEvents].filter((item) => item.text);
  }, [news, events]);

  if (items.length === 0) {
    return (
      <div className="wire-ticker">
        <span className="wire-badge">LIVE</span>
        <span className="wire-empty">
          No headlines in the current snapshot — connect a news key in Admin to
          feed the wire.
        </span>
      </div>
    );
  }

  return (
    <div className="wire-ticker" aria-label="Live headline wire">
      <span className="wire-badge">LIVE</span>
      <div className="wire-track">
        <ul className="wire-list">
          {items.map((item) => (
            <li
              key={item.id}
              className={`wire-item tone-${LEVEL_TONE[item.label.toLowerCase()] ?? "low"}`}
            >
              <span className="wire-label">{item.label}</span>
              <span className="wire-text">{item.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Per-country instability index with pass-to-pass deltas. */
export function RiskIndex({ risk }) {
  const countries = risk?.countries ?? [];
  const regions = risk?.regions ?? [];

  if (countries.length === 0 && regions.length === 0) {
    return (
      <Panel
        kicker="Instability"
        title="Country risk index"
        basis={risk?.basis}
      >
        <Empty>
          No country-attributable signals yet. The index populates from live
          feeds as they report place names.
        </Empty>
      </Panel>
    );
  }

  const rows = countries.length
    ? countries.map((row) => ({ name: row.country, ...row }))
    : regions.map((row) => ({
        ...row,
        name: row.region,
        level:
          row.score >= 70
            ? "critical"
            : row.score >= 45
              ? "high"
              : row.score >= 20
                ? "elevated"
                : "low",
      }));

  return (
    <Panel
      kicker={countries.length ? "Instability" : "Instability · region level"}
      title={countries.length ? "Country risk index" : "Regional risk index"}
      basis={risk?.basis}
      className="risk-panel"
    >
      <ul className="risk-list">
        {rows.map((row) => (
          <li
            key={row.name}
            className={`risk-row tone-${LEVEL_TONE[row.level] ?? "low"}`}
          >
            <span className="risk-name" title={row.name}>
              {row.name}
            </span>
            <span className="risk-bar" aria-hidden="true">
              <span className="risk-fill" style={{ width: `${row.score}%` }} />
            </span>
            <span className="risk-score">{row.score}</span>
            <span
              className={`risk-delta ${row.delta > 0 ? "up" : row.delta < 0 ? "down" : "flat"}`}
            >
              {row.delta == null
                ? "—"
                : row.delta > 0
                  ? `▲${row.delta}`
                  : row.delta < 0
                    ? `▼${Math.abs(row.delta)}`
                    : "■"}
            </span>
          </li>
        ))}
      </ul>
      {countries.length > 0 && countries[0]?.drivers?.length ? (
        <p className="risk-drivers">
          Top driver:{" "}
          {countries[0].drivers
            .map((driver) => `${driver.label} ${driver.share}%`)
            .join(" · ")}
        </p>
      ) : null}
    </Panel>
  );
}

/** Maritime chokepoint disruption board. */
export function ChokepointBoard({ chokepoints }) {
  const rows = chokepoints?.chokepoints ?? [];
  const active = rows.filter((row) => row.status !== "monitoring");

  return (
    <Panel
      kicker="Trade routes"
      title="Chokepoints"
      basis={
        chokepoints
          ? `${chokepoints.disrupted} disrupted · ${chokepoints.strained} strained of ${chokepoints.total} · ${chokepoints.basis}`
          : undefined
      }
      className="choke-panel"
    >
      {rows.length === 0 ? (
        <Empty>No chokepoint data in this snapshot.</Empty>
      ) : (
        <>
          <ul className="choke-list">
            {(active.length ? active : rows.slice(0, 8)).map((row) => (
              <li
                key={row.name}
                className={`choke-row tone-${LEVEL_TONE[row.status]}`}
              >
                <span className="choke-name">{row.name}</span>
                <span className="choke-region">{row.region}</span>
                <span className="choke-score">{row.disruption}</span>
                <span className="choke-status">{row.status}</span>
              </li>
            ))}
          </ul>
          {active.length === 0 ? (
            <p className="intel-basis">
              All routes at baseline — no disruption signal in the current feed.
            </p>
          ) : null}
        </>
      )}
    </Panel>
  );
}

/**
 * Markets pulse. Reads the provider registry so it reports an honest
 * "not configured" state rather than inventing prices when no key is present.
 */
export function MarketsPulse() {
  const [state, setState] = useState({
    loading: true,
    quotes: [],
    provider: null,
  });
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    api("/api/v1/providers")
      .then((response) => {
        if (cancelled.current) return;
        const providers = response?.data ?? [];
        const markets = providers.find(
          (item) =>
            item.id === "finnhub" || /market|finnhub/i.test(item.name ?? ""),
        );
        setState({
          loading: false,
          quotes: markets?.quotes ?? markets?.data ?? [],
          provider: markets ?? null,
        });
      })
      .catch(() => {
        if (!cancelled.current)
          setState({ loading: false, quotes: [], provider: null });
      });
    return () => {
      cancelled.current = true;
    };
  }, []);

  const configured =
    state.provider?.status !== "not-configured" && Boolean(state.provider);
  const quotes = Array.isArray(state.quotes) ? state.quotes : [];

  return (
    <Panel
      kicker="Capital flows"
      title="Markets pulse"
      basis={
        state.loading
          ? "Reading provider registry…"
          : configured
            ? `${quotes.length} instruments · ${state.provider.name}`
            : "No markets key configured — add a Finnhub key in Admin to light this panel up."
      }
      className="markets-panel"
    >
      {quotes.length === 0 ? (
        <Empty>
          {configured
            ? "Provider is configured but returned no quotes on the last pass."
            : "Prices are never simulated. This panel stays empty until a key is live."}
        </Empty>
      ) : (
        <ul className="markets-list">
          {quotes.slice(0, 10).map((quote, index) => (
            <li key={quote.symbol ?? index} className="markets-row">
              <span className="markets-symbol">{quote.symbol}</span>
              <span className="markets-name">{quote.name}</span>
              <span className="markets-price">
                {quote.price ?? quote.c ?? "—"}
              </span>
              <span
                className={`markets-change ${
                  (quote.changePercent ?? quote.dp ?? 0) >= 0 ? "up" : "down"
                }`}
              >
                {(quote.changePercent ?? quote.dp ?? 0) >= 0 ? "▲" : "▼"}
                {Math.abs(quote.changePercent ?? quote.dp ?? 0).toFixed(2)}%
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
