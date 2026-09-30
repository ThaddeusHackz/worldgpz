import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import Brand from '../components/Brand.jsx';

const STATUS_CLASS = { online: 'online', degraded: 'degraded', offline: 'offline', unconfigured: 'unconfigured', idle: 'idle', loading: 'loading' };
function duration(seconds = 0) { const hours = Math.floor(seconds / 3600); const minutes = Math.floor(seconds % 3600 / 60); return `${hours}h ${minutes}m`; }
function bytes(value = 0) { return value < 1_048_576 ? `${(value / 1024).toFixed(0)} KB` : `${(value / 1_048_576).toFixed(1)} MB`; }

export default function Admin() {
  const { user, logout } = useAuth();
  const [system, setSystem] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');
  const load = useCallback(async () => {
    try { setSystem(await apiRequest('/api/admin')); }
    catch (error) { setMessage(error.message); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const refresh = async (name) => {
    setBusy(name); setMessage('');
    try { const result = await apiRequest(`/api/admin/providers/${encodeURIComponent(name)}/refresh`, { method: 'POST' }); setMessage(`${name.toUpperCase()} · ${result.status} · ${result.dataPoints} records · ${result.latencyMs}ms`); await load(); }
    catch (error) { setMessage(error.message); }
    finally { setBusy(''); }
  };
  const providers = system?.providers || [];
  return <main className="admin-page">
    <header className="admin-header"><Brand /><div className="admin-nav"><Link to="/admin/keys" className="primary-button">MANAGE API KEYS ↗</Link><Link to="/" className="secondary-button">DASHBOARD</Link><button className="secondary-button" onClick={() => { void logout(); }}>SIGN OUT</button></div></header>
    <div className="admin-content">
      <div className="admin-intro"><span className="section-kicker">SYSTEM OPERATIONS</span><h1>Administrator console</h1><p>Signed in as <strong>{user?.name || user?.email}</strong> · provider refresh, system health and encrypted credential management.</p></div>
      {message && <div className="admin-message" role="status">{message}</div>}
      <div className="admin-stats">
        <div><span>PROCESS UPTIME</span><strong>{system ? duration(system.uptime) : '—'}</strong></div>
        <div><span>HEAP USED</span><strong>{system?.memory ? bytes(system.memory.heapUsed) : '—'}</strong></div>
        <div><span>AVAILABLE UPLINKS</span><strong className="text-green">{providers.filter((item) => ['online', 'degraded'].includes(item.status)).length}<small> / {providers.length || 18}</small></strong></div>
        <div><span>CREDENTIAL STORAGE</span><strong className="storage-mode">{system?.database === 'postgresql' ? 'POSTGRESQL' : 'MEMORY ONLY'}</strong></div>
      </div>
      <section className="admin-provider-section"><div className="admin-section-title"><div><span className="section-kicker">UPLINK DIAGNOSTICS</span><h2>Provider registry</h2></div><button className="secondary-button" onClick={() => void load()}>↻ REFRESH STATUS</button></div>
        <div className="admin-provider-grid">
          {providers.map((provider) => <article className={`admin-provider status-${STATUS_CLASS[provider.status] || 'idle'}`} key={provider.name}>
            <div className="provider-title"><i /><strong>{provider.name}</strong><span>{provider.status}</span></div>
            <div className="provider-details"><span>{provider.configured ? 'credential / public feed ready' : 'credentials required'}</span><span>{provider.dataPoints || 0} records</span><span>{provider.latencyMs ? `${provider.latencyMs}ms` : '—'}</span></div>
            {provider.lastError && <p className="provider-error">{provider.lastError}</p>}
            <button className="provider-refresh" onClick={() => void refresh(provider.name)} disabled={busy === provider.name}>{busy === provider.name ? 'TESTING…' : 'FORCE REFRESH ↻'}</button>
          </article>)}
        </div>
      </section>
      <div className="admin-hint"><span>◈</span><p>Provider status reflects the last attempted connection. Optional providers remain unconfigured until a valid credential is supplied. Public feeds may be rate-limited or temporarily unavailable.</p></div>
    </div>
    <footer className="admin-footer">WORLDGPZ GOD’S EYE · POWERED BY THADDEUSTECHZ</footer>
  </main>;
}
