import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowUpRight,
  Bell,
  Bot,
  ChevronRight,
  CircleGauge,
  Clock3,
  Crosshair,
  Database,
  ExternalLink,
  Filter,
  Globe2,
  LayoutDashboard,
  ListFilter,
  LockKeyhole,
  Map as MapIcon,
  Menu,
  Radio,
  RefreshCw,
  Radar,
  Search,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  TriangleAlert,
  X,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../lib/api.js";
import {
  ChokepointBoard,
  MarketsPulse,
  RiskIndex,
  WireTicker,
} from "../components/IntelPanels.jsx";
import {
  compactNumber,
  formatUtc,
  relativeTime,
  titleCase,
} from "../lib/format.js";
import { Brand } from "../components/Brand.jsx";
import WorldMap from "../components/WorldMap.jsx";
import OrbitalGlobe from "../components/OrbitalGlobe.jsx";
import { useLiveStream } from "../lib/useLiveStream.js";
import { useTrack } from "../lib/useTrack.js";
import { useDirectUplink } from "../lib/useDirectUplink.js";

const categoryOptions = [
  "all",
  "conflict",
  "civil",
  "seismic",
  "climate",
  "humanitarian",
  "infrastructure",
  "cyber",
  "economy",
];
const severityOptions = ["all", "critical", "high", "medium", "low"];

const metricConfig = [
  {
    key: "activeSignals",
    label: "Active signals",
    icon: Radio,
    accent: "lime",
    note: "Live + curated",
  },
  {
    key: "highPriority",
    label: "Priority targets",
    icon: TriangleAlert,
    accent: "coral",
    note: "Critical and high",
  },
  {
    key: "seismic24h",
    label: "Seismic · 24h",
    icon: Activity,
    accent: "amber",
    note: "USGS M4.5+",
  },
  {
    key: "sourcesOnline",
    label: "Uplinks online",
    icon: Database,
    accent: "blue",
    note: "Operational now",
  },
];

/** Animated numeric counter for HUD readouts. */
function useCountUp(target, duration = 700) {
  const [value, setValue] = useState(target || 0);
  const previous = useRef(target || 0);
  useEffect(() => {
    const from = previous.current;
    const to = target || 0;
    previous.current = to;
    if (from === to) return undefined;
    let frame;
    const startedAt = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - startedAt) / duration);
      setValue(Math.round(from + (to - from) * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return value;
}

function Navigation({ open, onClose }) {
  return (
    <>
      {open && (
        <button
          className="nav-scrim"
          onClick={onClose}
          aria-label="Close menu"
        />
      )}
      <aside className={`side-nav ${open ? "open" : ""}`}>
        <div className="side-nav-top">
          <Brand compact />
          <button
            className="mobile-nav-close"
            onClick={onClose}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>
        <nav aria-label="Dashboard sections">
          <a className="nav-item active" href="#overview" aria-label="Overview">
            <LayoutDashboard size={19} />
            <span>Command</span>
          </a>
          <a className="nav-item" href="#map" aria-label="Live map">
            <Globe2 size={19} />
            <span>Acquisition</span>
          </a>
          <a className="nav-item" href="#signals" aria-label="Signals">
            <Zap size={19} />
            <span>Signals</span>
          </a>
          <a className="nav-item" href="#sources" aria-label="Sources">
            <Database size={19} />
            <span>Uplinks</span>
          </a>
          <Link
            className="nav-item"
            to="/operations"
            aria-label="Operations mode"
          >
            <CircleGauge size={19} />
            <span>Tactical ops</span>
          </Link>
        </nav>
        <div className="side-nav-bottom">
          <Link
            to="/login"
            className="nav-item admin-link"
            aria-label="Admin console"
          >
            <LockKeyhole size={19} />
            <span>Restricted</span>
          </Link>
          <div className="network-pulse" title="Public network online">
            <i /> <span>Grid online</span>
          </div>
        </div>
      </aside>
    </>
  );
}

function Topbar({ query, setQuery, generatedAt, onMenu }) {
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => {
    const interval = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="topbar">
      <button
        className="mobile-menu icon-button"
        onClick={onMenu}
        aria-label="Open navigation"
      >
        <Menu size={20} />
      </button>
      <Brand />
      <div className="global-search">
        <Search size={17} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search targets, regions, categories…"
          aria-label="Search all signals"
        />
        <kbd>/</kbd>
      </div>
      <div className="topbar-actions">
        <div className="utc-clock">
          <Clock3 size={15} />
          <span>{clock.toISOString().slice(11, 19)} UTC</span>
        </div>
        <button className="icon-button" aria-label="Notifications">
          <Bell size={18} />
          <i />
        </button>
        <div className="source-avatar">GE</div>
      </div>
      {generatedAt && (
        <div className="sync-line" style={{ "--sync": "100%" }} />
      )}
    </header>
  );
}

function MetricCard({ config, metrics }) {
  const Icon = config.icon;
  const raw = useCountUp(metrics[config.key]);
  const value =
    config.key === "sourcesOnline"
      ? `${metrics.sourcesOnline ?? 0}/${metrics.sourcesTotal ?? 0}`
      : config.key === "activeSignals" ||
          config.key === "highPriority" ||
          config.key === "seismic24h"
        ? raw.toLocaleString("en")
        : compactNumber(metrics[config.key]);
  return (
    <article className={`metric-card accent-${config.accent}`}>
      <div className="metric-icon">
        <Icon size={18} />
      </div>
      <div>
        <p>{config.label}</p>
        <strong>{value}</strong>
      </div>
      <span className="metric-note">
        <ArrowUpRight size={12} /> {config.note}
      </span>
    </article>
  );
}

function SignalRow({ event, onSelect, selected }) {
  return (
    <button
      type="button"
      className={`signal-row ${selected ? "selected" : ""}`}
      onClick={() => onSelect(event)}
    >
      <span className={`signal-severity ${event.severity}`}>
        <i />
      </span>
      <span className="signal-main">
        <span className="signal-heading">
          <strong>{event.title}</strong>
          <small>{relativeTime(event.publishedAt)}</small>
        </span>
        <span className="signal-summary">
          {event.summary || `${event.sourceName} source signal`}
        </span>
        <span className="signal-tags">
          <em>{titleCase(event.category)}</em>
          <span>{event.region}</span>
          <span>{event.sourceName}</span>
        </span>
      </span>
      <ChevronRight className="signal-chevron" size={17} />
    </button>
  );
}

/** Cinematic intercept log — typed signal acquisitions from the live grid. */
function InterceptConsole({ events, systemLines }) {
  const lines = useMemo(() => {
    const stamp = (value) => new Date(value).toISOString().slice(11, 19);
    const eventLines = events.slice(0, 6).map((event) => ({
      time: stamp(event.publishedAt),
      lvl:
        event.severity === "critical"
          ? "crit"
          : event.severity === "high"
            ? "warn"
            : "info",
      text: `${titleCase(event.category).toUpperCase()} ▸ ${event.title}`,
    }));
    return [...systemLines, ...eventLines].slice(0, 9);
  }, [events, systemLines]);

  return (
    <section className="intercept-feed" aria-label="Live intercept console">
      <div className="intercept-head">
        <span className="led" />
        <TerminalSquare size={13} /> Intercept console
        <span>OPEN-SOURCE INTAKE</span>
      </div>
      <div className="intercept-body">
        {lines.map((line, index) => (
          <div
            className="intercept-line"
            key={`${line.time}-${line.text}-${index}`}
            style={{ animationDelay: `${index * 90}ms` }}
          >
            <span className="t">{line.time}Z</span>
            <span className={`lvl ${line.lvl}`}>
              {line.lvl === "crit" ? "!!" : line.lvl === "warn" ? " ! " : "▸▸"}
            </span>
            <span className="msg">{line.text}</span>
          </div>
        ))}
        <div className="intercept-line" aria-hidden="true">
          <span className="t">{new Date().toISOString().slice(11, 19)}Z</span>
          <span className="lvl info">▸▸</span>
          <span className="msg">awaiting next intercept </span>
          <span className="intercept-caret" />
        </div>
      </div>
    </section>
  );
}

/** Bottom-of-screen live broadcast ticker. */
function Ticker({ events, news }) {
  const items = useMemo(() => {
    const merged = [
      ...events.slice(0, 14).map((event) => ({
        id: event.id,
        sev: event.severity,
        tag: titleCase(event.category).toUpperCase(),
        title: event.title,
        url: event.sourceUrl,
        time: formatUtc(event.publishedAt),
      })),
      ...(news || []).slice(0, 6).map((item) => ({
        id: item.id,
        sev: "info",
        tag: "REPORT",
        title: item.title,
        url: item.sourceUrl,
        time: formatUtc(item.publishedAt),
      })),
    ];
    return merged.length ? merged : [];
  }, [events, news]);

  if (!items.length) return null;
  const sequence = [...items, ...items];

  return (
    <div className="ticker" role="region" aria-label="Live signal ticker">
      <span className="ticker-tag">
        <i /> LIVE GRID
      </span>
      <div className="ticker-viewport">
        <div className="ticker-track">
          {sequence.map((item, index) => {
            const body = (
              <>
                <em>{item.tag}</em>
                <strong>{item.title}</strong>
                <span className="ticker-time">{item.time}Z</span>
              </>
            );
            return item.url ? (
              <a
                className={`ticker-item ${item.severityClass || ""}`}
                key={`${item.id}-${index}`}
                href={item.url}
                target="_blank"
                rel="noreferrer"
              >
                {body}
              </a>
            ) : (
              <span
                className={`ticker-item ${item.sev === "critical" ? "critical" : item.sev === "high" ? "high" : ""}`}
                key={`${item.id}-${index}`}
              >
                {body}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function IntelligenceBrief({ events }) {
  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    setLoading(true);
    setError("");
    try {
      const response = await api("/api/v1/intelligence/brief", {
        method: "POST",
      });
      setBrief(response.data);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="intel-card panel">
      <div className="panel-heading">
        <div>
          <span className="panel-kicker">
            <Sparkles size={13} /> Intelligence brief
          </span>
          <h2>{brief?.headline || "Threat synthesis"}</h2>
        </div>
        <span className="ai-chip">
          <Bot size={13} /> AI-assisted
        </span>
      </div>
      {!brief ? (
        <div className="brief-empty">
          <div className="brief-orb">
            <CircleGauge size={28} />
          </div>
          <p>
            Generate a source-grounded synthesis of the {events.length} signals
            currently inside the grid.
          </p>
          <button
            className="button primary full"
            onClick={generate}
            disabled={loading}
          >
            {loading ? (
              <>
                <RefreshCw className="spin" size={15} /> Synthesizing
              </>
            ) : (
              <>
                <Sparkles size={15} /> Generate live brief
              </>
            )}
          </button>
          {error && <span className="form-error">{error}</span>}
        </div>
      ) : (
        <div className="brief-content">
          <ul>
            {brief.assessment.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          {brief.watchlist?.length > 0 && (
            <div className="watchlist">
              <span>Watchlist</span>
              {[...new Set(brief.watchlist)].map((item) => (
                <em key={item}>{item}</em>
              ))}
            </div>
          )}
          <div className="brief-footer">
            <span>{brief.generatedBy}</span>
            <button
              onClick={generate}
              disabled={loading}
              aria-label="Regenerate brief"
            >
              <RefreshCw className={loading ? "spin" : ""} size={14} />
            </button>
          </div>
          <p className="disclaimer">
            <ShieldCheck size={13} /> {brief.disclaimer}
          </p>
        </div>
      )}
    </section>
  );
}

function SourceGrid({ sources }) {
  return (
    <section className="panel source-panel" id="sources">
      <div className="panel-heading inline">
        <div>
          <span className="panel-kicker">Uplink mesh</span>
          <h2>Source health</h2>
        </div>
        <span className="verified-label">
          <ShieldCheck size={14} /> Server-side keys
        </span>
      </div>
      <div className="source-grid">
        {sources.map((source) => (
          <article key={source.id} className="source-card">
            <div>
              <span className={`source-status ${source.status}`} />
              <strong>{source.name}</strong>
            </div>
            <p>
              {source.type} · {source.coverage || "Global"}
            </p>
            <span>
              {source.status === "operational"
                ? `${source.latencyMs ?? 0}ms`
                : titleCase(source.status)}
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function Dashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [severity, setSeverity] = useState("all");
  const [focusedEvent, setFocusedEvent] = useState(null);
  const [navOpen, setNavOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [viewMode, setViewMode] = useState("grid");
  const [pulse, setPulse] = useState(null);
  const [toasts, setToasts] = useState([]);
  const { fixes: satellites } = useTrack();
  const uplink = useDirectUplink();

  /**
   * Multi-path merge: browser-acquired events (DIRECT) override relayed
   * copies of the same signal; server-curated baselines are always kept.
   * Metrics are then recomputed from the merged stream — the numbers on
   * screen always describe the events actually displayed.
   */
  const merged = useMemo(() => {
    if (!dashboard) return uplink.events;
    const direct = new Map(uplink.events.map((event) => [event.id, event]));
    const out = [];
    for (const event of dashboard.events) {
      out.push(direct.get(event.id) || event);
      direct.delete(event.id);
    }
    return [...out, ...direct.values()].sort(
      (a, b) => new Date(b.publishedAt) - new Date(a.publishedAt),
    );
  }, [dashboard, uplink.events]);

  const liveMetrics = useMemo(() => {
    const critical = merged.filter(
      (event) => event.severity === "critical",
    ).length;
    const high = merged.filter((event) => event.severity === "high").length;
    const weight = merged.reduce(
      (sum, event) =>
        sum + { critical: 4, high: 3, medium: 2, low: 1 }[event.severity] * 1,
      0,
    );
    const serverStatus = dashboard?.sourceStatus || [];
    const sourceStatuses = [
      ...serverStatus.map((source) => source.status),
      ...Object.values(uplink.state),
    ];
    const online = sourceStatuses.filter((status) =>
      ["operational", "direct"].includes(status),
    ).length;
    return {
      activeSignals: merged.length,
      highPriority: critical + high,
      criticalSignals: critical,
      seismic24h:
        uplink.state.usgs === "direct"
          ? merged.filter((event) => event.sourceName === "USGS").length
          : (dashboard?.metrics.seismic24h ?? 0),
      sourcesOnline: online,
      sourcesTotal: sourceStatuses.length,
      riskScore: Math.min(
        99,
        Math.max(
          18,
          Math.round((weight / Math.max(merged.length, 1)) * 19 + critical * 2),
        ),
      ),
    };
  }, [merged, dashboard, uplink.state]);

  const pushToasts = (signals) => {
    const items = signals.slice(0, 3).map((signal) => ({
      key: `${signal.id}-${Date.now()}`,
      title: signal.title,
      source: signal.sourceName,
      severity: signal.severity || "medium",
    }));
    setToasts((current) => [...items, ...current].slice(0, 3));
    setTimeout(() => {
      setToasts((current) =>
        current.filter(
          (toast) => !items.some((item) => item.key === toast.key),
        ),
      );
    }, 9_000);
  };

  const refreshTimer = useRef(null);
  useLiveStream({
    onSignal: (signals) => {
      if (Array.isArray(signals) && signals.length) {
        pushToasts(signals);
        pushSystemLine(
          `LIVE INTERCEPT ▸ ${signals[0].title.slice(0, 70).toUpperCase()}`,
          signals[0].severity === "critical" ? "crit" : "info",
        );
        clearTimeout(refreshTimer.current);
        refreshTimer.current = setTimeout(() => load(true), 4_000);
      }
    },
    onPulse: (view) => setPulse(view),
  });
  const [systemLines, setSystemLines] = useState([
    {
      time: new Date().toISOString().slice(11, 19),
      lvl: "info",
      text: "GOD'S EYE GRID LINK ESTABLISHED",
    },
  ]);

  const pushSystemLine = (text, lvl = "info") => {
    const line = {
      time: new Date().toISOString().slice(11, 19),
      lvl,
      text,
    };
    setSystemLines((current) => [...current.slice(-2), line]);
    setTimeout(
      () =>
        setSystemLines((current) => current.filter((item) => item !== line)),
      12_000,
    );
  };

  async function load(silent = false) {
    if (!silent) setRefreshing(true);
    setError("");
    try {
      const response = await api("/api/v1/dashboard");
      setDashboard(response.data);
      if (silent) pushSystemLine("GRID SYNC COMPLETE — ALL FEEDS NOMINAL");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(() => load(true), 5 * 60 * 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autonomous heartbeat — the grid breathes on its own.
  const targetCount = useRef(0);
  const scanningRef = useRef(false);
  useEffect(() => {
    scanningRef.current = scanning;
  }, [scanning]);
  useEffect(() => {
    let alive = true;
    const loadPulse = () =>
      api("/api/v1/pulse")
        .then((response) => alive && setPulse(response.data))
        .catch(() => undefined);
    loadPulse();
    const pulseInterval = setInterval(loadPulse, 60_000);
    const sweepInterval = setInterval(
      () => {
        if (scanningRef.current || document.hidden) return;
        setScanning(true);
        pushSystemLine("AUTONOMOUS SWEEP ENGAGED — SECTOR MESH CRAWL", "warn");
        setTimeout(
          () =>
            pushSystemLine(
              `AUTONOMOUS SWEEP COMPLETE — ${targetCount.current} TARGETS TRACKED`,
            ),
          5_600,
        );
        setTimeout(() => setScanning(false), 6_200);
      },
      4 * 60 * 1000,
    );
    return () => {
      alive = false;
      clearInterval(pulseInterval);
      clearInterval(sweepInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const shortcut = (event) => {
      if (
        event.key === "/" &&
        !["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)
      ) {
        event.preventDefault();
        document.querySelector(".global-search input")?.focus();
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);

  const filteredEvents = useMemo(() => {
    if (!merged.length) return [];
    const needle = query.trim().toLowerCase();
    return merged.filter(
      (event) =>
        (category === "all" || event.category === category) &&
        (severity === "all" || event.severity === severity) &&
        (!needle ||
          `${event.title} ${event.summary} ${event.region} ${event.country} ${event.sourceName}`
            .toLowerCase()
            .includes(needle)),
    );
  }, [merged, query, category, severity]);

  targetCount.current = filteredEvents.length;

  function runGlobalScan() {
    if (scanning) return;
    setScanning(true);
    pushSystemLine("MANUAL GLOBAL SWEEP — SCANNING SECTOR MESH", "warn");
    setTimeout(
      () =>
        pushSystemLine(
          `SWEEP COMPLETE — ${filteredEvents.length} TARGETS TRACKED`,
        ),
      5_600,
    );
    setTimeout(() => setScanning(false), 6_200);
  }

  if (!dashboard && error) {
    return (
      <main className="fatal-state">
        <Brand />
        <TriangleAlert size={38} />
        <h1>Uplink to the grid failed</h1>
        <p>{error}</p>
        <button className="button primary" onClick={() => load()}>
          <RefreshCw size={16} /> Retry connection
        </button>
      </main>
    );
  }

  return (
    <div className="app-frame">
      <div className="hud-grid" aria-hidden="true" />
      <Navigation open={navOpen} onClose={() => setNavOpen(false)} />
      <div className="app-workspace">
        <Topbar
          query={query}
          setQuery={setQuery}
          generatedAt={dashboard?.generatedAt}
          onMenu={() => setNavOpen(true)}
        />
        <main className="dashboard" id="overview">
          <section className="dashboard-intro">
            <div>
              <span className="eyebrow">
                <i /> God&apos;s eye · global situation grid
              </span>
              <h1>
                Every signal.
                <br />
                <em>One eye on the world.</em>
              </h1>
              <p>
                Live geospatial surveillance of seismic, weather, humanitarian,
                infrastructure, and geopolitical events — acquired from public
                satellites and ground sensors, refreshed every five minutes.
              </p>
            </div>
            <div className="intro-actions">
              <div
                className="pulse-chip"
                title={
                  pulse?.lastBeatAt
                    ? `Heartbeat ${pulse.beatCount} · last beat ${pulse.lastBeatAt}`
                    : "Autonomous grid heartbeat"
                }
              >
                <i /> Autonomous grid
                <em>
                  {pulse?.beatCount ? `HB ${pulse.beatCount}` : "LINKING"}
                </em>
                <u>{pulse?.beatCount ? "STREAM LIVE" : "…"}</u>
              </div>
              <div className="last-sync">
                <span>Last grid sync</span>
                <strong>
                  {dashboard ? formatUtc(dashboard.generatedAt) : "LINKING…"}{" "}
                  UTC
                </strong>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  className="button secondary"
                  onClick={runGlobalScan}
                  disabled={scanning}
                >
                  <Radar className={scanning ? "spin" : ""} size={15} />
                  {scanning ? "Sweeping…" : "Global scan"}
                </button>
                <button
                  className="button secondary"
                  onClick={() => load()}
                  disabled={refreshing}
                >
                  <RefreshCw className={refreshing ? "spin" : ""} size={15} />{" "}
                  Refresh
                </button>
              </div>
            </div>
          </section>

          {error && (
            <div className="inline-alert">
              <TriangleAlert size={16} /> {error}{" "}
              <button onClick={() => load()}>Retry</button>
            </div>
          )}

          <section
            className="metrics-grid"
            aria-label="Global monitoring metrics"
          >
            {metricConfig.map((item) => (
              <MetricCard
                key={item.key}
                config={item}
                metrics={dashboard ? liveMetrics : dashboard?.metrics || {}}
              />
            ))}
          </section>

          {dashboard?.provenance && dashboard.provenance.curated > 0 ? (
            <div
              className={`provenance-banner ${
                dashboard.provenance.live === 0 ? "stale" : "mixed"
              }`}
            >
              <span className="provenance-label">
                {dashboard.provenance.live === 0 ? "NO LIVE FEED" : "MIXED"}
              </span>
              <span className="provenance-text">
                {dashboard.provenance.note}
              </span>
            </div>
          ) : null}

          <WireTicker
            news={dashboard?.news ?? []}
            events={dashboard?.events ?? []}
          />

          <section className="intel-grid">
            <RiskIndex risk={dashboard?.riskIndex} />
            <ChokepointBoard chokepoints={dashboard?.chokepoints} />
            <MarketsPulse />
          </section>

          <section className="command-grid" id="map">
            <article className="panel map-panel">
              <div className="panel-heading inline map-heading">
                <div>
                  <span className="panel-kicker">
                    <Crosshair size={13} /> Geospatial acquisition
                  </span>
                  <h2>Live target map</h2>
                </div>
                <div className="map-heading-tools">
                  <div className="map-legend">
                    <span>
                      <i className="critical" /> Critical
                    </span>
                    <span>
                      <i className="high" /> High
                    </span>
                    <span>
                      <i className="medium" /> Monitored
                    </span>
                  </div>
                  <div
                    className="map-view-toggle"
                    role="group"
                    aria-label="Map view mode"
                  >
                    <button
                      className={viewMode === "grid" ? "active" : ""}
                      onClick={() => setViewMode("grid")}
                      aria-pressed={viewMode === "grid"}
                    >
                      2D GRID
                    </button>
                    <button
                      className={viewMode === "orbit" ? "active" : ""}
                      onClick={() => setViewMode("orbit")}
                      aria-pressed={viewMode === "orbit"}
                    >
                      3D ORBIT
                    </button>
                  </div>
                </div>
              </div>
              <div
                className="acquisition-strip"
                aria-label="Live acquisition paths"
              >
                <span className="acq-label">
                  <Radar size={12} /> ACQUISITION
                </span>
                {[
                  ["usgs", "USGS"],
                  ["open-meteo", "METEO"],
                  ["eonet", "EONET"],
                  ["swpc", "SWPC"],
                  ["gdelt", "GDELT"],
                ].map(([key, label]) => {
                  const mode = uplink.state[key];
                  const relay =
                    dashboard?.sourceStatus?.find(
                      (source) =>
                        source.id ===
                        (key === "open-meteo" ? "open-meteo" : key),
                    )?.status === "operational";
                  const cls =
                    mode === "direct" ? "direct" : relay ? "relay" : "offline";
                  const text =
                    mode === "direct" ? "DIRECT" : relay ? "RELAY" : "OFFLINE";
                  return (
                    <span key={key} className={`acq-chip ${cls}`}>
                      <i /> {label} {text}
                    </span>
                  );
                })}
              </div>
              <div className="filter-strip">
                <ListFilter size={15} />
                <div className="filter-scroll">
                  {categoryOptions.map((item) => (
                    <button
                      key={item}
                      className={category === item ? "active" : ""}
                      onClick={() => setCategory(item)}
                    >
                      {titleCase(item)}
                    </button>
                  ))}
                </div>
              </div>
              <div className={`map-stage ${scanning ? "scanning" : ""}`}>
                {dashboard ? (
                  viewMode === "orbit" ? (
                    <OrbitalGlobe
                      events={filteredEvents}
                      focusedEvent={focusedEvent}
                      onFocus={setFocusedEvent}
                      scanning={scanning}
                    />
                  ) : (
                    <WorldMap
                      events={filteredEvents}
                      focusedEvent={focusedEvent}
                      onFocus={setFocusedEvent}
                      scanning={scanning}
                      satellites={satellites}
                    />
                  )
                ) : (
                  <div className="map-skeleton" />
                )}
                <div className="map-counter">
                  <Radio size={13} /> {filteredEvents.length} targets tracked
                </div>
              </div>
              {focusedEvent && (
                <div className="selected-signal">
                  <span className={`signal-severity ${focusedEvent.severity}`}>
                    <i />
                  </span>
                  <div>
                    <small>
                      Target lock · {titleCase(focusedEvent.category)} ·{" "}
                      {focusedEvent.region}
                    </small>
                    <strong>{focusedEvent.title}</strong>
                  </div>
                  {focusedEvent.sourceUrl && (
                    <a
                      href={focusedEvent.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="Open source"
                    >
                      <ExternalLink size={16} />
                    </a>
                  )}
                  <button
                    onClick={() => setFocusedEvent(null)}
                    aria-label="Close selected signal"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
            </article>

            <aside className="intel-column">
              <section className="risk-card">
                <div className="risk-top">
                  <span className="panel-kicker">Composite watch index</span>
                  <span className="live-badge">
                    <i /> Live
                  </span>
                </div>
                <div
                  className="risk-score"
                  style={{
                    "--score": `${(dashboard ? liveMetrics.riskScore : 0) || 0}%`,
                  }}
                >
                  <div>
                    <strong>{dashboard?.metrics.riskScore || "—"}</strong>
                    <span>/ 100</span>
                  </div>
                </div>
                <h2>
                  {(dashboard ? liveMetrics.riskScore : 0) >= 65
                    ? "Elevated watch posture"
                    : "Measured watch posture"}
                </h2>
                <div className="risk-breakdown">
                  {(dashboard?.riskBreakdown || []).map((axis) => (
                    <div key={axis.id} title={`${axis.count} signals`}>
                      <span>{axis.label}</span>
                      <em>{axis.score}</em>
                      <i>
                        <b style={{ width: `${axis.score}%` }} />
                      </i>
                    </div>
                  ))}
                </div>
                {(uplink.space || dashboard?.space) && (
                  <div className="space-strip" title="NOAA SWPC space weather">
                    <i />
                    KP {(uplink.space || dashboard.space).kp?.kp ?? "—"}
                    <em>
                      SOLAR WIND{" "}
                      {(uplink.space || dashboard.space).wind?.speed
                        ? `${(uplink.space || dashboard.space).wind.speed} KM/S`
                        : "—"}
                    </em>
                  </div>
                )}
                <p>
                  Computed from live signal severity and uplink availability—not
                  a predictive risk rating.
                </p>
              </section>
              <InterceptConsole
                events={filteredEvents}
                systemLines={systemLines}
              />
              <IntelligenceBrief events={filteredEvents} />
            </aside>
          </section>

          <section className="insight-grid" id="signals">
            <article className="panel signal-panel">
              <div className="panel-heading inline">
                <div>
                  <span className="panel-kicker">
                    <Activity size={13} /> Event stream
                  </span>
                  <h2>Priority signals</h2>
                </div>
                <div className="severity-filter">
                  <Filter size={14} />
                  <select
                    value={severity}
                    onChange={(event) => setSeverity(event.target.value)}
                    aria-label="Filter by severity"
                  >
                    {severityOptions.map((item) => (
                      <option key={item} value={item}>
                        {titleCase(item)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="signal-list">
                {filteredEvents.slice(0, 8).map((event) => (
                  <SignalRow
                    key={event.id}
                    event={event}
                    selected={focusedEvent?.id === event.id}
                    onSelect={(item) => {
                      setFocusedEvent(item);
                      document
                        .getElementById("map")
                        ?.scrollIntoView({ behavior: "smooth" });
                    }}
                  />
                ))}
                {filteredEvents.length === 0 && (
                  <div className="empty-state">
                    <Search size={22} />
                    <p>No signals match the current filters.</p>
                    <button
                      onClick={() => {
                        setQuery("");
                        setCategory("all");
                        setSeverity("all");
                      }}
                    >
                      Clear filters
                    </button>
                  </div>
                )}
              </div>
            </article>

            <article className="panel trend-panel">
              <div className="panel-heading inline">
                <div>
                  <span className="panel-kicker">24-hour pattern</span>
                  <h2>Signal velocity</h2>
                </div>
                <span className="trend-badge">
                  <ArrowUpRight size={13} /> Live window
                </span>
              </div>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={dashboard?.trend || []}
                    margin={{ top: 10, right: 4, left: -24, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="signalGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#e8b34c"
                          stopOpacity={0.35}
                        />
                        <stop
                          offset="95%"
                          stopColor="#e8b34c"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      stroke="rgba(232, 179, 76,0.12)"
                      strokeDasharray="3 5"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="label"
                      stroke="#5b7688"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      interval={2}
                    />
                    <YAxis
                      stroke="#5b7688"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#04101a",
                        border: "1px solid rgba(232, 179, 76,0.4)",
                        borderRadius: 4,
                        fontSize: 12,
                        fontFamily: "Share Tech Mono, monospace",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="signals"
                      stroke="#e8b34c"
                      fill="url(#signalGradient)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="priority"
                      stroke="#ff2e4d"
                      fill="transparent"
                      strokeWidth={1.5}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="chart-legend">
                <span>
                  <i className="lime" /> All signals
                </span>
                <span>
                  <i className="coral" /> Priority
                </span>
              </div>
              <div className="news-stack">
                <span className="panel-kicker">Latest source reports</span>
                {(dashboard?.news || []).slice(0, 3).map((item) => (
                  <a
                    key={item.id}
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="news-item"
                  >
                    <div>
                      <strong>{item.title}</strong>
                      <span>
                        {item.sourceName} · {relativeTime(item.publishedAt)}
                      </span>
                    </div>
                    <ExternalLink size={14} />
                  </a>
                ))}
              </div>
            </article>
          </section>

          <SourceGrid sources={dashboard?.sourceStatus || []} />

          <footer className="dashboard-footer">
            <div>
              <Brand />
              <p>Decision support for a complex world.</p>
            </div>
            <p>
              <ShieldCheck size={14} /> WORLDGPZ GOD&apos;S EYE combines live
              public satellites and ground sensors with curated baseline
              records. Always verify consequential decisions against linked
              primary sources.
            </p>
            <span>© {new Date().getFullYear()} WORLDGPZ</span>
          </footer>
        </main>
      </div>
      {toasts.length > 0 && (
        <div className="toast-stack" aria-live="polite">
          {toasts.map((toast) => (
            <div key={toast.key} className={`toast-item sev-${toast.severity}`}>
              <TriangleAlert size={15} />
              <div>
                <small>NEW SIGNAL INTERCEPTED · {toast.source}</small>
                <strong>{toast.title}</strong>
              </div>
              <button
                onClick={() =>
                  setToasts((current) =>
                    current.filter((item) => item.key !== toast.key),
                  )
                }
                aria-label="Dismiss"
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
      <Ticker events={dashboard?.events || []} news={dashboard?.news || []} />
    </div>
  );
}
