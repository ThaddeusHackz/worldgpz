import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DashboardHeader from '../components/DashboardHeader.jsx';
import LiveWire from '../components/LiveWire.jsx';
import WorldMap from '../components/WorldMap.jsx';
import EventStream from '../components/EventStream.jsx';
import NewsList from '../components/NewsList.jsx';
import AIBriefing from '../components/AIBriefing.jsx';
import MarketPulse from '../components/MarketPulse.jsx';
import PredictionPulse from '../components/PredictionPulse.jsx';
import OutbreakMonitor from '../components/OutbreakMonitor.jsx';
import LaunchSchedule from '../components/LaunchSchedule.jsx';
import WatchlistPanel from '../components/WatchlistPanel.jsx';
import { Chokepoints, CountryRisk } from '../components/IntelPanels.jsx';
import SourceHealth from '../components/SourceHealth.jsx';
import SignalVelocity from '../components/SignalVelocity.jsx';
import { EconomicPanel, EnergyPanel, WeatherPanel } from '../components/DataPanels.jsx';
import YouTubePlayer from '../components/YouTubePlayer.jsx';
import DashboardSettings from '../components/DashboardSettings.jsx';
import CountryBriefDialog from '../components/CountryBriefDialog.jsx';
import SnapshotHistory from '../components/SnapshotHistory.jsx';
import { useDashboardData } from '../lib/useDashboardData.js';
import { MissionOverview, SignalFilters, EventDetail, CommandPalette } from '../components/CommandCenter.jsx';
import { WATCHLIST_KEY, createSnapshot, filterEvents, hasCoordinates, normalizeEvents } from '../lib/mission.js';
import { loadDashboardLayout, reorderDashboardPanel, saveDashboardLayout, setDashboardPanelSize, toggleDashboardPanel } from '../lib/dashboardLayout.js';
import { captureDashboardSnapshot, loadDashboardSnapshots, SNAPSHOT_CAPTURE_INTERVAL_MS } from '../lib/snapshotHistory.js';
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
const MAP_REGIONS = [
  ['World', '21,13,2'], ['North America', '43,-100,3'], ['Latin America', '-12,-70,3'], ['Europe', '50,14,4'],
  ['Africa', '2,20,3'], ['Middle East', '29,43,4'], ['Asia Pacific', '21,112,3'], ['Oceania', '-24,134,3'],
];
const MAP_TIME_WINDOWS = [['1 hour', '1'], ['6 hours', '6'], ['24 hours', '24'], ['48 hours', '48'], ['7 days', '168']];
const DASHBOARD_VIEWS = ['map', 'wire', 'globe'];

function downloadText(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportEventsCsv(events) {
  const columns = ['title', 'type', 'severity', 'time', 'publishedAt', 'source', 'region', 'country', 'latitude', 'longitude', 'url'];
  const quote = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  return [columns.join(','), ...events.map((event) => columns.map((column) => quote(event[column])).join(','))].join('\n');
}

export default function Dashboard() {
  const [workspace, setWorkspace] = useState('monitor');
  const [streamEnabled, setStreamEnabled] = useState(true);
  const [dashboardView, setDashboardView] = useState('map');
  const [focusEvent, setFocusEvent] = useState(null);
  const [search, setSearch] = useState('');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [notice, setNotice] = useState('');
  const [countryBrief, setCountryBrief] = useState(null);
  const [dashboardLayout, setDashboardLayout] = useState(() => loadDashboardLayout());
  const [snapshots, setSnapshots] = useState(() => loadDashboardSnapshots());
  const [snapshotError, setSnapshotError] = useState('');
  const [watchlist, setWatchlist] = useState(() => {
    try { const saved = JSON.parse(localStorage.getItem(WATCHLIST_KEY) || '[]'); return Array.isArray(saved) ? normalizeEvents(saved).slice(0, 200) : []; } catch { return []; }
  });
  const { data, refreshing, refreshAll, connected } = useDashboardData(streamEnabled);
  const currentDataRef = useRef(data);
  const panelResizeRef = useRef(null);
  currentDataRef.current = data;
  const events = useMemo(() => normalizeEvents([...(data.mission?.priorities || []), ...(data.watchroom?.threads || []).flatMap((thread) => thread.signals || []), ...data.events, ...data.conflicts, ...data.fires]), [data.mission, data.watchroom, data.events, data.conflicts, data.fires]);
  const savedIds = useMemo(() => watchlist.map((event) => event.id), [watchlist]);
  const availableEvents = useMemo(() => filters.saved ? normalizeEvents([...events.filter((event) => savedIds.includes(event.id)), ...watchlist]) : events, [events, filters.saved, savedIds, watchlist]);
  const filteredEvents = useMemo(() => filterEvents(availableEvents, filters, savedIds).sort((a, b) => (b.observedAt || 0) - (a.observedAt || 0)), [availableEvents, filters, savedIds]);
  const categories = useMemo(() => [...new Set([...events, ...watchlist].map((event) => event.type))].sort(), [events, watchlist]);
  const mapData = useMemo(() => ({ ...data, events: filteredEvents, conflicts: filteredEvents.filter((event) => event.type === 'conflict'), fires: filteredEvents.filter((event) => event.type === 'fire') }), [data, filteredEvents]);
  const providerHealth = useCallback((name) => data.health.find((provider) => provider.name === name), [data.health]);
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
  const exportDashboardJson = useCallback(() => {
    downloadText(`worldgpz-dashboard-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ exportedAt: new Date().toISOString(), data }, null, 2), 'application/json');
    setNotice('Downloaded the currently loaded dashboard snapshot as JSON.');
  }, [data]);
  const exportEventsCsvFile = useCallback(() => {
    downloadText(`worldgpz-events-${new Date().toISOString().slice(0, 10)}.csv`, exportEventsCsv(filteredEvents), 'text/csv;charset=utf-8');
    setNotice(`Downloaded ${filteredEvents.length} filtered event records as CSV.`);
  }, [filteredEvents]);
  const online = data.health.filter((provider) => ['online', 'degraded'].includes(provider.status)).length;
  const visibleSuggestions = useMemo(() => search.trim() ? SEARCH_LOCATIONS.filter(([name]) => name.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 5) : [], [search]);

  // Compact local history: 15-minute captures, retained for 7 days on this device.
  useEffect(() => { saveDashboardLayout(dashboardLayout); }, [dashboardLayout]);
  const snapshotReady = Boolean(data.lastSync);
  useEffect(() => {
    if (!snapshotReady) return undefined;
    const capture = () => {
      const result = captureDashboardSnapshot(currentDataRef.current);
      if (result.captured) setSnapshots(result.snapshots);
      if (result.error) setSnapshotError(result.error);
    };
    capture();
    const timer = window.setInterval(capture, SNAPSHOT_CAPTURE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [snapshotReady]);
  const captureSnapshotNow = useCallback(() => {
    const result = captureDashboardSnapshot(currentDataRef.current, { force: true });
    setSnapshots(result.snapshots);
    setSnapshotError(result.error || '');
    setNotice(result.captured ? 'Captured a local dashboard snapshot.' : 'Snapshot capture is unavailable on this device.');
  }, []);

  const selectDashboardView = useCallback((view) => { if (DASHBOARD_VIEWS.includes(view)) { setWorkspace('monitor'); setDashboardView(view); } }, []);
  const locateEvent = useCallback((event) => {
    if (hasCoordinates(event)) { setWorkspace('monitor'); setDashboardView('map'); setFocusEvent({ latitude: Number(event.latitude), longitude: Number(event.longitude), nonce: Date.now() }); }
  }, []);
  const selectEvent = useCallback((event) => { setSelectedEvent(normalizeEvents([event])[0]); }, []);

  const selectLocation = (location) => {
    setFocusEvent({ latitude: location[1], longitude: location[2], nonce: Date.now() });
    setSearch(location[0]);
    window.setTimeout(() => setSearch(''), 1200);
  };
  const dispatchMapAction = useCallback((detail) => {
    setWorkspace('monitor'); setDashboardView('map');
    window.setTimeout(() => window.dispatchEvent(new CustomEvent('worldgpz:map-action', { detail })), 80);
  }, []);
  const showPanel = useCallback((panelId) => {
    setDashboardLayout((current) => current.visible.includes(panelId) ? current : toggleDashboardPanel(current, panelId));
    window.setTimeout(() => document.querySelector(`[data-panel-id="${panelId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setPaletteOpen((open) => !open); return; }
      if (paletteOpen || selectedEvent) return;
      const target = event.target;
      if (target instanceof HTMLElement && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)) {
        if (event.key === 'Escape') setSearch('');
        return;
      }
      if (event.key.toLowerCase() === 'g') setDashboardView((view) => view === 'globe' ? 'map' : 'globe');
      if (event.key.toLowerCase() === 'r') void refreshAll();
      if (event.key === '/') { event.preventDefault(); (document.getElementById('signal-search') || document.querySelector('.map-search-input'))?.focus(); }
      if (event.key === '?') setPaletteOpen(true);
      if (event.key === 'Escape') setFocusEvent(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [refreshAll, paletteOpen, selectedEvent]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 4500); return () => clearTimeout(timer); }, [notice]);

  const commands = [
    { id: 'view-map', label: 'Show signal map · 2D layers and filters', hint: 'VIEW', run: () => selectDashboardView('map') },
    { id: 'view-wire', label: 'Show live wire · chronological reporting', hint: 'VIEW', run: () => selectDashboardView('wire') },
    { id: 'view-globe', label: 'Show orbital globe · 3D view', hint: 'G', run: () => selectDashboardView('globe') },
    { id: 'watchroom', label: 'Open Watchroom · monitoring missions and orbital overview', run: () => setWorkspace('watchroom') },
    { id: 'analyst', label: 'Open Evidence Analyst · ask source-grounded questions', run: () => setWorkspace('analyst') },
    { id: 'monitor', label: 'Open Monitor · all feeds and telemetry', run: () => setWorkspace('monitor') },
    { id: 'refresh', label: 'Refresh available feeds', hint: 'R', run: refreshAll },
    { id: 'settings', label: 'Customize dashboard layout · workspaces, panels and sizes', run: () => setSettingsOpen(true) },
    { id: 'snapshots', label: 'Browse dashboard snapshots · 7-day local history', run: () => setSnapshotOpen(true) },
    { id: 'snapshot-capture', label: 'Capture a dashboard snapshot now', run: captureSnapshotNow },
    { id: 'panel-briefing', label: 'Open World brief panel', hint: 'PANEL', run: () => showPanel('briefing') },
    { id: 'panel-news', label: 'Open latest reporting panel', hint: 'PANEL', run: () => showPanel('news') },
    { id: 'panel-events', label: 'Open event stream panel', hint: 'PANEL', run: () => showPanel('events') },
    { id: 'panel-markets', label: 'Open market pulse panel', hint: 'PANEL', run: () => showPanel('markets') },
    { id: 'panel-predictions', label: 'Open prediction markets panel', hint: 'PANEL', run: () => showPanel('predictions') },
    { id: 'panel-watchlist', label: 'Open local watchlist panel', hint: 'PANEL', run: () => showPanel('watchlist') },
    { id: 'panel-health', label: 'Open source health panel', hint: 'PANEL', run: () => showPanel('health') },
    { id: 'map-share', label: 'Copy shareable map link · position, layers and time filter', hint: 'MAP', run: () => dispatchMapAction('share') },
    { id: 'map-all-layers', label: 'Show all map layers', hint: 'MAP', run: () => dispatchMapAction('all-layers') },
    ...MAP_TIME_WINDOWS.map(([label, value]) => ({ id: `map-time-${value}`, label: `Filter map to the last ${label}`, hint: 'MAP', run: () => dispatchMapAction(`time:${value}`) })),
    { id: 'map-time-all', label: 'Remove the map time filter', hint: 'MAP', run: () => dispatchMapAction('time:all') },
    ...MAP_REGIONS.map(([label, coordinates]) => ({ id: `map-region-${label}`, label: `Navigate the map to ${label}`, hint: 'MAP', run: () => dispatchMapAction(`region:${coordinates}`) })),
    { id: 'saved', label: filters.saved ? 'Show all source records' : 'Open saved watchlist', hint: `${watchlist.length} SAVED`, run: () => setFilters({ ...DEFAULT_FILTERS, saved: !filters.saved }) },
    { id: 'export', label: 'Download filtered snapshot report', hint: 'JSON', run: exportSnapshot },
    { id: 'export-dashboard', label: 'Export loaded dashboard data as JSON', hint: 'JSON', run: exportDashboardJson },
    { id: 'export-csv', label: 'Export filtered event records as CSV', hint: 'CSV', run: exportEventsCsvFile },
    { id: 'reset', label: 'Reset all signal filters', run: () => setFilters(DEFAULT_FILTERS) },
    { id: 'search', label: 'Search source records', hint: '/', run: () => setTimeout(() => document.getElementById('signal-search')?.focus(), 0) },
    { id: 'stream', label: streamEnabled ? 'Pause server event stream' : 'Enable server event stream', run: () => setStreamEnabled((enabled) => !enabled) },
  ];

  const panelContent = {
    briefing: <AIBriefing briefing={data.briefing} provider={providerHealth('openai')} error={data.errors.briefing} />,
    countryRisk: <CountryRisk countries={data.countries} onBrief={setCountryBrief} briefEnabled={Boolean(providerHealth('openai')?.configured)} />,
    chokepoints: <Chokepoints points={data.chokepoints} />,
    markets: <MarketPulse markets={data.markets} provider={providerHealth('markets')} error={data.errors.markets} />,
    predictions: <PredictionPulse markets={data.predictions} provider={providerHealth('predictions')} error={data.errors.predictions} />,
    watchlist: <WatchlistPanel news={data.news} events={data.events} ready={Boolean(data.loaded.news && data.loaded.events)} />,
    events: <EventStream events={filteredEvents} connected={connected} onSelect={selectEvent} onSave={toggleSaved} savedIds={savedIds} error={data.errors.events} savedView={filters.saved} />,
    news: <NewsList articles={data.news} provider={providerHealth('news')} error={data.errors.news} />,
    velocity: <SignalVelocity events={filteredEvents} />,
    health: <SourceHealth health={data.health} />,
    energy: <EnergyPanel data={data.energy} provider={providerHealth('energy')} error={data.errors.energy} />,
    economics: <EconomicPanel data={data.economics} provider={providerHealth('macro')} error={data.errors.economics} />,
    outbreaks: <OutbreakMonitor outbreaks={data.outbreaks} provider={providerHealth('outbreaks')} error={data.errors.outbreaks} />,
    launches: <LaunchSchedule launches={data.launches} provider={providerHealth('launches')} error={data.errors.launches} />,
    weather: <WeatherPanel weather={data.weather} provider={providerHealth('weather')} error={data.errors.weather} />,
    webcams: <YouTubePlayer webcams={data.webcams} status={providerHealth('youtube')?.status} error={data.errors.webcams || providerHealth('youtube')?.lastError} />,
  };

  const handlePanelDragStart = (event, panelId) => {
    event.dataTransfer?.setData('text/plain', panelId);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  };
  const handlePanelDrop = (event, targetId) => {
    event.preventDefault();
    const sourceId = event.dataTransfer?.getData('text/plain');
    if (sourceId) setDashboardLayout((current) => reorderDashboardPanel(current, sourceId, targetId));
  };
  const handlePanelResizeStart = (event, panelId) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.clientX >= bounds.right - 18 && event.clientY >= bounds.bottom - 18) panelResizeRef.current = panelId;
  };
  const handlePanelResizeEnd = (event, panelId) => {
    if (panelResizeRef.current !== panelId) return;
    panelResizeRef.current = null;
    const height = Math.round(event.currentTarget.getBoundingClientRect().height);
    setDashboardLayout((current) => setDashboardPanelSize(current, panelId, height));
  };
  const renderPanels = (group) => dashboardLayout.order[group]
    .filter((panelId) => dashboardLayout.visible.includes(panelId))
    .map((panelId) => <div key={panelId} className={`managed-panel managed-panel-${group}`} data-panel-id={panelId}
      style={group !== 'analytics' && dashboardLayout.sizes[panelId] ? { height: `${dashboardLayout.sizes[panelId]}px` } : undefined}
      onPointerDown={group !== 'analytics' ? (event) => handlePanelResizeStart(event, panelId) : undefined}
      onPointerUp={group !== 'analytics' ? (event) => handlePanelResizeEnd(event, panelId) : undefined}
      onDragOver={(event) => event.preventDefault()} onDrop={(event) => handlePanelDrop(event, panelId)}>
      <button className="panel-drag-handle" type="button" draggable onDragStart={(event) => handlePanelDragStart(event, panelId)} aria-label={`Drag to reorder ${panelId}`} title="Drag panel to reorder">⠿</button>
      {panelContent[panelId]}
    </div>);

  return (
    <div className="dashboard-shell">
      <a href={workspace === 'monitor' ? '#signal-search' : workspace === 'watchroom' ? '#watchroom-lens' : '#analyst-question'} className="skip-link">Skip to workspace controls</a>
      <DashboardHeader state={data} streamConnected={connected} streamEnabled={streamEnabled} onToggleStream={() => setStreamEnabled((enabled) => !enabled)} onRefresh={refreshAll} refreshing={refreshing} dashboardView={dashboardView} onDashboardView={selectDashboardView} onOpenCommands={() => setPaletteOpen((open) => !open)} onOpenSettings={() => setSettingsOpen(true)} onOpenSnapshots={() => setSnapshotOpen(true)} />
      <nav className="workspace-navigation" aria-label="Intelligence workspaces"><div className="workspace-nav-tabs">{[{ id: 'monitor', number: '01', title: 'Monitor', note: 'Feeds & telemetry' }, { id: 'watchroom', number: '02', title: 'Watchroom', note: 'Your observation workspace' }, { id: 'analyst', number: '03', title: 'Evidence Analyst', note: 'Questions & citations' }].map((item) => <button key={item.id} data-testid={`workspace-${item.id}`} aria-label={item.id === 'analyst' ? 'Analyst' : item.title} aria-current={workspace === item.id ? 'page' : undefined} onClick={() => setWorkspace(item.id)}><span>{item.number}</span><strong>{item.title}</strong><small>{item.note}</small>{item.id === 'watchroom' && <i />}</button>)}</div><button className="workspace-nav-command" onClick={() => setPaletteOpen(true)} aria-label="Open workspace command palette">⌘ <kbd>Ctrl K</kbd></button></nav>
      {workspace === 'watchroom' && <Watchroom events={events} data={data} onSelect={selectEvent} onAnalyst={() => setWorkspace('analyst')} onNotice={setNotice} />}
      {workspace === 'analyst' && <main id="workspace-main"><AnalystWorkspace onSelect={selectEvent} /></main>}
      {workspace === 'monitor' && <>
      <MissionOverview mission={data.mission} events={events} health={data.health} errors={data.errors} onCommands={() => setPaletteOpen(true)} onExport={exportSnapshot} savedCount={watchlist.length} />
      <SignalFilters filters={filters} onChange={setFilters} categories={categories} total={availableEvents.length} shown={filteredEvents.length} savedCount={watchlist.length} onReset={() => setFilters(DEFAULT_FILTERS)} />
      <LiveWire articles={data.news} onSelect={selectEvent} />
      <main className="dashboard-main">
        <div className="primary-grid" data-view={dashboardView}>
          <aside className="left-rail dashboard-scroll" aria-label="Intelligence overview">
            {renderPanels('left')}
          </aside>
          <section className="map-section" aria-label="Global signal map">
            <div className="map-section-head">
              <div className="map-title-group"><span className="map-target-icon">⌖</span><span><small>EARTH / SOURCE OVERVIEW</small><strong>{dashboardView === 'globe' ? 'Orbital signal globe' : 'Global signal map'}</strong></span><span className="map-time">CONTACT {data.lastSync ? new Date(data.lastSync).toISOString().slice(11, 19) : '—'} UTC</span></div>
              <div className="map-search-wrap">
                <span>⌕</span><input className="map-search-input" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && visibleSuggestions[0]) selectLocation(visibleSuggestions[0]); }} placeholder="Locate a city or region…" aria-label="Search map locations" />
                {visibleSuggestions.length > 0 && <div className="search-suggestions">{visibleSuggestions.map((location) => <button key={location[0]} onClick={() => selectLocation(location)}><span>⌖</span>{location[0]}<small>{location[1].toFixed(2)}, {location[2].toFixed(2)}</small></button>)}</div>}
              </div>
              <button className="help-trigger" onClick={() => setPaletteOpen(true)} aria-label="Open command center" title="Command center">⌘</button>
            </div>
            <div className="map-stage">
              {dashboardView === 'globe' ? <Suspense fallback={<div className="globe-loading"><span className="loading-orbit" />Rendering orbital view…</div>}><OrbitalGlobe state={mapData} /></Suspense> : <WorldMap state={mapData} focusEvent={focusEvent} onSelect={selectEvent} />}
              <div className="map-live-badge"><span className="live-light" />{connected ? 'STREAMING' : 'SNAPSHOT'}<i />{online} SOURCES ACTIVE</div>
            </div>
            <div className="map-footnote"><span>BASEMAP © OPENSTREETMAP CONTRIBUTORS</span><span><i className="map-foot-dot" /> FILTERS APPLY TO SIGNALS · TELEMETRY LAYERS INDEPENDENT</span></div>
          </section>
          <aside className="right-rail dashboard-scroll" aria-label="Live reports">
            {renderPanels('right')}
          </aside>
        </div>
      </main>
      <section className="analytics-rail" aria-label="Data sources and analysis">
        {renderPanels('analytics')}
      </section>
      </>}
      <footer className="app-footer"><span>WORLDGPZ <i>GOD’S EYE</i></span><span>POWERED BY THADDEUSTECHZ INTELLIGENCE SYSTEMS</span><a href="/about">ABOUT / DATA NOTES</a><span className="footer-right">© 2026 THADDEUSTECHZ <b>·</b> EVERY SIGNAL. ONE EYE ON THE WORLD.</span></footer>
      {notice && <div className="command-notice" role="status">{notice}</div>}
      {settingsOpen && <DashboardSettings layout={dashboardLayout} onChange={setDashboardLayout} onClose={() => setSettingsOpen(false)} />}
      {countryBrief && <CountryBriefDialog country={countryBrief} onClose={() => setCountryBrief(null)} />}
      {snapshotOpen && <SnapshotHistory snapshots={snapshots} onCapture={captureSnapshotNow} onClose={() => setSnapshotOpen(false)} onSelectEvent={(event) => { setSnapshotOpen(false); locateEvent(event); }} canCapture={snapshotReady} storageError={snapshotError} />}
      {selectedEvent && !paletteOpen && <EventDetail event={selectedEvent} saved={savedIds.includes(selectedEvent.id)} onSave={toggleSaved} onClose={() => setSelectedEvent(null)} onLocate={locateEvent} />}
      {paletteOpen && <CommandPalette commands={commands} events={events} onSelect={selectEvent} onClose={() => setPaletteOpen(false)} />}
    </div>
  );
}
