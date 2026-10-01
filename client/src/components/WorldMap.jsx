import { useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';

const LAYERS = [
  ['seismic', 'Seismic', '◉'], ['natural', 'Natural', '✳'], ['conflicts', 'Conflict', '◇'], ['protests', 'Protests', '⚑'],
  ['fires', 'Fires', '⌁'], ['weather', 'Weather', '☼'], ['flights', 'Flights', '↗'], ['ships', 'Vessels', '⌑'],
  ['iss', 'ISS', '✣'], ['infrastructure', 'Context', '◎'], ['chokepoints', 'Chokepoints', '⌖'],
];
const TIME_WINDOWS = [['1H', 1], ['6H', 6], ['24H', 24], ['48H', 48], ['7D', 168], ['ALL', null]];
const REGIONS = [
  ['World', 21, 13, 2], ['North America', 43, -100, 3], ['Latin America', -12, -70, 3], ['Europe', 50, 14, 4],
  ['Africa', 2, 20, 3], ['Middle East', 29, 43, 4], ['Asia Pacific', 21, 112, 3], ['Oceania', -24, 134, 3],
];
const layerColors = { seismic: '#ff6a62', natural: '#7ed2b2', conflict: '#f4a353', protest: '#f3d36c', fire: '#ff9b50', infrastructure: '#b29af3', chokepoint: '#70b8eb' };
const asNumber = (value) => value === null || value === undefined || value === '' ? null : (Number.isFinite(Number(value)) ? Number(value) : null);
const validPoint = (item, latKey = 'latitude', lonKey = 'longitude') => asNumber(item?.[latKey]) !== null && asNumber(item?.[lonKey]) !== null;

function readInitialMapState() {
  const defaults = Object.fromEntries(LAYERS.map(([id]) => [id, true]));
  if (typeof window === 'undefined') return { center: [21, 13], zoom: 2, active: defaults, timeWindow: null, region: '' };
  const params = new URLSearchParams(window.location.search);
  const latitude = asNumber(params.get('lat'));
  const longitude = asNumber(params.get('lon'));
  const rawZoom = asNumber(params.get('zoom'));
  const layerParam = params.get('layers');
  const time = String(params.get('time') || 'all').toLowerCase();
  const windows = { '1h': 1, '6h': 6, '24h': 24, '48h': 48, '7d': 168, all: null };
  const active = layerParam === null ? defaults : Object.fromEntries(LAYERS.map(([id]) => [id, layerParam.split(',').includes(id)]));
  return {
    center: latitude === null || longitude === null ? [21, 13] : [Math.max(-85, Math.min(85, latitude)), Math.max(-180, Math.min(180, longitude))],
    zoom: rawZoom === null ? 2 : Math.max(2, Math.min(12, rawZoom)),
    active,
    timeWindow: Object.hasOwn(windows, time) ? windows[time] : null,
    region: REGIONS.some(([name]) => name.toLowerCase() === params.get('view')?.toLowerCase()) ? REGIONS.find(([name]) => name.toLowerCase() === params.get('view').toLowerCase())[0] : '',
  };
}

function MapFocus({ focus }) {
  const map = useMap();
  useEffect(() => {
    if (focus && validPoint(focus)) map.flyTo([Number(focus.latitude), Number(focus.longitude)], Number(focus.zoom) || Math.max(map.getZoom(), 5), { duration: 1.1 });
  }, [focus, map]);
  return null;
}

function MapZoomListener({ onZoom }) {
  const map = useMapEvents({ zoomend: (event) => onZoom(event.target.getZoom()) });
  useEffect(() => { onZoom(map.getZoom()); }, [map, onZoom]);
  return null;
}

function MapCommandListener({ active, timeWindow, region, severity, query, onCommand, onShareStatus }) {
  const map = useMap();
  useEffect(() => {
    const handle = async (event) => {
      const command = String(event.detail || '');
      if (command !== 'share') return onCommand(command);
      const center = map.getCenter();
      const params = new URLSearchParams(window.location.search);
      params.set('lat', center.lat.toFixed(4));
      params.set('lon', center.lng.toFixed(4));
      params.set('zoom', String(Math.round(map.getZoom() * 10) / 10));
      params.set('time', timeWindow === null ? 'all' : timeWindow === 168 ? '7d' : `${timeWindow}h`);
      params.set('layers', Object.entries(active).filter(([, enabled]) => enabled).map(([id]) => id).join(','));
      if (region) params.set('view', region.toLowerCase()); else params.delete('view');
      if (severity !== 'all') params.set('severity', severity); else params.delete('severity');
      if (query.trim()) params.set('q', query.trim().slice(0, 80)); else params.delete('q');
      const shareUrl = `${window.location.origin}${window.location.pathname}?${params.toString()}${window.location.hash}`;
      window.history.replaceState(null, '', shareUrl);
      try {
        await navigator.clipboard.writeText(shareUrl);
        onShareStatus('Shareable map link copied.');
      } catch {
        onShareStatus('Map view saved in the address bar; copy the URL to share it.');
      }
    };
    window.addEventListener('worldgpz:map-action', handle);
    return () => window.removeEventListener('worldgpz:map-action', handle);
  }, [active, map, onCommand, onShareStatus, query, region, severity, timeWindow]);
  return null;
}

function EventMarker({ item, color, radius = 6, fillOpacity = 0.78, onSelect }) {
  if (!validPoint(item)) return null;
  const position = [Number(item.latitude), Number(item.longitude)];
  return <CircleMarker center={position} radius={radius} pathOptions={{ color, fillColor: color, fillOpacity, weight: 1, opacity: 0.88 }} eventHandlers={{ click: () => onSelect?.(item) }}>
    <Popup><div className="map-popup"><span className="map-popup-kicker">{String(item.type || 'SIGNAL').toUpperCase()} · {item.source || 'SOURCE'}</span><strong>{item.title || item.place || 'Global signal'}</strong>{item.description && <span>{item.description}</span>}{item.magnitude && <span>Magnitude {Number(item.magnitude).toFixed(1)} · depth {item.depth} km</span>}{item.fatalities > 0 && <span>{item.fatalities} fatalities reported</span>}{item.url && <a href={item.url} target="_blank" rel="noreferrer">Open source ↗</a>}</div></Popup>
  </CircleMarker>;
}

function groupMarkers(items, zoom) {
  const cell = Math.max(0.45, 360 / (2 ** (zoom + 2)));
  const groups = new Map();
  for (const item of items.filter((event) => validPoint(event))) {
    const key = `${Math.floor((Number(item.latitude) + 90) / cell)}:${Math.floor((Number(item.longitude) + 180) / cell)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return [...groups.values()];
}

function ClusteredEvents({ items, color, zoom, getRadius, fillOpacity = 0.78 }) {
  const clusters = useMemo(() => groupMarkers(items, zoom), [items, zoom]);
  return clusters.map((cluster) => {
    if (cluster.length === 1) {
      const item = cluster[0];
      return <EventMarker key={item.id || item.external_id || item.title} item={item} color={color} radius={getRadius?.(item) || 6} fillOpacity={fillOpacity} />;
    }
    const latitude = cluster.reduce((sum, item) => sum + Number(item.latitude), 0) / cluster.length;
    const longitude = cluster.reduce((sum, item) => sum + Number(item.longitude), 0) / cluster.length;
    const radius = Math.min(20, 9 + Math.sqrt(cluster.length));
    return <CircleMarker key={`cluster-${color}-${cluster.map((item) => item.id || item.external_id).join('-')}`} center={[latitude, longitude]} radius={radius} pathOptions={{ color, fillColor: color, fillOpacity: 0.88, weight: 1, opacity: 0.9 }}>
      <Popup><div className="map-popup"><span className="map-popup-kicker">CLUSTERED SIGNALS</span><strong>{cluster.length} signals in this map cell</strong>{cluster.slice(0, 5).map((item) => <span key={item.id || item.external_id || item.title}>{item.title || 'Signal'}</span>)}{cluster.length > 5 && <span>+ {cluster.length - 5} more · zoom in to separate</span>}</div></Popup>
    </CircleMarker>;
  });
}

function mapIcon(className, icon, color, rotation = 0) {
  const angle = Number(rotation) || 0;
  return L.divIcon({
    className: `worldgpz-map-icon ${className}`,
    html: `<span style="color:${color};transform:rotate(${angle}deg)">${icon}</span>`,
    iconSize: [22, 22], iconAnchor: [11, 11],
  });
}

function LayerControl({ active, setActive, counts, timeWindow, setTimeWindow, region, setRegion, severity, setSeverity, query, setQuery }) {
  return <div className="map-layer-control" aria-label="Map data layers and filters">
    <div className="layer-control-title"><span>LAYERS</span><span>{Object.values(active).filter(Boolean).length} / {LAYERS.length}</span></div>
    <div className="layer-time-filter"><span>TIME WINDOW</span><div>{TIME_WINDOWS.map(([label, hours]) => <button key={label} className={timeWindow === hours ? 'selected' : ''} onClick={() => setTimeWindow(hours)} aria-pressed={timeWindow === hours}>{label}</button>)}</div></div>
    <select className="layer-region-select" aria-label="Map region preset" value={region} onChange={(event) => setRegion(event.target.value)}>
      <option value="">REGIONAL PRESET</option>{REGIONS.map(([name]) => <option key={name} value={name}>{name.toUpperCase()}</option>)}
    </select>
    <select className="layer-region-select layer-severity-select" aria-label="Minimum map event severity" value={severity} onChange={(event) => setSeverity(event.target.value)}>
      <option value="all">ALL SEVERITIES</option><option value="medium">MEDIUM +</option><option value="high">HIGH +</option><option value="critical">CRITICAL ONLY</option>
    </select>
    <input className="layer-search-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="FILTER MAP SIGNALS…" aria-label="Filter map signals by keyword" />
    <button className="map-share-button" onClick={() => window.dispatchEvent(new CustomEvent('worldgpz:map-action', { detail: 'share' }))}>COPY SHAREABLE MAP LINK</button>
    <div className="layer-control-grid">
      {LAYERS.map(([id, label, icon]) => <button key={id} className={active[id] ? 'enabled' : ''} onClick={() => setActive((previous) => ({ ...previous, [id]: !previous[id] }))} aria-pressed={Boolean(active[id])}>
        <span className="layer-icon">{icon}</span><span>{label}</span><small>{counts[id] ?? 0}</small>
      </button>)}
    </div>
  </div>;
}

function eventWithinWindow(item, hours) {
  if (hours === null) return true;
  const stamp = Number(item?.time) || Date.parse(item?.publishedAt || item?.date || '');
  return Number.isFinite(stamp) && stamp >= Date.now() - hours * 60 * 60_000;
}

const SEVERITY_SCORE = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
function eventMatchesMapFilters(item, hours, minimum, query) {
  const score = SEVERITY_SCORE[String(item?.severity || 'low').toLowerCase()] ?? 1;
  const threshold = ({ all: 0, medium: 2, high: 3, critical: 4 })[minimum] ?? 0;
  if (!eventWithinWindow(item, hours) || score < threshold) return false;
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return true;
  return `${item?.title || ''} ${item?.description || ''} ${item?.country || ''} ${item?.region || ''} ${item?.place || ''}`.toLocaleLowerCase().includes(needle);
}

export default function WorldMap({ state, focusEvent }) {
  const [initialView] = useState(readInitialMapState);
  const [active, setActive] = useState(() => initialView.active);
  const [timeWindow, setTimeWindow] = useState(() => initialView.timeWindow);
  const [region, setRegion] = useState(() => initialView.region);
  const [regionFocus, setRegionFocus] = useState(null);
  const [severityFilter, setSeverityFilter] = useState(() => {
    const value = typeof window === 'undefined' ? 'all' : new URLSearchParams(window.location.search).get('severity');
    return ['all', 'medium', 'high', 'critical'].includes(value) ? value : 'all';
  });
  const [mapQuery, setMapQuery] = useState(() => typeof window === 'undefined' ? '' : (new URLSearchParams(window.location.search).get('q') || '').slice(0, 80));
  const [shareStatus, setShareStatus] = useState('');
  const [zoom, setZoom] = useState(initialView.zoom);
  const events = state.events || [];
  const allSeismic = useMemo(() => events.filter((event) => event.type === 'seismic'), [events]);
  const allNatural = useMemo(() => events.filter((event) => event.type === 'natural'), [events]);
  const allConflicts = state.conflicts?.length ? state.conflicts : events.filter((event) => event.type === 'conflict');
  const allFires = state.fires?.length ? state.fires : events.filter((event) => event.type === 'fire');
  const allContextPoints = events.filter((event) => event.type === 'infrastructure');
  const isProtest = (event) => /protest|demonstrat|riot|\bstrike\b/i.test(`${event.eventType || ''} ${event.subEventType || ''} ${event.title || ''}`);
  const filterMapEvents = (collection) => collection.filter((event) => eventMatchesMapFilters(event, timeWindow, severityFilter, mapQuery));
  const seismic = filterMapEvents(allSeismic);
  const natural = filterMapEvents(allNatural);
  const conflicts = filterMapEvents(allConflicts).filter((event) => !isProtest(event));
  const protests = filterMapEvents(allConflicts).filter(isProtest);
  const fires = filterMapEvents(allFires);
  const contextPoints = allContextPoints;
  const chokepoints = state.chokepoints || [];
  const focus = !focusEvent ? regionFocus : !regionFocus || Number(focusEvent.nonce) >= Number(regionFocus.nonce) ? focusEvent : regionFocus;
  const selectRegion = (name) => {
    setRegion(name);
    const preset = REGIONS.find(([candidate]) => candidate === name);
    if (preset) setRegionFocus({ latitude: preset[1], longitude: preset[2], zoom: preset[3], nonce: Date.now() });
  };
  const handleMapCommand = useCallback((command) => {
    if (command === 'all-layers') { setActive(Object.fromEntries(LAYERS.map(([id]) => [id, true]))); return; }
    if (command.startsWith('layer:')) { const id = command.slice(6); if (LAYERS.some(([key]) => key === id)) setActive((previous) => ({ ...previous, [id]: true })); return; }
    if (command.startsWith('time:')) { const value = command.slice(5); setTimeWindow(value === 'all' ? null : Number(value)); return; }
    if (command.startsWith('region:')) {
      const [latitude, longitude, zoomLevel] = command.slice(7).split(',').map(Number);
      if ([latitude, longitude, zoomLevel].every(Number.isFinite)) { setRegion(''); setRegionFocus({ latitude, longitude, zoom: zoomLevel, nonce: Date.now() }); }
    }
  }, []);
  const showShareStatus = useCallback((message) => {
    setShareStatus(message);
    window.setTimeout(() => setShareStatus(''), 3500);
  }, []);
  const counts = {
    seismic: seismic.length, natural: natural.length, conflicts: conflicts.length, protests: protests.length,
    fires: fires.length, weather: state.weather?.length || 0, flights: state.flights?.length || 0, ships: state.ships?.length || 0,
    iss: state.iss?.latitude != null ? 1 : 0, infrastructure: contextPoints.length, chokepoints: chokepoints.length,
  };

  return <div className="map-canvas">
    <MapContainer center={initialView.center} zoom={initialView.zoom} minZoom={2} maxZoom={12} scrollWheelZoom zoomControl={false} worldCopyJump className="leaflet-map">
      <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" subdomains="abcd" maxZoom={19} attribution="© OpenStreetMap contributors © CARTO" />
      <MapFocus focus={focus} />
      <MapZoomListener onZoom={setZoom} />
      <MapCommandListener active={active} timeWindow={timeWindow} region={region} severity={severityFilter} query={mapQuery} onCommand={handleMapCommand} onShareStatus={showShareStatus} />
      {active.seismic && <ClusteredEvents items={seismic.slice(0, 1000)} color={layerColors.seismic} zoom={zoom} getRadius={(event) => Math.max(4, Math.min(15, (Number(event.magnitude) || 4) * 1.7))} />}
      {active.natural && <ClusteredEvents items={natural.slice(0, 600)} color={layerColors.natural} zoom={zoom} />}
      {active.conflicts && <ClusteredEvents items={conflicts.slice(0, 800)} color={layerColors.conflict} zoom={zoom} getRadius={(event) => Math.max(5, Math.min(12, (Number(event.fatalities) || 0) + 4))} />}
      {active.protests && <ClusteredEvents items={protests.slice(0, 800)} color={layerColors.protest} zoom={zoom} />}
      {active.fires && <ClusteredEvents items={fires.slice(0, 1200)} color={layerColors.fire} zoom={zoom} getRadius={(event) => Math.max(2, Math.min(6, (Number(event.frp) || 20) / 20))} fillOpacity={0.72} />}
      {active.infrastructure && contextPoints.map((event) => <EventMarker key={event.id || event.external_id} item={event} color={layerColors.infrastructure} radius={7} />)}
      {active.chokepoints && chokepoints.map((point) => <EventMarker key={point.name} item={{ ...point, type: 'chokepoint', title: point.name, description: `${point.assessment || 'Strategic route context'} Status: ${point.status}. Signals: ${point.signalCount || 0}.` }} color={point.status === 'disrupted' ? layerColors.seismic : point.status === 'strained' ? layerColors.protest : layerColors.chokepoint} radius={8} />)}
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
      <div className="leaflet-top leaflet-left map-layer-overlay"><LayerControl active={active} setActive={setActive} counts={counts} timeWindow={timeWindow} setTimeWindow={setTimeWindow} region={region} setRegion={selectRegion} severity={severityFilter} setSeverity={setSeverityFilter} query={mapQuery} setQuery={setMapQuery} /></div>
    </MapContainer>
    {shareStatus && <div className="map-share-status" role="status">{shareStatus}</div>}
    <div className="map-coordinate-label"><span>◉</span> GLOBAL MONITOR <i>·</i> {events.length.toLocaleString()} GEOSPATIAL SIGNALS <i>·</i> {zoom.toFixed(0)}×</div>
    <div className="map-legend"><span><i className="legend-earthquake" /> SEISMIC</span><span><i className="legend-natural" /> NATURAL</span><span><i className="legend-conflict" /> CONFLICT</span><span><i className="legend-fire" /> THERMAL</span><span><i className="legend-chokepoint" /> CHOKEPOINT</span></div>
  </div>;
}
