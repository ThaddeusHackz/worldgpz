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

const OrbitalGlobe = lazy(() => import('../components/OrbitalGlobe.jsx'));
const SEARCH_LOCATIONS = [
  ['Accra', 5.6037, -0.187], ['Beijing', 39.9042, 116.4074], ['Cairo', 30.0444, 31.2357], ['Delhi', 28.6139, 77.209],
  ['Dubai', 25.2048, 55.2708], ['Kyiv', 50.4501, 30.5234], ['London', 51.5074, -0.1278], ['New York', 40.7128, -74.006],
  ['Singapore', 1.3521, 103.8198], ['Taipei', 25.033, 121.5654], ['Tokyo', 35.6762, 139.6503], ['Washington DC', 38.9072, -77.0369],
];

export default function Dashboard() {
  const [streamEnabled, setStreamEnabled] = useState(true);
  const [mapMode, setMapMode] = useState('2d');
  const [focusEvent, setFocusEvent] = useState(null);
  const [search, setSearch] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);
  const { data, refreshing, refreshAll, connected } = useDashboardData(streamEnabled);
  const online = data.health.filter((provider) => ['online', 'degraded'].includes(provider.status)).length;
  const visibleSuggestions = useMemo(() => search.trim() ? SEARCH_LOCATIONS.filter(([name]) => name.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 5) : [], [search]);

  const selectEvent = useCallback((event) => {
    if (Number.isFinite(Number(event.latitude)) && Number.isFinite(Number(event.longitude))) setFocusEvent({ latitude: Number(event.latitude), longitude: Number(event.longitude), nonce: Date.now() });
  }, []);

  const selectLocation = (location) => {
    setFocusEvent({ latitude: location[1], longitude: location[2], nonce: Date.now() });
    setSearch(location[0]);
    window.setTimeout(() => setSearch(''), 1200);
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      const target = event.target;
      if (target instanceof HTMLElement && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)) {
        if (event.key === 'Escape') { setSearch(''); setHelpOpen(false); }
        return;
      }
      if (event.key.toLowerCase() === 'g') setMapMode((mode) => mode === '2d' ? '3d' : '2d');
      if (event.key.toLowerCase() === 'r') void refreshAll();
      if (event.key === '/') { event.preventDefault(); document.querySelector('.map-search-input')?.focus(); }
      if (event.key === '?') setHelpOpen((open) => !open);
      if (event.key === 'Escape') { setHelpOpen(false); setFocusEvent(null); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [refreshAll]);

  return (
    <div className="dashboard-shell">
      <DashboardHeader state={data} streamConnected={connected} streamEnabled={streamEnabled} onToggleStream={() => setStreamEnabled((enabled) => !enabled)} onRefresh={refreshAll} refreshing={refreshing} mapMode={mapMode} onMapMode={setMapMode} />
      <LiveWire articles={data.news} onSelect={selectEvent} />
      <main className="dashboard-main">
        <div className="primary-grid">
          <aside className="left-rail dashboard-scroll" aria-label="Intelligence overview">
            <AIBriefing briefing={data.briefing} />
            <CountryRisk countries={data.countries} />
            <Chokepoints points={data.chokepoints} />
            <MarketPulse markets={data.markets} />
          </aside>
          <section className="map-section" aria-label="Global signal map">
            <div className="map-section-head">
              <div className="map-title-group"><span className="map-target-icon">⌖</span><span><small>EARTH / LIVE OVERVIEW</small><strong>{mapMode === '2d' ? 'Global signal map' : 'Orbital signal globe'}</strong></span><span className="map-time">SYNC {data.lastSync ? new Date(data.lastSync).toISOString().slice(11, 19) : '—'} UTC</span></div>
              <div className="map-search-wrap">
                <span>⌕</span><input className="map-search-input" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && visibleSuggestions[0]) selectLocation(visibleSuggestions[0]); }} placeholder="Locate a city or region…" aria-label="Search map locations" />
                {visibleSuggestions.length > 0 && <div className="search-suggestions">{visibleSuggestions.map((location) => <button key={location[0]} onClick={() => selectLocation(location)}><span>⌖</span>{location[0]}<small>{location[1].toFixed(2)}, {location[2].toFixed(2)}</small></button>)}</div>}
              </div>
              <button className="help-trigger" onClick={() => setHelpOpen(true)} aria-label="Keyboard shortcuts" title="Keyboard shortcuts">?</button>
            </div>
            <div className="map-stage">
              {mapMode === '2d' ? <WorldMap state={data} focusEvent={focusEvent} /> : <Suspense fallback={<div className="globe-loading"><span className="loading-orbit" />Rendering orbital view…</div>}><OrbitalGlobe state={data} /></Suspense>}
              <div className="map-live-badge"><span className="live-light" />{connected ? 'STREAMING' : 'SNAPSHOT'}<i />{online} SOURCES ACTIVE</div>
            </div>
            <div className="map-footnote"><span>BASEMAP © OPENSTREETMAP · CARTO</span><span><i className="map-foot-dot" /> SIGNAL SNAPSHOTS REFRESH AS AVAILABLE</span></div>
          </section>
          <aside className="right-rail dashboard-scroll" aria-label="Live reports">
            <EventStream events={data.events} connected={connected} onSelect={selectEvent} />
            <NewsList articles={data.news} />
          </aside>
        </div>
      </main>
      <section className="analytics-rail" aria-label="Data sources and analysis">
        <SignalVelocity events={data.events} />
        <SourceHealth health={data.health} />
        <EnergyPanel data={data.energy} />
        <EconomicPanel data={data.economics} />
        <WeatherPanel weather={data.weather} />
        <YouTubePlayer webcams={data.webcams} status={data.health.find((provider) => provider.name === 'youtube')?.status} />
      </section>
      <footer className="app-footer"><span>WORLDGPZ <i>GOD’S EYE</i></span><span>POWERED BY THADDEUSTECHZ INTELLIGENCE SYSTEMS</span><a href="/about">ABOUT / DATA NOTES</a><span className="footer-right">© 2026 THADDEUSTECHZ <b>·</b> EVERY SIGNAL. ONE EYE ON THE WORLD.</span></footer>
      {helpOpen && <div className="modal-backdrop" role="presentation" onClick={() => setHelpOpen(false)}><section className="shortcut-modal" role="dialog" aria-modal="true" aria-labelledby="shortcuts-title" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={() => setHelpOpen(false)} aria-label="Close shortcuts">×</button><span className="section-kicker">NAVIGATION</span><h2 id="shortcuts-title">Keyboard shortcuts</h2>
        <div className="shortcut-row"><kbd>G</kbd><span>Switch 2D map / 3D globe</span></div><div className="shortcut-row"><kbd>R</kbd><span>Refresh available feeds</span></div><div className="shortcut-row"><kbd>/</kbd><span>Focus map search</span></div><div className="shortcut-row"><kbd>?</kbd><span>Show this guide</span></div><div className="shortcut-row"><kbd>ESC</kbd><span>Close dialog / clear selection</span></div>
        <small>Developed by ThaddeusTechz</small>
      </section></div>}
    </div>
  );
}
