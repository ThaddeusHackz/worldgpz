import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Brand from './Brand.jsx';

function utcTime() { return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'UTC', hour12: false }).format(new Date()); }

export default function DashboardHeader({ state, streamConnected, streamEnabled, onToggleStream, onRefresh, refreshing, mapMode, onMapMode }) {
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
        <div className="header-stat"><span>UPLINKS</span><strong>{available}<small>/{state.health.length || 18}</small></strong></div>
      </div>
      <div className="topbar-actions">
        <button className={`live-control ${streamConnected ? 'is-live' : ''}`} onClick={onToggleStream} aria-pressed={streamEnabled} title="Toggle live server event stream">
          <span className="live-light" />{streamEnabled ? (streamConnected ? 'STREAM LIVE' : 'CONNECTING') : 'STREAM OFF'}
        </button>
        <div className="view-switch" aria-label="Map view mode">
          <button className={mapMode === '2d' ? 'selected' : ''} onClick={() => onMapMode('2d')} aria-pressed={mapMode === '2d'}>2D GRID</button>
          <button className={mapMode === '3d' ? 'selected' : ''} onClick={() => onMapMode('3d')} aria-pressed={mapMode === '3d'}>3D ORBIT</button>
        </div>
        <button className="icon-button scan-button" onClick={onRefresh} disabled={refreshing} aria-label="Refresh all data" title="Refresh all data"><span className={refreshing ? 'spinning' : ''}>↻</span></button>
        <Link className="admin-link" to="/login" aria-label="Administrator sign in" title="Administrator sign in">⌘</Link>
      </div>
    </header>
  );
}
