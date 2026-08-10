import { useEffect } from "react";
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import { ExternalLink, LocateFixed, Minus, Plus } from "lucide-react";
import { relativeTime, titleCase } from "../lib/format.js";

const colors = {
  critical: "#ff6d57",
  high: "#ffad4d",
  medium: "#f3d767",
  low: "#8ce66a",
};

function MapController({ focusedEvent }) {
  const map = useMap();
  useEffect(() => {
    if (focusedEvent)
      map.flyTo(
        [focusedEvent.latitude, focusedEvent.longitude],
        Math.max(map.getZoom(), 4),
        { duration: 0.8 },
      );
  }, [focusedEvent, map]);
  return null;
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
        onClick={() => map.flyTo([20, 0], 2.25)}
        aria-label="Reset global view"
      >
        <LocateFixed size={16} />
      </button>
    </div>
  );
}

export default function WorldMap({ events, focusedEvent, onFocus }) {
  const mappable = events.filter(
    (item) =>
      Number.isFinite(Number(item.latitude)) &&
      Number.isFinite(Number(item.longitude)),
  );
  return (
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
          radius={
            event.severity === "critical"
              ? 9
              : event.severity === "high"
                ? 7
                : 5
          }
          pathOptions={{
            color: colors[event.severity] || colors.low,
            fillColor: colors[event.severity] || colors.low,
            fillOpacity: 0.68,
            opacity: 0.9,
            weight: 1,
          }}
          eventHandlers={{ click: () => onFocus?.(event) }}
        >
          <Popup className="signal-popup">
            <div className="popup-content">
              <div className="popup-topline">
                <span className={`severity-dot ${event.severity}`} />
                {titleCase(event.category)}
              </div>
              <strong>{event.title}</strong>
              <p>{event.summary || `${event.sourceName} source signal`}</p>
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
      <MapController focusedEvent={focusedEvent} />
      <MapButtons />
    </MapContainer>
  );
}
