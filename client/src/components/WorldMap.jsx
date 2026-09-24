import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import {
  Circle,
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import {
  ExternalLink,
  LocateFixed,
  Minus,
  Plus,
  Satellite,
} from "lucide-react";
import { relativeTime, titleCase } from "../lib/format.js";
import { useIss } from "../lib/useIss.js";

const colors = {
  critical: "#ff2e4d",
  high: "#ffb020",
  medium: "#58b6ff",
  low: "#46f0a0",
};

/** Great-circle-ish arc between HQ and a locked target. */
function arc(from, to, segments = 32) {
  const points = [];
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    points.push([
      from[0] + (to[0] - from[0]) * t,
      from[1] + (to[1] - from[1]) * t,
    ]);
  }
  return points;
}

function MapController({ focusedEvent }) {
  const map = useMap();
  useEffect(() => {
    if (focusedEvent && Number.isFinite(Number(focusedEvent.latitude)))
      map.flyTo(
        [Number(focusedEvent.latitude), Number(focusedEvent.longitude)],
        Math.max(map.getZoom(), 4),
        { duration: 0.9 },
      );
  }, [focusedEvent, map]);
  return null;
}

function CrosshairReadout() {
  const [fix, setFix] = useState(null);
  useMapEvents({
    mousemove(event) {
      setFix(event.latlng);
    },
    mouseout() {
      setFix(null);
    },
  });
  if (!fix) return null;
  const lat = `${Math.abs(fix.lat).toFixed(3)}°${fix.lat >= 0 ? "N" : "S"}`;
  const lon = `${Math.abs(fix.lng).toFixed(3)}°${fix.lng >= 0 ? "E" : "W"}`;
  return (
    <div className="map-coords">
      TRK ▸ {lat} · {lon}
    </div>
  );
}

function SatTelemetry() {
  const { fix, status } = useIss();
  if (status !== "locked" || !fix) {
    return (
      <div className="map-sat offline">
        <i /> SAT LINK ▸ STANDBY
      </div>
    );
  }
  const speed = fix.velocity
    ? ` · ${Math.round(fix.velocity).toLocaleString("en")} KM/H`
    : "";
  const alt = fix.altitude ? ` · ALT ${Math.round(fix.altitude)} KM` : "";
  return (
    <div className="map-sat">
      <i /> ISS ZARYA ▸ LOCK {speed}
      {alt}
    </div>
  );
}

function MapButtons() {
  const map = useMap();
  return (
    <div className="map-controls" aria-label="Map controls">
      <button type="button" onClick={() => map.zoomIn()} aria-label="Zoom in">
        <Plus size={16} />
      </button>
      <button type="button" onClick={() => map.zoomOut()} aria-label="Zoom out">
        <Minus size={16} />
      </button>
      <button
        type="button"
        onClick={() => map.flyTo([20, 0], 2.25, { duration: 0.8 })}
        aria-label="Reset global view"
      >
        <LocateFixed size={16} />
      </button>
    </div>
  );
}

const targetIcon = (severity, locked) =>
  L.divIcon({
    className: "",
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    html: `<div class="target-marker severity-${severity} ${locked ? "locked" : ""}">
      <span class="ring"></span>
      <span class="ping"></span>
      <span class="core"></span>
      <span class="tag">${severity === "critical" ? "▲ PRIORITY" : "TARGET"}</span>
    </div>`,
  });

const issIcon = () =>
  L.divIcon({
    className: "",
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    html: `<div class="iss-marker"><span class="orbit"></span><span class="sat-core"></span></div>`,
  });

export default function WorldMap({
  events,
  focusedEvent,
  onFocus,
  scanning = false,
  satellites = [],
}) {
  const mappable = events.filter(
    (item) =>
      Number.isFinite(Number(item.latitude)) &&
      Number.isFinite(Number(item.longitude)),
  );
  const locked = focusedEvent?.id
    ? mappable.find((item) => item.id === focusedEvent.id)
    : null;
  const lockArc = useMemo(
    () =>
      locked
        ? arc([20, 0], [Number(locked.latitude), Number(locked.longitude)])
        : null,
    [locked],
  );

  return (
    <div
      className={`map-stage-full ${scanning ? "scanning" : ""}`}
      style={{ position: "absolute", inset: 0 }}
    >
      <MapContainer
        center={[20, 0]}
        zoom={2.25}
        minZoom={2}
        maxZoom={9}
        zoomControl={false}
        className="world-map"
        worldCopyJump
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
        />
        <TileLayer
          attribution=""
          url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png"
          pane="overlayPane"
        />

        {mappable.map((event) => (
          <CircleMarker
            key={event.id}
            center={[event.latitude, event.longitude]}
            radius={4}
            pathOptions={{
              color: "transparent",
              fillColor: "transparent",
              fillOpacity: 0,
            }}
            eventHandlers={{ click: () => onFocus?.(event) }}
          >
            <Popup className="signal-popup">
              <div className="popup-content">
                <div className="popup-topline">
                  <span className={`severity-dot ${event.severity}`} />
                  {titleCase(event.category)} · SIGNAL ACQUIRED
                </div>
                <strong>{event.title}</strong>
                <p>{event.summary || `${event.sourceName} source signal`}</p>
                {Number(event.magnitude) >= 5 && (
                  <span className="impact-note">
                    EST. felt radius ≈{" "}
                    {Math.round(
                      12 * Math.exp(0.5 * Number(event.magnitude)),
                    ).toLocaleString("en")}{" "}
                    km (attenuation estimate)
                  </span>
                )}
                <div className="popup-meta">
                  <span>{event.region}</span>
                  <span>{relativeTime(event.publishedAt)}</span>
                </div>
                {event.sourceUrl && (
                  <a href={event.sourceUrl} target="_blank" rel="noreferrer">
                    Open primary source <ExternalLink size={12} />
                  </a>
                )}
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {mappable.map((event) => (
          <Marker
            key={`reticle-${event.id}`}
            position={[event.latitude, event.longitude]}
            icon={targetIcon(event.severity, focusedEvent?.id === event.id)}
            eventHandlers={{ click: () => onFocus?.(event) }}
            keyboard={false}
          />
        ))}

        {lockArc && (
          <Polyline
            positions={lockArc}
            pathOptions={{
              color: "#00e5ff",
              weight: 1.4,
              opacity: 0.85,
              dashArray: "5 7",
            }}
          />
        )}

        {/* Estimated felt-radius rings for significant seismic events.
            Approximation: r_km = 12 * e^(0.5*M) — inverse-square attenuation
            heuristic, labeled ESTIMATE everywhere it appears. */}
        {mappable
          .filter((event) => Number(event.magnitude) >= 5)
          .map((event) => (
            <Circle
              key={`impact-${event.id}`}
              center={[Number(event.latitude), Number(event.longitude)]}
              radius={Math.round(
                12_000 * Math.exp(0.5 * Number(event.magnitude)),
              )}
              pathOptions={{
                color: "#ffb020",
                weight: 1,
                opacity: 0.45,
                dashArray: "4 6",
                fillColor: "#ffb020",
                fillOpacity: 0.04,
              }}
              interactive={false}
            />
          ))}
        {satellites.map((sat) => (
          <CircleMarker
            key={sat.name}
            center={[sat.latitude, sat.longitude]}
            radius={3.5}
            pathOptions={{
              color: "#a78bff",
              fillColor: "#a78bff",
              fillOpacity: 0.95,
              weight: 1,
            }}
          >
            <Popup className="signal-popup">
              <div className="popup-content">
                <div className="popup-topline">
                  <Satellite size={12} /> ORBITAL ASSET · SGP4
                </div>
                <strong>{sat.name}</strong>
                <div className="popup-meta">
                  <span>
                    {Math.abs(sat.latitude).toFixed(1)}°
                    {sat.latitude >= 0 ? "N" : "S"}{" "}
                    {Math.abs(sat.longitude).toFixed(1)}°
                    {sat.longitude >= 0 ? "E" : "W"}
                  </span>
                  <span>
                    {Math.round(sat.altitudeKm).toLocaleString("en")} km
                    {sat.speedKmH
                      ? ` · ${Math.round(sat.speedKmH).toLocaleString("en")} km/h`
                      : ""}
                  </span>
                </div>
              </div>
            </Popup>
          </CircleMarker>
        ))}
        <SatMarker />
        <MapController focusedEvent={focusedEvent} />
        <CrosshairReadout />
        <MapButtons />
      </MapContainer>

      <div className="map-hud" aria-hidden="true">
        <div className="map-sweep" />
        <div className="map-rings" />
        <div className="map-crosshair-h" />
        <div className="map-crosshair-v" />
        <span className="map-corner tl" />
        <span className="map-corner tr" />
        <span className="map-corner bl" />
        <span className="map-corner br" />
      </div>
      <SatTelemetry />
    </div>
  );
}

function SatMarker() {
  const { fix, status } = useIss();
  if (status !== "locked" || !fix) return null;
  return (
    <Marker
      position={[fix.latitude, fix.longitude]}
      icon={issIcon()}
      keyboard={false}
    >
      <Popup className="signal-popup">
        <div className="popup-content">
          <div className="popup-topline">
            <Satellite size={12} /> ORBITAL ASSET · ISS ZARYA
          </div>
          <strong>International Space Station</strong>
          <div className="popup-meta">
            <span>
              {fix.latitude.toFixed(2)}° / {fix.longitude.toFixed(2)}°
            </span>
            <span>Live telemetry</span>
          </div>
        </div>
      </Popup>
    </Marker>
  );
}
