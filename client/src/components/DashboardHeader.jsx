import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Brand from './Brand.jsx';

function utcTime() { return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'UTC', hour12: false }).format(new Date()); }

export default function DashboardHeader({ state, streamConnected, streamEnabled, onToggleStream, onRefresh, refreshing, dashboardView, onDashboardView, onOpenCommands, onOpenSettings, onOpenSnapshots }) {
  const [clock, setClock] = useState(utcTime());
  useEffect(() => { const timer = setInterval(() => setClock(utcTime()), 1000); return () => clearInterval(timer); }, []);
  const activeSignals = state.events.length + state.flights.length + state.ships.length + state.weather.length;
  const priority = state.events.filter((event) => ['critical', 'high'].includes(event.severity)).length;
  const available = state.health.filter((provider) => ['online', 'degraded'].includes(provider.status)).length;
  return (
    <header className="topbar">
      <Brand />
      <div className="topbar-center">
        <div className="utc-clock"><span className="clock-icon">◷</span><span className="clock-value">{clock}</span><span className="clock-label">UTC</span></div>
        <div className="header-stat"><span>ACTIVE SIGNALS</span><strong>{activeSignals.toLocaleString()}</strong></div>
        <div className="header-stat"><span>PRIORITY</span><strong className="text-amber">{priority.toLocaleString()}</strong></div>
        <div className="header-stat"><span>UPLINKS</span><strong>{available}<small>/{state.health.length || 21}</small></strong></div>
      </div>
      <div className="topbar-actions">
        <button className={`live-control ${streamConnected ? 'is-live' : ''}`} onClick={onToggleStream} aria-pressed={streamEnabled} title="Toggle live server event stream">
          <span className="live-light" />{streamEnabled ? (streamConnected ? 'STREAM LIVE' : 'CONNECTING') : 'STREAM OFF'}
        </button>
        <div className="view-switch dashboard-view-switch" aria-label="Primary dashboard view">
          <button className={dashboardView === 'map' ? 'selected' : ''} onClick={() => onDashboardView('map')} aria-pressed={dashboardView === 'map'}>MAP</button>
          <button className={dashboardView === 'wire' ? 'selected' : ''} onClick={() => onDashboardView('wire')} aria-pressed={dashboardView === 'wire'}>WIRE</button>
          <button className={dashboardView === 'globe' ? 'selected' : ''} onClick={() => onDashboardView('globe')} aria-pressed={dashboardView === 'globe'}>GLOBE</button>
        </div>
        <button className="icon-button dashboard-settings-button" onClick={onOpenSettings} aria-label="Customize dashboard layout" title="Customize visible panels and workspace">⚙</button>
        <button className="icon-button snapshot-open-button" onClick={onOpenSnapshots} aria-label="Browse dashboard snapshots" title="Browse local snapshot history">◷</button>
        <button className="icon-button command-open-button" onClick={onOpenCommands} aria-label="Open command palette" title="Search panels, layers and actions · Ctrl/⌘ K">⌕</button>
        <button className="icon-button scan-button" onClick={onRefresh} disabled={refreshing} aria-label="Refresh all data" title="Refresh all data"><span className={refreshing ? 'spinning' : ''}>↻</span></button>
        <Link className="admin-link" to="/login" aria-label="Administrator sign in" title="Administrator sign in">⌘</Link>
      </div>
    </header>
  );
}
