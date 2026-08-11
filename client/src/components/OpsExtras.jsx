import { useEffect, useState } from "react";
import {
  Activity,
  Camera,
  ExternalLink,
  Fuel,
  Plane,
  Play,
  Radio,
  RefreshCw,
  Ship,
  TrendingUp,
  TriangleAlert,
  WifiOff,
  X,
} from "lucide-react";
import { api } from "../lib/api.js";
import { relativeTime } from "../lib/format.js";

const REFRESH_MS = 5 * 60 * 1000;

const statusLabel = (data, fallback = "Offline") =>
  !data
    ? "Loading"
    : data.status === "operational"
      ? "Live"
      : data.status === "connecting"
        ? "Connecting"
        : data.status === "pending"
          ? "Pending"
          : data.status === "degraded"
            ? "Degraded"
            : data.status === "not-configured"
              ? "API key required"
              : fallback;

const statusClass = (data) => data?.status || "loading";

function useProviderData(path) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    api(path)
      .then((response) => active && setData(response.data))
      .catch((requestError) => active && setError(requestError.message));
    return () => {
      active = false;
    };
  }, [path, reloadKey]);

  useEffect(() => {
    const timer = setInterval(() => setReloadKey((key) => key + 1), REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  return { data, error, reload: () => setReloadKey((key) => key + 1) };
}

function PanelHeader({ icon, title, data, action }) {
  return (
    <header>
      <div>
        {icon}
        <strong>{title}</strong>
      </div>
      <em className={`ops-provider-status ${statusClass(data)}`}>
        {statusLabel(data)}
        {action && (
          <button
            className="ops-mini-refresh"
            onClick={action}
            aria-label="Refresh"
          >
            <RefreshCw size={10} />
          </button>
        )}
      </em>
    </header>
  );
}

function NotConfigured({ children }) {
  return (
    <div className="ops-empty">
      <TriangleAlert size={16} />
      <span>Add the provider key on the server to activate</span>
      <small>{children}</small>
    </div>
  );
}

function PanelError({ message }) {
  return (
    <div className="ops-empty">
      <TriangleAlert size={16} />
      <span>{message}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Provider status chips (all 12 keys at a glance)                     */
/* ------------------------------------------------------------------ */

const chipStatusClass = (status) =>
  status === "operational"
    ? "ok"
    : status === "degraded"
      ? "bad"
      : status === "connecting" || status === "pending"
        ? "warn"
        : "off";

export function ProviderChips({ providers }) {
  if (!providers) return null;
  return (
    <div className="ops-provider-strip" aria-label="Provider key status">
      <span className="ops-provider-strip-label">
        <Activity size={10} /> Providers
      </span>
      <div className="ops-provider-chips">
        {providers.map((provider) => (
          <span
            key={provider.id}
            className={`ops-chip ${chipStatusClass(provider.status)}`}
            title={`${provider.name}: ${provider.status}`}
          >
            <i />
            {provider.name}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Webcams panel (Windy)                                               */
/* ------------------------------------------------------------------ */

export function WebcamsPanel() {
  const { data, error, reload } = useProviderData("/api/v1/webcams");
  const [activeId, setActiveId] = useState(null);
  const active = data?.webcams?.find((webcam) => webcam.id === activeId);

  return (
    <section className="ops-panel ops-webcams">
      <PanelHeader
        icon={<Camera size={14} />}
        title="Webcams"
        data={data}
        action={reload}
      />
      {!data && !error && (
        <div className="ops-empty">Loading webcam network…</div>
      )}
      {error && <PanelError message={error} />}
      {data?.status === "not-configured" && (
        <NotConfigured>WINDY_API_KEY on the server</NotConfigured>
      )}
      {data?.status === "degraded" && (
        <PanelError message={data.error || "Windy webcam feed unavailable"} />
      )}
      {data?.status === "operational" && (
        <div className="ops-webcam-stage">
          {active ? (
            <div className="ops-webcam-embed">
              <iframe
                src={active.playerUrl}
                title={active.title}
                allow="autoplay; fullscreen; encrypted-media"
                referrerPolicy="strict-origin-when-cross-origin"
              />
              <button
                className="ops-webcam-close"
                onClick={() => setActiveId(null)}
                aria-label="Close webcam"
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <div className="ops-webcam-grid">
              {data.webcams.slice(0, 6).map((webcam) => (
                <article key={webcam.id} className="ops-webcam-card">
                  {webcam.thumbnail ? (
                    <img src={webcam.thumbnail} alt="" loading="lazy" />
                  ) : (
                    <div className="ops-webcam-noimg">
                      <Camera size={16} />
                    </div>
                  )}
                  <span>
                    <strong>{webcam.title}</strong>
                    <small>
                      {[webcam.city, webcam.country]
                        .filter(Boolean)
                        .join(", ") || "Worldwide"}
                    </small>
                  </span>
                  <button
                    onClick={() => setActiveId(webcam.id)}
                    aria-label={`Watch ${webcam.title}`}
                  >
                    <Play size={11} fill="currentColor" />
                  </button>
                </article>
              ))}
            </div>
          )}
          <footer className="ops-webcam-foot">
            <span>
              {active
                ? active.title
                : `${data.webcams.length} active cams · ${data.attribution || "Powered by Windy.com"}`}
            </span>
            {active && (
              <a href={active.windyUrl} target="_blank" rel="noreferrer">
                OPEN ON WINDY <ExternalLink size={9} />
              </a>
            )}
          </footer>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Markets panel (Finnhub)                                             */
/* ------------------------------------------------------------------ */

const quoteDelta = (quote) =>
  quote.changePercent == null ? null : quote.changePercent;

export function MarketsPanel() {
  const { data, error, reload } = useProviderData("/api/v1/markets");
  return (
    <section className="ops-panel ops-markets">
      <PanelHeader
        icon={<TrendingUp size={14} />}
        title="Markets"
        data={data}
        action={reload}
      />
      {!data && !error && <div className="ops-empty">Loading market data…</div>}
      {error && <PanelError message={error} />}
      {data?.status === "not-configured" && (
        <NotConfigured>FINNHUB_API_KEY on the server</NotConfigured>
      )}
      {data?.status === "degraded" && (
        <PanelError message={data.error || "Market feed unavailable"} />
      )}
      {data?.status === "operational" && (
        <div className="ops-quote-list">
          {data.quotes.map((quote) => {
            const delta = quoteDelta(quote);
            return (
              <div key={quote.symbol} className="ops-quote-row">
                <span>
                  <strong>{quote.name}</strong>
                  <small>{quote.symbol}</small>
                </span>
                <em className={delta == null ? "" : delta >= 0 ? "up" : "down"}>
                  {delta == null
                    ? "—"
                    : `${delta >= 0 ? "+" : ""}${delta.toFixed(2)}%`}
                </em>
                <b>
                  {quote.current?.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }) ?? "—"}
                </b>
              </div>
            );
          })}
          <footer className="ops-panel-note">
            {data.marketNote || "Indicative delayed quotes"}
          </footer>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Energy + Macro panel (EIA / FRED)                                   */
/* ------------------------------------------------------------------ */

function SeriesRows({ series }) {
  return (
    <div className="ops-quote-list">
      {series.map((item) => {
        const delta =
          item.value != null && item.previousValue != null
            ? item.value - item.previousValue
            : null;
        return (
          <div key={item.id} className="ops-quote-row">
            <span>
              <strong>{item.name}</strong>
              <small>{item.period || item.date || "latest"}</small>
            </span>
            <em className={delta == null ? "" : delta >= 0 ? "up" : "down"}>
              {delta == null
                ? "—"
                : `${delta >= 0 ? "+" : ""}${delta.toFixed(2)}`}
            </em>
            <b>
              {item.value?.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
              <small>{item.unit}</small>
            </b>
          </div>
        );
      })}
    </div>
  );
}

export function EnergyMacroPanel() {
  const energy = useProviderData("/api/v1/energy");
  const macro = useProviderData("/api/v1/macro");
  const [tab, setTab] = useState("energy");
  const current = tab === "energy" ? energy : macro;
  const data = current.data;

  return (
    <section className="ops-panel ops-energy">
      <header>
        <div>
          <Fuel size={14} />
          <strong>Energy &amp; macro</strong>
        </div>
        <div className="ops-panel-tabs">
          <button
            className={tab === "energy" ? "active" : ""}
            onClick={() => setTab("energy")}
          >
            Energy
          </button>
          <button
            className={tab === "macro" ? "active" : ""}
            onClick={() => setTab("macro")}
          >
            Macro
          </button>
        </div>
      </header>
      {!data && !current.error && (
        <div className="ops-empty">Loading indicators…</div>
      )}
      {current.error && <PanelError message={current.error} />}
      {data?.status === "not-configured" && (
        <NotConfigured>
          {tab === "energy" ? "EIA_API_KEY" : "FRED_API_KEY"} on the server
        </NotConfigured>
      )}
      {data?.status === "degraded" && (
        <PanelError message={data.error || "Indicator feed unavailable"} />
      )}
      {data?.status === "operational" && <SeriesRows series={data.series} />}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Live tracking panel (ships / flights / outages)                     */
/* ------------------------------------------------------------------ */

function TrackingRow({ children }) {
  return <div className="ops-tracking-row">{children}</div>;
}

function ShipsTab({ data }) {
  if (!data?.vessels?.length)
    return (
      <div className="ops-empty">
        <Ship size={16} />
        <span>No vessels in the current relay window</span>
      </div>
    );
  return (
    <div className="ops-tracking-list">
      {data.vessels.map((vessel) => (
        <TrackingRow key={vessel.mmsi}>
          <span>
            <strong>{vessel.name || `Vessel ${vessel.mmsi}`}</strong>
            <small>
              {vessel.destination || "destination unknown"} · MMSI {vessel.mmsi}
            </small>
          </span>
          <em>
            {vessel.speedKnots == null
              ? "—"
              : `${vessel.speedKnots.toFixed(1)} kn`}
          </em>
          <b>
            {vessel.latitude?.toFixed(1)}°, {vessel.longitude?.toFixed(1)}°
          </b>
        </TrackingRow>
      ))}
      <footer className="ops-panel-note">
        {data.vesselCount} tracked · {data.messageCount} messages
        {data.lastMessageAt
          ? ` · last ${relativeTime(data.lastMessageAt)}`
          : ""}
      </footer>
    </div>
  );
}

function FlightsTab({ data }) {
  if (!data?.aircraft?.length)
    return (
      <div className="ops-empty">
        <Plane size={16} />
        <span>No aircraft in the current window</span>
      </div>
    );
  return (
    <div className="ops-tracking-list">
      {data.aircraft.slice(0, 24).map((aircraft) => (
        <TrackingRow key={aircraft.icao24}>
          <span>
            <strong>{aircraft.callsign}</strong>
            <small>{aircraft.originCountry}</small>
          </span>
          <em>
            {aircraft.altitudeM == null
              ? "—"
              : `${Math.round(aircraft.altitudeM / 1000).toFixed(1)} km`}
          </em>
          <b>
            {aircraft.velocityMs == null
              ? "—"
              : `${Math.round(aircraft.velocityMs * 3.6)} km/h`}
          </b>
        </TrackingRow>
      ))}
      <footer className="ops-panel-note">
        {data.total} aircraft in view · live snapshot
      </footer>
    </div>
  );
}

function OutagesTab({ data }) {
  if (!data?.items?.length)
    return (
      <div className="ops-empty">
        <WifiOff size={16} />
        <span>No verified outages or anomalies in this window</span>
      </div>
    );
  return (
    <div className="ops-tracking-list">
      {data.items.slice(0, 24).map((item, index) => (
        <TrackingRow key={`${item.kind}-${item.location}-${index}`}>
          <span>
            <strong>{item.location}</strong>
            <small>
              {item.kind === "outage" ? "Verified outage" : "Traffic anomaly"}
            </small>
          </span>
          <em className={item.kind === "outage" ? "bad" : "warn"}>
            {item.count} {item.count === 1 ? "signal" : "signals"}
          </em>
          <b>{item.asnCount ? `${item.asnCount} ASNs` : "—"}</b>
        </TrackingRow>
      ))}
      <footer className="ops-panel-note">
        Radar-detected signals; verify before acting
      </footer>
    </div>
  );
}

export function TrackingPanel() {
  const ships = useProviderData("/api/v1/ships");
  const flights = useProviderData("/api/v1/flights");
  const outages = useProviderData("/api/v1/outages");
  const [tab, setTab] = useState("ships");
  const tabs = {
    ships: {
      label: "Ships",
      data: ships.data,
      error: ships.error,
      icon: <Ship size={14} />,
    },
    flights: {
      label: "Flights",
      data: flights.data,
      error: flights.error,
      icon: <Plane size={14} />,
    },
    outages: {
      label: "Outages",
      data: outages.data,
      error: outages.error,
      icon: <WifiOff size={14} />,
    },
  };
  const current = tabs[tab];

  return (
    <section className="ops-panel ops-tracking">
      <header>
        <div>
          <Radio size={14} />
          <strong>Live tracking</strong>
        </div>
        <div className="ops-panel-tabs">
          {Object.entries(tabs).map(([key, item]) => (
            <button
              key={key}
              className={tab === key ? "active" : ""}
              onClick={() => setTab(key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>
      {!current.data && !current.error && (
        <div className="ops-empty">Loading live feeds…</div>
      )}
      {current.error && <PanelError message={current.error} />}
      {current.data?.status === "not-configured" && (
        <NotConfigured>
          {tab === "ships"
            ? "AISSTREAM_API_KEY"
            : tab === "flights"
              ? "OPENSKY_CLIENT_ID + OPENSKY_CLIENT_SECRET"
              : "CLOUDFLARE_API_TOKEN"}{" "}
          on the server
        </NotConfigured>
      )}
      {current.data?.status === "degraded" && (
        <PanelError message={current.data.error || "Live feed unavailable"} />
      )}
      {current.data?.status === "operational" &&
        (tab === "ships" ? (
          <ShipsTab data={current.data} />
        ) : tab === "flights" ? (
          <FlightsTab data={current.data} />
        ) : (
          <OutagesTab data={current.data} />
        ))}
      {current.data?.status === "connecting" && (
        <div className="ops-empty">
          <RefreshCw className="spin" size={16} />
          <span>Connecting to live relay…</span>
        </div>
      )}
    </section>
  );
}
