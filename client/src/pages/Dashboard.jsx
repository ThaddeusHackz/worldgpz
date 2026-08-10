import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowUpRight,
  Bell,
  Bot,
  ChevronRight,
  CircleGauge,
  Clock3,
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
  Search,
  ShieldCheck,
  Sparkles,
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
  compactNumber,
  formatUtc,
  relativeTime,
  titleCase,
} from "../lib/format.js";
import { Brand } from "../components/Brand.jsx";
import WorldMap from "../components/WorldMap.jsx";

const categoryOptions = [
  "all",
  "conflict",
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
    label: "High priority",
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
    label: "Sources online",
    icon: Database,
    accent: "blue",
    note: "Operational now",
  },
];

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
            <span>Overview</span>
          </a>
          <a className="nav-item" href="#map" aria-label="Live map">
            <MapIcon size={19} />
            <span>Live map</span>
          </a>
          <a className="nav-item" href="#signals" aria-label="Signals">
            <Zap size={19} />
            <span>Signals</span>
          </a>
          <a className="nav-item" href="#sources" aria-label="Sources">
            <Database size={19} />
            <span>Sources</span>
          </a>
          <Link
            className="nav-item"
            to="/operations"
            aria-label="Operations mode"
          >
            <CircleGauge size={19} />
            <span>Operations</span>
          </Link>
        </nav>
        <div className="side-nav-bottom">
          <Link
            to="/login"
            className="nav-item admin-link"
            aria-label="Admin console"
          >
            <LockKeyhole size={19} />
            <span>Admin</span>
          </Link>
          <div className="network-pulse" title="Public network online">
            <i /> <span>Network online</span>
          </div>
        </div>
      </aside>
    </>
  );
}

function Topbar({ query, setQuery, generatedAt, onMenu }) {
  const [clock, setClock] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="topbar">
      <button
        className="mobile-menu"
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
          placeholder="Search regions, categories, signals…"
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
        <div className="source-avatar">WG</div>
      </div>
      {generatedAt && (
        <div className="sync-line" style={{ "--sync": "100%" }} />
      )}
    </header>
  );
}

function MetricCard({ config, metrics }) {
  const Icon = config.icon;
  const value =
    config.key === "sourcesOnline"
      ? `${metrics.sourcesOnline}/${metrics.sourcesTotal}`
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
    <section className="intel-card">
      <div className="panel-heading">
        <div>
          <span className="panel-kicker">
            <Sparkles size={13} /> Intelligence brief
          </span>
          <h2>{brief?.headline || "Analyst-ready synthesis"}</h2>
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
            Generate a source-grounded summary of the {events.length} signals
            currently in view.
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
          <span className="panel-kicker">Provider mesh</span>
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

  async function load(silent = false) {
    if (!silent) setRefreshing(true);
    setError("");
    try {
      const response = await api("/api/v1/dashboard");
      setDashboard(response.data);
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
    if (!dashboard) return [];
    const needle = query.trim().toLowerCase();
    return dashboard.events.filter(
      (event) =>
        (category === "all" || event.category === category) &&
        (severity === "all" || event.severity === severity) &&
        (!needle ||
          `${event.title} ${event.summary} ${event.region} ${event.country} ${event.sourceName}`
            .toLowerCase()
            .includes(needle)),
    );
  }, [dashboard, query, category, severity]);

  if (!dashboard && error) {
    return (
      <main className="fatal-state">
        <Brand />
        <TriangleAlert size={38} />
        <h1>Unable to establish the data link</h1>
        <p>{error}</p>
        <button className="button primary" onClick={() => load()}>
          <RefreshCw size={16} /> Retry connection
        </button>
      </main>
    );
  }

  return (
    <div className="app-frame">
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
                <i /> Global situation room
              </span>
              <h1>
                See the signal.
                <br />
                <em>Understand the world.</em>
              </h1>
              <p>
                Source-aware monitoring for high-impact seismic, weather,
                humanitarian, infrastructure, and geopolitical events.
              </p>
            </div>
            <div className="intro-actions">
              <div className="last-sync">
                <span>Last synchronized</span>
                <strong>
                  {dashboard ? formatUtc(dashboard.generatedAt) : "Connecting…"}{" "}
                  UTC
                </strong>
              </div>
              <button
                className="button secondary"
                onClick={() => load()}
                disabled={refreshing}
              >
                <RefreshCw className={refreshing ? "spin" : ""} size={15} />{" "}
                Refresh
              </button>
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
                metrics={dashboard?.metrics || {}}
              />
            ))}
          </section>

          <section className="command-grid" id="map">
            <article className="panel map-panel">
              <div className="panel-heading inline map-heading">
                <div>
                  <span className="panel-kicker">
                    <Globe2 size={13} /> Geospatial operations
                  </span>
                  <h2>Live signal map</h2>
                </div>
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
              <div className="map-stage">
                {dashboard ? (
                  <WorldMap
                    events={filteredEvents}
                    focusedEvent={focusedEvent}
                    onFocus={setFocusedEvent}
                  />
                ) : (
                  <div className="map-skeleton" />
                )}
                <div className="map-counter">
                  <Radio size={13} /> {filteredEvents.length} signals visible
                </div>
              </div>
              {focusedEvent && (
                <div className="selected-signal">
                  <span className={`signal-severity ${focusedEvent.severity}`}>
                    <i />
                  </span>
                  <div>
                    <small>
                      {titleCase(focusedEvent.category)} · {focusedEvent.region}
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
                  style={{ "--score": `${dashboard?.metrics.riskScore || 0}%` }}
                >
                  <div>
                    <strong>{dashboard?.metrics.riskScore || "—"}</strong>
                    <span>/ 100</span>
                  </div>
                </div>
                <h2>
                  {(dashboard?.metrics.riskScore || 0) >= 65
                    ? "Elevated watch posture"
                    : "Measured watch posture"}
                </h2>
                <p>
                  Calculated from current signal severity and source
                  availability—not a predictive risk rating.
                </p>
              </section>
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
                          stopColor="#a4f85e"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor="#a4f85e"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      stroke="#26312d"
                      strokeDasharray="3 5"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="label"
                      stroke="#718079"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      interval={2}
                    />
                    <YAxis
                      stroke="#718079"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#101b17",
                        border: "1px solid #2b3933",
                        borderRadius: 10,
                        fontSize: 12,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="signals"
                      stroke="#a4f85e"
                      fill="url(#signalGradient)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="priority"
                      stroke="#ff765f"
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
              <ShieldCheck size={14} /> WORLDGPZ combines live public providers
              with curated baseline records. Always verify consequential
              decisions against linked primary sources.
            </p>
            <span>© {new Date().getFullYear()} WORLDGPZ</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
