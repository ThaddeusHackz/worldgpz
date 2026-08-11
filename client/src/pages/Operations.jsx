import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Activity,
  BrainCircuit,
  ChevronDown,
  CircleGauge,
  Database,
  ExternalLink,
  Globe2,
  Layers3,
  List,
  LockKeyhole,
  Map as MapIcon,
  Menu,
  Newspaper,
  Pause,
  Play,
  Radio,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Video,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import { Brand } from "../components/Brand.jsx";
import YouTubePlayer from "../components/YouTubePlayer.jsx";
import LoadingScreen from "../components/LoadingScreen.jsx";
import WorldMap from "../components/WorldMap.jsx";
import {
  EnergyMacroPanel,
  MarketsPanel,
  ProviderChips,
  TrackingPanel,
  WeatherPanel,
  WebcamsPanel,
} from "../components/OpsExtras.jsx";
import { api } from "../lib/api.js";
import { formatUtc, relativeTime, titleCase } from "../lib/format.js";

const allCategories = [
  "conflict",
  "humanitarian",
  "seismic",
  "climate",
  "natural",
  "infrastructure",
  "cyber",
  "economy",
  "diplomacy",
  "health",
];

const regionCenters = {
  Global: { latitude: 20, longitude: 0 },
  Americas: { latitude: 18, longitude: -78 },
  Europe: { latitude: 50, longitude: 15 },
  Africa: { latitude: 2, longitude: 22 },
  Asia: { latitude: 31, longitude: 87 },
  "Asia Pacific": { latitude: 10, longitude: 120 },
  "Middle East": { latitude: 29, longitude: 44 },
  Oceania: { latitude: -24, longitude: 142 },
};

const ranges = [
  { label: "1H", hours: 1 },
  { label: "6H", hours: 6 },
  { label: "24H", hours: 24 },
  { label: "48H", hours: 48 },
  { label: "7D", hours: 168 },
  { label: "ALL", hours: Infinity },
];

function OpsHeader({
  data,
  region,
  setRegion,
  refresh,
  refreshing,
  openPalette,
}) {
  const [clock, setClock] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="ops-header">
      <Link to="/" className="ops-home" aria-label="Return to overview">
        <Brand compact />
      </Link>
      <span className="ops-product">MONITOR</span>
      <span className="ops-version">v2.1</span>
      <span className="ops-live">
        <i /> LIVE
      </span>
      <label className="ops-region-select">
        <Globe2 size={13} />
        <select
          value={region}
          onChange={(event) => setRegion(event.target.value)}
        >
          {Object.keys(regionCenters).map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <ChevronDown size={12} />
      </label>
      <div
        className={`ops-watch ${(data?.metrics.riskScore || 0) >= 65 ? "elevated" : "measured"}`}
      >
        <span>WATCH</span>
        <strong>{data?.metrics.riskScore ?? "—"}</strong>
      </div>
      <span className="ops-clock">
        {clock.toISOString().slice(0, 19).replace("T", " ")} UTC
      </span>
      <div className="ops-header-actions">
        <button onClick={refresh} aria-label="Refresh sources">
          <RefreshCw className={refreshing ? "spin" : ""} size={15} />
        </button>
        <button onClick={openPalette} className="ops-search-button">
          <Search size={14} />
          <span>Search</span>
          <kbd>⌘K</kbd>
        </button>
        <Link to="/login" aria-label="Open administrator console">
          <LockKeyhole size={15} />
        </Link>
      </div>
    </header>
  );
}

function LayerControl({ layers, activeLayers, toggleLayer, open, onClose }) {
  return (
    <aside className={`ops-layers ${open ? "open" : ""}`}>
      <header>
        <span>
          <Layers3 size={14} /> Data layers
        </span>
        <button onClick={onClose} aria-label="Close layers">
          <X size={14} />
        </button>
      </header>
      <div className="ops-layer-search">
        <Search size={12} />
        <span>Operational picture</span>
      </div>
      <div className="ops-layer-list">
        {layers.map((layer) => (
          <button
            key={layer.id}
            className={activeLayers.has(layer.id) ? "active" : ""}
            onClick={() => toggleLayer(layer.id)}
          >
            <span className="ops-check">
              {activeLayers.has(layer.id) ? "✓" : ""}
            </span>
            <i style={{ background: layer.color }} />
            <span>{layer.label}</span>
            <em>{layer.count}</em>
          </button>
        ))}
      </div>
      <footer>
        <ShieldCheck size={12} /> Source-attributed records only
      </footer>
    </aside>
  );
}

function SignalPanel({ events, news, onFocus }) {
  const [tab, setTab] = useState("signals");
  const items = tab === "news" ? news : events;
  return (
    <section className="ops-panel" id="ops-feed">
      <header>
        <div>
          <Newspaper size={14} />
          <strong>Live intelligence</strong>
          <span>{items.length}</span>
        </div>
        <div className="ops-panel-tabs">
          <button
            className={tab === "signals" ? "active" : ""}
            onClick={() => setTab("signals")}
          >
            Signals
          </button>
          <button
            className={tab === "news" ? "active" : ""}
            onClick={() => setTab("news")}
          >
            Reports
          </button>
        </div>
      </header>
      <div className="ops-scroll-list">
        {items.slice(0, 12).map((item) => (
          <button
            key={item.id}
            className="ops-feed-row"
            onClick={() => onFocus(item)}
          >
            <span className={`ops-priority ${item.severity || "medium"}`} />
            <span>
              <strong>{item.title}</strong>
              <small>
                {item.sourceName} · {relativeTime(item.publishedAt)}
              </small>
            </span>
            {item.sourceUrl && (
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => event.stopPropagation()}
                aria-label="Open primary source"
              >
                <ExternalLink size={12} />
              </a>
            )}
          </button>
        ))}
        {items.length === 0 && (
          <div className="ops-empty">
            <Radio size={18} />
            <span>No provider reports in this window</span>
          </div>
        )}
      </div>
    </section>
  );
}

function CorrelationPanel({ regions, correlations }) {
  return (
    <section className="ops-panel ops-correlation">
      <header>
        <div>
          <CircleGauge size={14} />
          <strong>Convergence engine</strong>
          <span>{correlations.length}</span>
        </div>
        <em>Rules-based</em>
      </header>
      <div className="ops-region-board">
        {regions.slice(0, 5).map((item) => (
          <div key={item.region}>
            <span>
              <strong>{item.region}</strong>
              <small>
                {item.count} signals · {item.categories.length} lanes
              </small>
            </span>
            <div>
              <i style={{ width: `${item.score}%` }} />
            </div>
            <em>{item.score}</em>
          </div>
        ))}
      </div>
      <div className="ops-correlation-list">
        {correlations.slice(0, 2).map((item) => (
          <article key={item.id}>
            <Zap size={13} />
            <div>
              <strong>{item.region} convergence</strong>
              <p>{item.statement}</p>
            </div>
          </article>
        ))}
        {correlations.length === 0 && (
          <p className="ops-no-correlation">
            No multi-category convergence meets the current display threshold.
          </p>
        )}
      </div>
    </section>
  );
}

function LiveChannelsPanel() {
  const [media, setMedia] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [activated, setActivated] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api("/api/v1/media/channels")
      .then((response) => {
        if (!active) return;
        setMedia(response.data);
        const firstLive = response.data.channels.find(
          (channel) => channel.status === "live",
        );
        setSelectedId(firstLive?.id || response.data.channels[0]?.id || null);
      })
      .catch((requestError) => active && setError(requestError.message));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) setPlaying(false);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    if (!playing) return undefined;
    let idleTimer;
    const resetIdle = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => setPlaying(false), 5 * 60 * 1000);
    };
    const events = ["pointerdown", "keydown", "scroll", "touchstart"];
    events.forEach((name) =>
      window.addEventListener(name, resetIdle, { passive: true }),
    );
    resetIdle();
    return () => {
      clearTimeout(idleTimer);
      events.forEach((name) => window.removeEventListener(name, resetIdle));
    };
  }, [playing]);

  const selected = media?.channels.find((channel) => channel.id === selectedId);
  const start = () => {
    if (!selected?.videoId) return;
    setActivated(true);
    setPlaying(true);
    setError("");
  };

  return (
    <section className="ops-panel ops-video" id="ops-channels">
      <header>
        <div>
          <Video size={14} />
          <strong>Live channels</strong>
          <span>{media?.liveCount || 0}</span>
        </div>
        <em>{media?.configured ? media.status : "API key required"}</em>
      </header>
      <div className="ops-video-stage">
        {activated && selected?.videoId ? (
          <YouTubePlayer
            videoId={selected.videoId}
            playing={playing}
            muted={muted}
            onError={setError}
          />
        ) : (
          <div className="ops-video-poster">
            {selected?.thumbnail && <img src={selected.thumbnail} alt="" />}
            <div>
              <Video size={23} />
              <strong>{selected?.name || "Live news network"}</strong>
              <span>
                {media?.configured
                  ? selected?.status || "Checking stream"
                  : "Add YOUTUBE_API_KEY on the server"}
              </span>
            </div>
            {selected?.videoId && (
              <button onClick={start} aria-label={`Play ${selected.name}`}>
                <Play size={18} fill="currentColor" />
              </button>
            )}
          </div>
        )}
        {activated && selected?.videoId && (
          <div className="ops-video-controls">
            <button onClick={() => setPlaying((value) => !value)}>
              {playing ? <Pause size={13} /> : <Play size={13} />}
            </button>
            <button onClick={() => setMuted((value) => !value)}>
              {muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
            </button>
            <span>
              <i className={playing ? "live" : ""} />{" "}
              {playing ? "LIVE" : "PAUSED"}
            </span>
            <a href={selected.watchUrl} target="_blank" rel="noreferrer">
              YOUTUBE <ExternalLink size={10} />
            </a>
          </div>
        )}
      </div>
      <div className="ops-channel-strip">
        {(media?.channels || []).map((channel) => (
          <button
            key={channel.id}
            className={`${selectedId === channel.id ? "active" : ""} ${channel.status}`}
            onClick={() => {
              setSelectedId(channel.id);
              setActivated(false);
              setPlaying(false);
              setError("");
            }}
          >
            <i />
            {channel.name}
          </button>
        ))}
      </div>
      {error && (
        <div className="ops-video-error">
          <TriangleAlert size={11} /> {error}
        </div>
      )}
      {!media?.configured && !error && (
        <div className="ops-video-note">
          The key stays server-side. YouTube embeds load only after a user
          presses play.
        </div>
      )}
    </section>
  );
}

function OpsBrief({ data }) {
  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function generate() {
    setLoading(true);
    setError("");
    try {
      setBrief(
        (await api("/api/v1/intelligence/brief", { method: "POST" })).data,
      );
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <section className="ops-panel ops-ai" id="ops-intel">
      <header>
        <div>
          <BrainCircuit size={14} />
          <strong>Intelligence brief</strong>
        </div>
        <span className="ops-ai-live">
          <i /> ON DEMAND
        </span>
      </header>
      {!brief ? (
        <div className="ops-brief-empty">
          <Sparkles size={22} />
          <strong>Source-grounded synthesis</strong>
          <p>
            Correlate {data?.events.length || 0} visible records into a concise
            operational readout.
          </p>
          <button onClick={generate} disabled={loading}>
            {loading ? (
              <>
                <RefreshCw className="spin" size={13} /> ANALYZING
              </>
            ) : (
              <>
                <Sparkles size={13} /> GENERATE BRIEF
              </>
            )}
          </button>
          {error && <small>{error}</small>}
        </div>
      ) : (
        <div className="ops-brief">
          <span>{brief.headline}</span>
          <ul>
            {brief.assessment.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <footer>
            <ShieldCheck size={11} /> {brief.generatedBy}
            <button onClick={generate}>
              <RefreshCw size={12} />
            </button>
          </footer>
        </div>
      )}
    </section>
  );
}

function CommandPalette({
  open,
  onClose,
  data,
  toggleLayer,
  setRegion,
  refresh,
  navigate,
}) {
  const [query, setQuery] = useState("");
  useEffect(() => {
    if (open) setQuery("");
  }, [open]);
  if (!open) return null;
  const commands = [
    {
      label: "Refresh all intelligence sources",
      group: "System",
      action: refresh,
    },
    {
      label: "Open administrator console",
      group: "Navigation",
      action: () => navigate("/login"),
    },
    {
      label: "Return to executive overview",
      group: "Navigation",
      action: () => navigate("/"),
    },
    ...Object.keys(regionCenters).map((region) => ({
      label: `Focus region: ${region}`,
      group: "Regions",
      action: () => setRegion(region),
    })),
    ...(data?.layers || []).map((layer) => ({
      label: `Toggle layer: ${layer.label}`,
      group: "Layers",
      action: () => toggleLayer(layer.id),
    })),
  ].filter((item) => item.label.toLowerCase().includes(query.toLowerCase()));
  return (
    <div
      className="command-layer"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <button
        className="command-scrim"
        onClick={onClose}
        aria-label="Close command palette"
      />
      <div className="command-palette">
        <header>
          <Search size={17} />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search commands, layers, regions…"
          />
          <kbd>ESC</kbd>
        </header>
        <div>
          {commands.slice(0, 12).map((command) => (
            <button
              key={command.label}
              onClick={() => {
                command.action();
                onClose();
              }}
            >
              <span>{command.label}</span>
              <em>{command.group}</em>
            </button>
          ))}
        </div>
        <footer>
          <span>↑↓ Navigate</span>
          <span>↵ Run command</span>
          <span>WORLDGPZ command interface</span>
        </footer>
      </div>
    </div>
  );
}

export default function Operations() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [providers, setProviders] = useState(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [region, setRegion] = useState("Global");
  const [range, setRange] = useState(168);
  const [activeLayers, setActiveLayers] = useState(
    () => new Set(allCategories),
  );
  const [focusedEvent, setFocusedEvent] = useState(null);
  const [layerOpen, setLayerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  async function load() {
    setRefreshing(true);
    setError("");
    try {
      const [dashboard, providerStatus] = await Promise.all([
        api("/api/v1/dashboard"),
        api("/api/v1/providers").catch(() => null),
      ]);
      setData(dashboard.data);
      setProviders(providerStatus?.data || null);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setRefreshing(false);
    }
  }
  useEffect(() => {
    load();
    const timer = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const handler = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
      }
      if (event.key === "Escape") setPaletteOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  useEffect(() => {
    setFocusedEvent(regionCenters[region]);
  }, [region]);

  const toggleLayer = (id) =>
    setActiveLayers((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const events = useMemo(() => {
    if (!data) return [];
    const cutoff = Number.isFinite(range)
      ? Date.now() - range * 60 * 60 * 1000
      : 0;
    return data.events.filter(
      (item) =>
        activeLayers.has(item.category) &&
        new Date(item.publishedAt).getTime() >= cutoff &&
        (region === "Global" || item.region === region),
    );
  }, [data, activeLayers, range, region]);

  if (!data && !error)
    return <LoadingScreen label="Building operational picture" />;
  if (!data && error)
    return (
      <main className="fatal-state">
        <Brand />
        <TriangleAlert size={35} />
        <h1>Operations link unavailable</h1>
        <p>{error}</p>
        <button className="button primary" onClick={load}>
          Retry
        </button>
      </main>
    );

  return (
    <main className="operations-shell">
      <OpsHeader
        data={data}
        region={region}
        setRegion={setRegion}
        refresh={load}
        refreshing={refreshing}
        openPalette={() => setPaletteOpen(true)}
      />
      <section className="ops-situation-bar">
        <span>Global situation</span>
        <strong>{formatUtc(data.generatedAt)} UTC</strong>
        <div>
          <span>
            <i className="critical" /> High alert
          </span>
          <span>
            <i className="high" /> Elevated
          </span>
          <span>
            <i className="low" /> Monitoring
          </span>
        </div>
      </section>
      <ProviderChips providers={providers} />
      {error && (
        <div className="ops-error">
          <TriangleAlert size={13} /> {error}
        </div>
      )}
      <section className="ops-map-section" id="ops-map">
        <div className="ops-timebar">
          {ranges.map((item) => (
            <button
              key={item.label}
              className={range === item.hours ? "active" : ""}
              onClick={() => setRange(item.hours)}
            >
              {item.label}
            </button>
          ))}
          <button
            className="ops-layer-mobile"
            onClick={() => setLayerOpen(true)}
          >
            <Layers3 size={13} /> Layers
          </button>
        </div>
        <LayerControl
          layers={data.layers || []}
          activeLayers={activeLayers}
          toggleLayer={toggleLayer}
          open={layerOpen}
          onClose={() => setLayerOpen(false)}
        />
        <div className="ops-map">
          <WorldMap
            events={events}
            focusedEvent={focusedEvent?.title ? focusedEvent : focusedEvent}
            onFocus={setFocusedEvent}
          />
        </div>
        <div className="ops-map-status">
          <span>
            <Radio size={11} /> {events.length} visible
          </span>
          <span>{activeLayers.size} layers</span>
          <span>
            {data.metrics.sourcesOnline}/{data.metrics.sourcesTotal} sources
          </span>
        </div>
        <div className="ops-view-toggle">
          <button className="active">2D</button>
          <button
            title="3D globe is planned for a future GPU renderer"
            disabled
          >
            3D
          </button>
        </div>
        {focusedEvent?.title && (
          <article className="ops-map-detail">
            <button onClick={() => setFocusedEvent(null)}>
              <X size={13} />
            </button>
            <span className={`table-badge ${focusedEvent.severity}`}>
              {titleCase(focusedEvent.severity)}
            </span>
            <h2>{focusedEvent.title}</h2>
            <p>{focusedEvent.summary}</p>
            <footer>
              <span>
                {focusedEvent.region} · {focusedEvent.sourceName}
              </span>
              {focusedEvent.sourceUrl && (
                <a
                  href={focusedEvent.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  SOURCE <ExternalLink size={10} />
                </a>
              )}
            </footer>
          </article>
        )}
      </section>
      <section className="ops-panel-grid">
        <SignalPanel
          events={events}
          news={data.news || []}
          onFocus={(item) => {
            setFocusedEvent(item);
            document
              .getElementById("ops-map")
              ?.scrollIntoView({ behavior: "smooth" });
          }}
        />
        <LiveChannelsPanel />
        <WebcamsPanel />
        <WeatherPanel />
        <MarketsPanel />
        <EnergyMacroPanel />
        <TrackingPanel />
        <CorrelationPanel
          regions={data.regions || []}
          correlations={data.correlations || []}
        />
        <OpsBrief data={data} />
      </section>
      <footer className="ops-footer">
        <span>
          <ShieldCheck size={11} /> Verify consequential decisions against
          primary sources
        </span>
        <span>Last sync {relativeTime(data.generatedAt)}</span>
        <Link to="/">Executive view</Link>
      </footer>
      <nav className="ops-mobile-nav">
        <a href="#ops-map">
          <MapIcon size={19} />
          <span>Map</span>
        </a>
        <a href="#ops-feed">
          <List size={19} />
          <span>Feed</span>
        </a>
        <a href="#ops-channels">
          <Video size={19} />
          <span>Channels</span>
        </a>
        <Link to="/login">
          <LockKeyhole size={19} />
          <span>Admin</span>
        </Link>
      </nav>
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        data={data}
        toggleLayer={toggleLayer}
        setRegion={setRegion}
        refresh={load}
        navigate={navigate}
      />
    </main>
  );
}
