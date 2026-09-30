import { useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';

const LAYERS = [
  ['seismic', 'Seismic', '◉'], ['natural', 'Natural', '✳'], ['conflicts', 'Conflict', '◇'], ['fires', 'Fires', '⌁'],
  ['weather', 'Weather', '☼'], ['flights', 'Flights', '↗'], ['ships', 'Vessels', '⌑'], ['iss', 'ISS', '✣'], ['infrastructure', 'Context', '◎'],
];
const layerColors = { seismic: '#ff6a62', natural: '#7ed2b2', conflict: '#f4a353', fire: '#ff9b50', infrastructure: '#b29af3' };
const asNumber = (value) => value === null || value === undefined || value === '' ? null : (Number.isFinite(Number(value)) ? Number(value) : null);
const validPoint = (item, latKey = 'latitude', lonKey = 'longitude') => asNumber(item?.[latKey]) !== null && asNumber(item?.[lonKey]) !== null;

function MapFocus({ focus }) {
  const map = useMap();
  useEffect(() => {
    if (focus && validPoint(focus)) map.flyTo([Number(focus.latitude), Number(focus.longitude)], Math.max(map.getZoom(), 5), { duration: 1.1 });
  }, [focus, map]);
  return null;
}

function EventMarker({ item, color, radius = 6, fillOpacity = 0.78, onSelect }) {
  if (!validPoint(item)) return null;
  const position = [Number(item.latitude), Number(item.longitude)];
  return <CircleMarker center={position} radius={radius} pathOptions={{ color, fillColor: color, fillOpacity, weight: 1, opacity: 0.88 }} eventHandlers={{ click: () => onSelect?.(item) }}>
    <Popup><div className="map-popup"><span className="map-popup-kicker">{String(item.type || 'SIGNAL').toUpperCase()} · {item.source || 'SOURCE'}</span><strong>{item.title || item.place || 'Global signal'}</strong>{item.description && <span>{item.description}</span>}{item.magnitude && <span>Magnitude {Number(item.magnitude).toFixed(1)} · depth {item.depth} km</span>}{item.fatalities > 0 && <span>{item.fatalities} fatalities reported</span>}{item.url && <a href={item.url} target="_blank" rel="noreferrer">Open source ↗</a>}</div></Popup>
  </CircleMarker>;
}

function mapIcon(className, icon, color, rotation = 0) {
  const angle = Number(rotation) || 0;
  return L.divIcon({
    className: `worldgpz-map-icon ${className}`,
    html: `<span style="color:${color};transform:rotate(${angle}deg)">${icon}</span>`,
    iconSize: [22, 22], iconAnchor: [11, 11],
  });
}

function LayerControl({ active, setActive, counts }) {
  return <div className="map-layer-control" aria-label="Map data layers">
    <div className="layer-control-title"><span>LAYERS</span><span>{Object.values(active).filter(Boolean).length} / {LAYERS.length}</span></div>
    <div className="layer-control-grid">
      {LAYERS.map(([id, label, icon]) => <button key={id} className={active[id] ? 'enabled' : ''} onClick={() => setActive((previous) => ({ ...previous, [id]: !previous[id] }))} aria-pressed={Boolean(active[id])}>
        <span className="layer-icon">{icon}</span><span>{label}</span><small>{counts[id] ?? 0}</small>
      </button>)}
    </div>
  </div>;
}

export default function WorldMap({ state, focusEvent }) {
  const [active, setActive] = useState({ seismic: true, natural: true, conflicts: true, fires: true, weather: true, flights: true, ships: true, iss: true, infrastructure: true });
  const events = state.events || [];
  const seismic = useMemo(() => events.filter((event) => event.type === 'seismic'), [events]);
  const natural = useMemo(() => events.filter((event) => event.type === 'natural'), [events]);
  const conflicts = state.conflicts?.length ? state.conflicts : events.filter((event) => event.type === 'conflict');
  const contextPoints = events.filter((event) => event.type === 'infrastructure');
  const counts = {
    seismic: seismic.length, natural: natural.length, conflicts: conflicts.length,
    fires: state.fires?.length || events.filter((event) => event.type === 'fire').length,
    weather: state.weather?.length || 0, flights: state.flights?.length || 0, ships: state.ships?.length || 0,
    iss: state.iss?.latitude != null ? 1 : 0, infrastructure: contextPoints.length,
  };

  return <div className="map-canvas">
    <MapContainer center={[21, 13]} zoom={2} minZoom={2} maxZoom={12} scrollWheelZoom zoomControl={false} worldCopyJump className="leaflet-map">
      <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" subdomains="abcd" maxZoom={19} attribution="© OpenStreetMap contributors © CARTO" />
      <MapFocus focus={focusEvent} />
      {active.seismic && seismic.slice(0, 350).map((event) => <EventMarker key={event.id || event.external_id} item={event} color={layerColors.seismic} radius={Math.max(4, Math.min(15, (Number(event.magnitude) || 4) * 1.7))} onSelect={() => {}} />)}
      {active.natural && natural.slice(0, 220).map((event) => <EventMarker key={event.id || event.external_id} item={event} color={layerColors.natural} radius={6} />)}
      {active.conflicts && conflicts.slice(0, 250).map((event) => <EventMarker key={event.id || event.external_id} item={event} color={layerColors.conflict} radius={Math.max(5, Math.min(12, (Number(event.fatalities) || 0) + 4))} />)}
      {active.fires && (state.fires?.length ? state.fires : events.filter((event) => event.type === 'fire')).slice(0, 500).map((event) => <EventMarker key={event.id || event.external_id} item={event} color={layerColors.fire} radius={Math.max(2, Math.min(6, (Number(event.frp) || 20) / 20))} fillOpacity={0.72} />)}
      {active.infrastructure && contextPoints.map((event) => <EventMarker key={event.id || event.external_id} item={event} color={layerColors.infrastructure} radius={7} />)}
      {active.weather && (state.weather || []).map((city) => validPoint(city) && <Marker key={city.name} position={[Number(city.latitude), Number(city.longitude)]} icon={mapIcon('weather-pin', '◌', '#72c7ee')}>
        <Popup><div className="map-popup"><span className="map-popup-kicker">WEATHER · {city.source || 'WEATHER FEED'}</span><strong>{city.name}, {city.country}</strong><span>{city.description}</span><span>{Math.round(city.temperature)}°C · humidity {city.humidity}% · wind {Math.round((city.windSpeed || 0) * 3.6)} km/h</span></div></Popup>
      </Marker>)}
      {active.flights && (state.flights || []).filter((flight) => validPoint(flight) && !flight.onGround).slice(0, 300).map((flight) => <Marker key={flight.icao24} position={[Number(flight.latitude), Number(flight.longitude)]} icon={mapIcon('flight-pin', '✈', flight.military ? '#ff726d' : '#6ebcf4', flight.heading)}>
        <Popup><div className="map-popup"><span className="map-popup-kicker">OPENSKY · {flight.military ? 'MILITARY CALLSIGN MATCH' : 'AIRCRAFT'}</span><strong>{flight.callsign || 'Unknown aircraft'}</strong><span>{flight.origin || 'Origin unavailable'}</span><span>Altitude {Math.round(flight.altitude || 0).toLocaleString()} m · speed {Math.round((flight.velocity || 0) * 3.6)} km/h</span></div></Popup>
      </Marker>)}
      {active.ships && (state.ships || []).filter((ship) => validPoint(ship)).slice(0, 300).map((ship) => <Marker key={ship.mmsi} position={[Number(ship.latitude), Number(ship.longitude)]} icon={mapIcon('ship-pin', '▲', '#66d6b0', ship.heading)}>
        <Popup><div className="map-popup"><span className="map-popup-kicker">AISSTREAM · VESSEL POSITION</span><strong>{ship.name || 'Unknown vessel'}</strong><span>MMSI {ship.mmsi}</span><span>Speed {Number(ship.speed || 0).toFixed(1)} kn · heading {Math.round(ship.heading || 0)}°</span></div></Popup>
      </Marker>)}
      {active.iss && validPoint(state.iss) && <Marker position={[Number(state.iss.latitude), Number(state.iss.longitude)]} icon={mapIcon('iss-pin', '✣', '#f7f0d4')}>
        <Popup><div className="map-popup"><span className="map-popup-kicker">ORBITAL TRACKER</span><strong>International Space Station</strong><span>Altitude {Math.round(state.iss.altitude || 0)} km · velocity {Math.round(state.iss.velocity || 0).toLocaleString()} km/h</span></div></Popup>
      </Marker>}
      <div className="leaflet-top leaflet-left map-layer-overlay"><LayerControl active={active} setActive={setActive} counts={counts} /></div>
    </MapContainer>
    <div className="map-coordinate-label"><span>◉</span> GLOBAL MONITOR <i>·</i> {events.length.toLocaleString()} GEOSPATIAL SIGNALS</div>
    <div className="map-legend"><span><i className="legend-earthquake" /> SEISMIC</span><span><i className="legend-natural" /> NATURAL</span><span><i className="legend-conflict" /> CONFLICT</span><span><i className="legend-fire" /> THERMAL</span></div>
  </div>;
}
