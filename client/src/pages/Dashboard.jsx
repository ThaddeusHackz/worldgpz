import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DashboardHeader from '../components/DashboardHeader.jsx';
import CommandPalette from '../components/CommandPalette.jsx';
import DashboardSettings from '../components/DashboardSettings.jsx';
import CountryBriefDialog from '../components/CountryBriefDialog.jsx';
import SnapshotHistory from '../components/SnapshotHistory.jsx';
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
import { loadDashboardLayout, reorderDashboardPanel, saveDashboardLayout, setDashboardPanelSize, toggleDashboardPanel } from '../lib/dashboardLayout.js';
import { captureDashboardSnapshot, loadDashboardSnapshots, SNAPSHOT_CAPTURE_INTERVAL_MS } from '../lib/snapshotHistory.js';
import { useDashboardData } from '../lib/useDashboardData.js';

const OrbitalGlobe = lazy(() => import('../components/OrbitalGlobe.jsx'));
const SEARCH_LOCATIONS = [
  ['Accra', 5.6037, -0.187], ['Beijing', 39.9042, 116.4074], ['Cairo', 30.0444, 31.2357], ['Delhi', 28.6139, 77.209],
  ['Dubai', 25.2048, 55.2708], ['Kyiv', 50.4501, 30.5234], ['London', 51.5074, -0.1278], ['New York', 40.7128, -74.006],
  ['Singapore', 1.3521, 103.8198], ['Taipei', 25.033, 121.5654], ['Tokyo', 35.6762, 139.6503], ['Washington DC', 38.9072, -77.0369],
];

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
  const [streamEnabled, setStreamEnabled] = useState(true);
  const [dashboardView, setDashboardView] = useState('map');
  const [commandsOpen, setCommandsOpen] = useState(false);
  const [focusEvent, setFocusEvent] = useState(null);
  const [search, setSearch] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dashboardLayout, setDashboardLayout] = useState(() => loadDashboardLayout());
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const [snapshots, setSnapshots] = useState(() => loadDashboardSnapshots());
  const [snapshotError, setSnapshotError] = useState('');
  const [countryBrief, setCountryBrief] = useState(null);
  const { data, refreshing, refreshAll, connected } = useDashboardData(streamEnabled);
  const currentDataRef = useRef(data);
  const panelResizeRef = useRef(null);
  currentDataRef.current = data;
  const online = data.health.filter((provider) => ['online', 'degraded'].includes(provider.status)).length;
  const providerHealth = (name) => data.health.find((provider) => provider.name === name);
  const visibleSuggestions = useMemo(() => search.trim() ? SEARCH_LOCATIONS.filter(([name]) => name.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 5) : [], [search]);
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
  }, []);
  const selectDashboardView = useCallback((view) => {
    if (['map', 'wire', 'globe'].includes(view)) setDashboardView(view);
  }, []);
  const runCommand = useCallback((action) => {
    if (action.type === 'view') selectDashboardView(action.value);
    else if (action.type === 'refresh') void refreshAll();
    else if (action.type === 'export' && action.value === 'json') downloadText(`worldgpz-dashboard-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ exportedAt: new Date().toISOString(), data }, null, 2), 'application/json');
    else if (action.type === 'export' && action.value === 'csv') downloadText(`worldgpz-events-${new Date().toISOString().slice(0, 10)}.csv`, exportEventsCsv(data.events), 'text/csv;charset=utf-8');
    else if (action.type === 'map') {
      selectDashboardView('map');
      window.setTimeout(() => window.dispatchEvent(new CustomEvent('worldgpz:map-action', { detail: action.value })), 80);
    }
    else if (action.type === 'panel') {
      const panelId = { briefing: 'briefing', news: 'news', events: 'events', markets: 'markets', predictions: 'predictions', watchlist: 'watchlist', health: 'health' }[action.value];
      if (panelId) {
        setDashboardLayout((current) => current.visible.includes(panelId) ? current : toggleDashboardPanel(current, panelId));
        window.setTimeout(() => document.querySelector(`[data-panel-id="${panelId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
      }
    } else if (action.type === 'settings') setSettingsOpen(true);
    else if (action.type === 'snapshots') setSnapshotOpen(true);
    else if (action.type === 'analyst') {
      selectDashboardView('map');
      window.setTimeout(() => document.querySelector('.analyst-open-button')?.click(), 80);
    }
  }, [data, refreshAll, selectDashboardView]);

  const selectEvent = useCallback((event) => {
    if (Number.isFinite(Number(event.latitude)) && Number.isFinite(Number(event.longitude))) setFocusEvent({ latitude: Number(event.latitude), longitude: Number(event.longitude), nonce: Date.now() });
  }, []);

  const selectLocation = (location) => {
    setFocusEvent({ latitude: location[1], longitude: location[2], nonce: Date.now() });
    setSearch(location[0]);
    window.setTimeout(() => setSearch(''), 1200);
  };

  const panelContent = {
    briefing: <AIBriefing briefing={data.briefing} provider={providerHealth('openai')} error={data.errors.briefing} />,
    countryRisk: <CountryRisk countries={data.countries} onBrief={setCountryBrief} briefEnabled={Boolean(providerHealth('openai')?.configured)} />,
    chokepoints: <Chokepoints points={data.chokepoints} />,
    markets: <MarketPulse markets={data.markets} provider={providerHealth('markets')} error={data.errors.markets} />,
    predictions: <PredictionPulse markets={data.predictions} provider={providerHealth('predictions')} error={data.errors.predictions} />,
    watchlist: <WatchlistPanel news={data.news} events={data.events} ready={Boolean(data.loaded.news && data.loaded.events)} />,
    events: <EventStream events={data.events} connected={connected} onSelect={selectEvent} />,
    news: <NewsList articles={data.news} provider={providerHealth('news')} error={data.errors.news} />,
    velocity: <SignalVelocity events={data.events} />,
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

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandsOpen(true);
        return;
      }
      const target = event.target;
      if (target instanceof HTMLElement && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)) {
        if (event.key === 'Escape') { setSearch(''); setHelpOpen(false); }
        return;
      }
      if (event.key.toLowerCase() === 'g') selectDashboardView(dashboardView === 'globe' ? 'map' : 'globe');
      if (event.key.toLowerCase() === 'r') void refreshAll();
      if (event.key === '/') { event.preventDefault(); document.querySelector('.map-search-input')?.focus(); }
      if (event.key === '?') setHelpOpen((open) => !open);
      if (event.key === 'Escape') { setHelpOpen(false); setFocusEvent(null); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dashboardView, refreshAll, selectDashboardView]);

  return (
    <div className="dashboard-shell">
      <DashboardHeader state={data} streamConnected={connected} streamEnabled={streamEnabled} onToggleStream={() => setStreamEnabled((enabled) => !enabled)} onRefresh={refreshAll} refreshing={refreshing} dashboardView={dashboardView} onDashboardView={selectDashboardView} onOpenCommands={() => setCommandsOpen(true)} onOpenSettings={() => setSettingsOpen(true)} onOpenSnapshots={() => setSnapshotOpen(true)} />
      <LiveWire articles={data.news} onSelect={selectEvent} />
      <main className="dashboard-main">
        <div className="primary-grid" data-view={dashboardView}>
          <aside className="left-rail dashboard-scroll" aria-label="Intelligence overview">
            {renderPanels('left')}
          </aside>
          <section className="map-section" aria-label="Global signal map">
            <div className="map-section-head">
              <div className="map-title-group"><span className="map-target-icon">⌖</span><span><small>EARTH / LIVE OVERVIEW</small><strong>{dashboardView === 'globe' ? 'Orbital signal globe' : 'Global signal map'}</strong></span><span className="map-time">SYNC {data.lastSync ? new Date(data.lastSync).toISOString().slice(11, 19) : '—'} UTC</span></div>
              <div className="map-search-wrap">
                <span>⌕</span><input className="map-search-input" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && visibleSuggestions[0]) selectLocation(visibleSuggestions[0]); }} placeholder="Locate a city or region…" aria-label="Search map locations" />
                {visibleSuggestions.length > 0 && <div className="search-suggestions">{visibleSuggestions.map((location) => <button key={location[0]} onClick={() => selectLocation(location)}><span>⌖</span>{location[0]}<small>{location[1].toFixed(2)}, {location[2].toFixed(2)}</small></button>)}</div>}
              </div>
              <button className="help-trigger" onClick={() => setHelpOpen(true)} aria-label="Keyboard shortcuts" title="Keyboard shortcuts">?</button>
            </div>
            <div className="map-stage">
              {dashboardView === 'map' && <WorldMap state={data} focusEvent={focusEvent} />}
              {dashboardView === 'globe' && <Suspense fallback={<div className="globe-loading"><span className="loading-orbit" />Rendering orbital view…</div>}><OrbitalGlobe state={data} /></Suspense>}
              <div className="map-live-badge"><span className="live-light" />{connected ? 'STREAMING' : 'SNAPSHOT'}<i />{online} SOURCES ACTIVE</div>
            </div>
            <div className="map-footnote"><span>BASEMAP © OPENSTREETMAP · CARTO</span><span><i className="map-foot-dot" /> SIGNAL SNAPSHOTS REFRESH AS AVAILABLE</span></div>
          </section>
          <aside className="right-rail dashboard-scroll" aria-label="Live reports">
            {renderPanels('right')}
          </aside>
        </div>
      </main>
      <section className="analytics-rail" aria-label="Data sources and analysis">
        {renderPanels('analytics')}
      </section>
      <footer className="app-footer"><span>WORLDGPZ <i>GOD’S EYE</i></span><span>POWERED BY THADDEUSTECHZ INTELLIGENCE SYSTEMS</span><a href="/about">ABOUT / DATA NOTES</a><span className="footer-right">© 2026 THADDEUSTECHZ <b>·</b> EVERY SIGNAL. ONE EYE ON THE WORLD.</span></footer>
      <CommandPalette open={commandsOpen} onClose={() => setCommandsOpen(false)} onAction={runCommand} />
      {settingsOpen && <DashboardSettings layout={dashboardLayout} onChange={setDashboardLayout} onClose={() => setSettingsOpen(false)} />}
      {countryBrief && <CountryBriefDialog country={countryBrief} onClose={() => setCountryBrief(null)} />}
      {snapshotOpen && <SnapshotHistory snapshots={snapshots} onCapture={captureSnapshotNow} onClose={() => setSnapshotOpen(false)} onSelectEvent={selectEvent} canCapture={snapshotReady} storageError={snapshotError} />}
      {helpOpen && <div className="modal-backdrop" role="presentation" onClick={() => setHelpOpen(false)}><section className="shortcut-modal" role="dialog" aria-modal="true" aria-labelledby="shortcuts-title" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={() => setHelpOpen(false)} aria-label="Close shortcuts">×</button><span className="section-kicker">NAVIGATION</span><h2 id="shortcuts-title">Keyboard shortcuts</h2>
        <div className="shortcut-row"><kbd>G</kbd><span>Switch map / globe</span></div><div className="shortcut-row"><kbd>R</kbd><span>Refresh available feeds</span></div><div className="shortcut-row"><kbd>/</kbd><span>Focus map search</span></div><div className="shortcut-row"><kbd>Ctrl / ⌘ K</kbd><span>Open the command palette</span></div><div className="shortcut-row"><kbd>?</kbd><span>Show this guide</span></div><div className="shortcut-row"><kbd>ESC</kbd><span>Close dialog / clear selection</span></div>
        <small>Developed by ThaddeusTechz</small>
      </section></div>}
    </div>
  );
}
