import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import DashboardHeader from '../components/DashboardHeader.jsx';
import LiveWire from '../components/LiveWire.jsx';
import WorldMap from '../components/WorldMap.jsx';
import EventStream from '../components/EventStream.jsx';
import NewsList from '../components/NewsList.jsx';
import AIBriefing from '../components/AIBriefing.jsx';
import MarketPulse from '../components/MarketPulse.jsx';
import { Chokepoints, CountryRisk } from '../components/IntelPanels.jsx';
import SourceHealth from '../components/SourceHealth.jsx';
import SignalVelocity from '../components/SignalVelocity.jsx';
import { EconomicPanel, EnergyPanel, WeatherPanel } from '../components/DataPanels.jsx';
import YouTubePlayer from '../components/YouTubePlayer.jsx';
import { useDashboardData } from '../lib/useDashboardData.js';
import { MissionOverview, SignalFilters, EventDetail, CommandPalette } from '../components/CommandCenter.jsx';
import { WATCHLIST_KEY, createSnapshot, filterEvents, hasCoordinates, normalizeEvents } from '../lib/mission.js';
import Watchroom from '../components/Watchroom.jsx';
import AnalystWorkspace from '../components/AnalystWorkspace.jsx';
import '../workspace.css';

const OrbitalGlobe = lazy(() => import('../components/OrbitalGlobe.jsx'));
const SEARCH_LOCATIONS = [
  ['Accra', 5.6037, -0.187], ['Beijing', 39.9042, 116.4074], ['Cairo', 30.0444, 31.2357], ['Delhi', 28.6139, 77.209],
  ['Dubai', 25.2048, 55.2708], ['Kyiv', 50.4501, 30.5234], ['London', 51.5074, -0.1278], ['New York', 40.7128, -74.006],
  ['Singapore', 1.3521, 103.8198], ['Taipei', 25.033, 121.5654], ['Tokyo', 35.6762, 139.6503], ['Washington DC', 38.9072, -77.0369],
];
const DEFAULT_FILTERS = { search: '', category: 'all', severity: 'all', hours: '', saved: false };

export default function Dashboard() {
  const [workspace, setWorkspace] = useState('monitor');
  const [streamEnabled, setStreamEnabled] = useState(true);
  const [mapMode, setMapMode] = useState('2d');
  const [focusEvent, setFocusEvent] = useState(null);
  const [search, setSearch] = useState('');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [notice, setNotice] = useState('');
  const [watchlist, setWatchlist] = useState(() => {
    try { const saved = JSON.parse(localStorage.getItem(WATCHLIST_KEY) || '[]'); return Array.isArray(saved) ? normalizeEvents(saved).slice(0, 200) : []; } catch { return []; }
  });
  const { data, refreshing, refreshAll, connected } = useDashboardData(streamEnabled);
  const events = useMemo(() => normalizeEvents([...(data.mission?.priorities || []), ...(data.watchroom?.threads || []).flatMap((thread) => thread.signals || []), ...data.events, ...data.conflicts, ...data.fires]), [data.mission, data.watchroom, data.events, data.conflicts, data.fires]);
  const savedIds = useMemo(() => watchlist.map((event) => event.id), [watchlist]);
  const availableEvents = useMemo(() => filters.saved ? normalizeEvents([...events.filter((event) => savedIds.includes(event.id)), ...watchlist]) : events, [events, filters.saved, savedIds, watchlist]);
  const filteredEvents = useMemo(() => filterEvents(availableEvents, filters, savedIds).sort((a, b) => (b.observedAt || 0) - (a.observedAt || 0)), [availableEvents, filters, savedIds]);
  const categories = useMemo(() => [...new Set([...events, ...watchlist].map((event) => event.type))].sort(), [events, watchlist]);
  const mapData = useMemo(() => ({ ...data, events: filteredEvents, conflicts: filteredEvents.filter((event) => event.type === 'conflict'), fires: filteredEvents.filter((event) => event.type === 'fire') }), [data, filteredEvents]);
  const toggleSaved = useCallback((event) => {
    setWatchlist((previous) => {
      const next = previous.some((item) => item.id === event.id) ? previous.filter((item) => item.id !== event.id) : [{ ...event, savedAt: new Date().toISOString() }, ...previous].slice(0, 200);
      try { localStorage.setItem(WATCHLIST_KEY, JSON.stringify(next)); setNotice('Watchlist updated on this device.'); } catch { setNotice('Local storage unavailable. Watchlist kept for this session only.'); }
      return next;
    });
  }, []);
  const exportSnapshot = useCallback(() => {
    const report = createSnapshot({ events: filteredEvents, filters, mission: data.mission, health: data.health, watchlist, briefing: data.briefing, errors: data.errors });
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `worldgpz-snapshot-${new Date().toISOString().slice(0, 10)}.json`; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000); setNotice(`Exported ${filteredEvents.length} filtered records with source and coverage notes.`);
  }, [data, filters, filteredEvents, watchlist]);
  const online = data.health.filter((provider) => ['online', 'degraded'].includes(provider.status)).length;
  const providerHealth = (name) => data.health.find((provider) => provider.name === name);
  const visibleSuggestions = useMemo(() => search.trim() ? SEARCH_LOCATIONS.filter(([name]) => name.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 5) : [], [search]);

  const locateEvent = useCallback((event) => {
    if (hasCoordinates(event)) { setWorkspace('monitor'); setMapMode('2d'); setFocusEvent({ latitude: Number(event.latitude), longitude: Number(event.longitude), nonce: Date.now() }); }
  }, []);
  const selectEvent = useCallback((event) => { setSelectedEvent(normalizeEvents([event])[0]); }, []);

  const selectLocation = (location) => {
    setFocusEvent({ latitude: location[1], longitude: location[2], nonce: Date.now() });
    setSearch(location[0]);
    window.setTimeout(() => setSearch(''), 1200);
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setPaletteOpen((open) => !open); return; }
      if (paletteOpen || selectedEvent) return;
      const target = event.target;
      if (target instanceof HTMLElement && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)) {
        if (event.key === 'Escape') setSearch('');
        return;
      }
      if (event.key.toLowerCase() === 'g') setMapMode((mode) => mode === '2d' ? '3d' : '2d');
      if (event.key.toLowerCase() === 'r') void refreshAll();
      if (event.key === '/') { event.preventDefault(); document.getElementById('signal-search')?.focus(); }
      if (event.key === '?') setPaletteOpen(true);
      if (event.key === 'Escape') setFocusEvent(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [refreshAll, paletteOpen, selectedEvent]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 4500); return () => clearTimeout(timer); }, [notice]);
  const commands = [
    { id: 'watchroom', label: 'Open Watchroom · monitoring missions and orbital overview', run: () => setWorkspace('watchroom') },
    { id: 'analyst', label: 'Open Evidence Analyst · ask source-grounded questions', run: () => setWorkspace('analyst') },
    { id: 'monitor', label: 'Open Monitor · all feeds and telemetry', run: () => setWorkspace('monitor') },
    { id: 'refresh', label: 'Refresh available feeds', hint: 'R', run: refreshAll },
    { id: 'map', label: `Switch to ${mapMode === '2d' ? '3D orbital globe' : '2D signal map'}`, hint: 'G', run: () => setMapMode((mode) => mode === '2d' ? '3d' : '2d') },
    { id: 'saved', label: filters.saved ? 'Show all source records' : 'Open saved watchlist', hint: `${watchlist.length} SAVED`, run: () => setFilters({ ...DEFAULT_FILTERS, saved: !filters.saved }) },
    { id: 'export', label: 'Download filtered snapshot report', hint: 'JSON', run: exportSnapshot },
    { id: 'reset', label: 'Reset all signal filters', run: () => setFilters(DEFAULT_FILTERS) },
    { id: 'search', label: 'Search source records', hint: '/', run: () => setTimeout(() => document.getElementById('signal-search')?.focus(), 0) },
    { id: 'stream', label: streamEnabled ? 'Pause server event stream' : 'Enable server event stream', run: () => setStreamEnabled((enabled) => !enabled) },
  ];

  return (
    <div className="dashboard-shell">
      <a href={workspace === 'monitor' ? '#signal-search' : workspace === 'watchroom' ? '#watchroom-lens' : '#analyst-question'} className="skip-link">Skip to workspace controls</a>
      <DashboardHeader state={data} streamConnected={connected} streamEnabled={streamEnabled} onToggleStream={() => setStreamEnabled((enabled) => !enabled)} onRefresh={refreshAll} refreshing={refreshing} mapMode={mapMode} onMapMode={setMapMode} />
      <nav className="workspace-navigation" aria-label="Intelligence workspaces"><div className="workspace-nav-tabs">{[{ id: 'monitor', number: '01', title: 'Monitor', note: 'Feeds & telemetry' }, { id: 'watchroom', number: '02', title: 'Watchroom', note: 'Your observation workspace' }, { id: 'analyst', number: '03', title: 'Evidence Analyst', note: 'Questions & citations' }].map((item) => <button key={item.id} data-testid={`workspace-${item.id}`} aria-label={item.id === 'analyst' ? 'Analyst' : item.title} aria-current={workspace === item.id ? 'page' : undefined} onClick={() => setWorkspace(item.id)}><span>{item.number}</span><strong>{item.title}</strong><small>{item.note}</small>{item.id === 'watchroom' && <i />}</button>)}</div><button className="workspace-nav-command" onClick={() => setPaletteOpen(true)} aria-label="Open workspace command palette">⌘ <kbd>Ctrl K</kbd></button></nav>
      {workspace === 'watchroom' && <Watchroom events={events} data={data} onSelect={selectEvent} onAnalyst={() => setWorkspace('analyst')} onNotice={setNotice} />}
      {workspace === 'analyst' && <main id="workspace-main"><AnalystWorkspace onSelect={selectEvent} /></main>}
      {workspace === 'monitor' && <>
      <MissionOverview mission={data.mission} events={events} health={data.health} errors={data.errors} onCommands={() => setPaletteOpen(true)} onExport={exportSnapshot} savedCount={watchlist.length} />
      <SignalFilters filters={filters} onChange={setFilters} categories={categories} total={availableEvents.length} shown={filteredEvents.length} savedCount={watchlist.length} onReset={() => setFilters(DEFAULT_FILTERS)} />
      <LiveWire articles={data.news} onSelect={selectEvent} />
      <main className="dashboard-main">
        <div className="primary-grid">
          <aside className="left-rail dashboard-scroll" aria-label="Intelligence overview">
            <AIBriefing briefing={data.briefing} provider={providerHealth('openai')} error={data.errors.briefing} />
            <CountryRisk countries={data.countries} />
            <Chokepoints points={data.chokepoints} />
            <MarketPulse markets={data.markets} provider={providerHealth('markets')} error={data.errors.markets} />
          </aside>
          <section className="map-section" aria-label="Global signal map">
            <div className="map-section-head">
              <div className="map-title-group"><span className="map-target-icon">⌖</span><span><small>EARTH / SOURCE OVERVIEW</small><strong>{mapMode === '2d' ? 'Global signal map' : 'Orbital signal globe'}</strong></span><span className="map-time">CONTACT {data.lastSync ? new Date(data.lastSync).toISOString().slice(11, 19) : '—'} UTC</span></div>
              <div className="map-search-wrap">
                <span>⌕</span><input className="map-search-input" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && visibleSuggestions[0]) selectLocation(visibleSuggestions[0]); }} placeholder="Locate a city or region…" aria-label="Search map locations" />
                {visibleSuggestions.length > 0 && <div className="search-suggestions">{visibleSuggestions.map((location) => <button key={location[0]} onClick={() => selectLocation(location)}><span>⌖</span>{location[0]}<small>{location[1].toFixed(2)}, {location[2].toFixed(2)}</small></button>)}</div>}
              </div>
              <button className="help-trigger" onClick={() => setPaletteOpen(true)} aria-label="Open command center" title="Command center">⌘</button>
            </div>
            <div className="map-stage">
              {mapMode === '2d' ? <WorldMap state={mapData} focusEvent={focusEvent} onSelect={selectEvent} /> : <Suspense fallback={<div className="globe-loading"><span className="loading-orbit" />Rendering orbital view…</div>}><OrbitalGlobe state={mapData} /></Suspense>}
              <div className="map-live-badge"><span className="live-light" />{connected ? 'STREAMING' : 'SNAPSHOT'}<i />{online} SOURCES ACTIVE</div>
            </div>
            <div className="map-footnote"><span>BASEMAP © OPENSTREETMAP CONTRIBUTORS</span><span><i className="map-foot-dot" /> FILTERS APPLY TO SIGNALS · TELEMETRY LAYERS INDEPENDENT</span></div>
          </section>
          <aside className="right-rail dashboard-scroll" aria-label="Live reports">
            <EventStream events={filteredEvents} connected={connected} onSelect={selectEvent} onSave={toggleSaved} savedIds={savedIds} error={data.errors.events} savedView={filters.saved} />
            <NewsList articles={data.news} provider={providerHealth('news')} error={data.errors.news} />
          </aside>
        </div>
      </main>
      <section className="analytics-rail" aria-label="Data sources and analysis">
        <SignalVelocity events={filteredEvents} />
        <SourceHealth health={data.health} />
        <EnergyPanel data={data.energy} provider={providerHealth('energy')} error={data.errors.energy} />
        <EconomicPanel data={data.economics} provider={providerHealth('macro')} error={data.errors.economics} />
        <WeatherPanel weather={data.weather} provider={providerHealth('weather')} error={data.errors.weather} />
        <YouTubePlayer webcams={data.webcams} status={providerHealth('youtube')?.status} error={data.errors.webcams || providerHealth('youtube')?.lastError} />
      </section>
      </>}
      <footer className="app-footer"><span>WORLDGPZ <i>GOD’S EYE</i></span><span>POWERED BY THADDEUSTECHZ INTELLIGENCE SYSTEMS</span><a href="/about">ABOUT / DATA NOTES</a><span className="footer-right">© 2026 THADDEUSTECHZ <b>·</b> EVERY SIGNAL. ONE EYE ON THE WORLD.</span></footer>
      {notice && <div className="command-notice" role="status">{notice}</div>}
      {selectedEvent && !paletteOpen && <EventDetail event={selectedEvent} saved={savedIds.includes(selectedEvent.id)} onSave={toggleSaved} onClose={() => setSelectedEvent(null)} onLocate={locateEvent} />}
      {paletteOpen && <CommandPalette commands={commands} events={events} onSelect={selectEvent} onClose={() => setPaletteOpen(false)} />}
    </div>
  );
}
