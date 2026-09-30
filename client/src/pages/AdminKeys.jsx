import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../lib/api.js';
import Brand from '../components/Brand.jsx';

const CATEGORY_ICON = { news: '◉', weather: '☼', markets: '↗', conflict: '◇', aviation: '✈', maritime: '⌑', natural: '⌁', energy: '◒', economics: '◫', media: '▷', ai: '✳' };
const STATUS_TONE = { online: 'online', degraded: 'degraded', offline: 'offline', pending: 'pending', unconfigured: 'pending', loading: 'testing' };

export default function AdminKeys() {
  const [keys, setKeys] = useState([]);
  const [stats, setStats] = useState({});
  const [editing, setEditing] = useState({});
  const [quickPaste, setQuickPaste] = useState('');
  const [testing, setTesting] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [persistence, setPersistence] = useState('memory');
  const [note, setNote] = useState('');
  const load = useCallback(async () => {
    try {
      const data = await apiRequest('/api/admin/keys');
      setKeys(data.keys || []); setStats(data.stats || {}); setPersistence(data.persistence || 'memory'); setNote(data.note || '');
    } catch (error) { setMessage(`Could not load credentials: ${error.message}`); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const grouped = useMemo(() => keys.reduce((groups, key) => { (groups[key.category] ||= []).push(key); return groups; }, {}), [keys]);
  const save = async () => {
    const entries = Object.entries(editing).filter(([, value]) => value.trim()).map(([keyName, value]) => ({ keyName, value: value.trim() }));
    if (!entries.length) { setMessage('Enter at least one non-empty provider credential before saving.'); return; }
    setSaving(true); setMessage('');
    try {
      const result = await apiRequest('/api/admin/keys', { method: 'POST', body: JSON.stringify({ keys: entries }) });
      const saved = result.results?.filter((entry) => entry.action === 'saved').length || 0;
      setMessage(`${saved} credential${saved === 1 ? '' : 's'} saved · ${result.persistence === 'postgresql' ? 'encrypted in PostgreSQL' : 'encrypted in memory only'}`);
      setEditing({}); setQuickPaste(''); await load();
    } catch (error) { setMessage(`Save failed: ${error.message}`); }
    finally { setSaving(false); }
  };
  const test = async (provider) => {
    setTesting((previous) => ({ ...previous, [provider]: true })); setMessage('');
    try {
      const result = await apiRequest(`/api/admin/keys/test/${encodeURIComponent(provider)}`, { method: 'POST' });
      setMessage(`${provider.toUpperCase()} · ${result.status} · ${result.dataPoints} records · ${result.latencyMs}ms${result.error ? ` · ${result.error}` : ''}`);
      await load();
    } catch (error) { setMessage(`Test failed: ${error.message}`); }
    finally { setTesting((previous) => ({ ...previous, [provider]: false })); }
  };
  const testAll = async () => {
    setTesting((previous) => ({ ...previous, all: true })); setMessage('Testing configured and public providers…');
    try {
      const result = await apiRequest('/api/admin/keys/test-all', { method: 'POST' });
      const rows = Object.values(result.results || {});
      const active = rows.filter((row) => ['online', 'degraded'].includes(row.status)).length;
      setMessage(`Source check complete · ${active}/${rows.length} online or degraded. See current statuses below.`);
      await load();
    } catch (error) { setMessage(`Test all failed: ${error.message}`); }
    finally { setTesting((previous) => ({ ...previous, all: false })); }
  };
  const remove = async (key) => {
    if (!window.confirm(`Remove the stored ${key.keyName} credential? Environment-managed values are not changed.`)) return;
    try { await apiRequest(`/api/admin/keys/${encodeURIComponent(key.keyName)}`, { method: 'DELETE' }); setMessage(`${key.keyName} removed from encrypted storage.`); await load(); }
    catch (error) { setMessage(`Remove failed: ${error.message}`); }
  };
  const parseQuickPaste = (value) => {
    setQuickPaste(value);
    const allowed = new Set(keys.map((key) => key.keyName));
    const parsed = {};
    for (const line of value.split(/\r?\n/)) {
      const separator = line.indexOf('=');
      if (separator < 1) continue;
      const keyName = line.slice(0, separator).trim();
      const keyValue = line.slice(separator + 1).trim();
      if (allowed.has(keyName) && keyValue) parsed[keyName] = keyValue;
    }
    if (Object.keys(parsed).length) setEditing((previous) => ({ ...previous, ...parsed }));
  };

  return <main className="keys-page">
    <header className="admin-header"><Brand /><div className="admin-nav"><Link to="/admin" className="secondary-button">← ADMIN</Link><Link to="/" className="secondary-button">DASHBOARD</Link></div></header>
    <div className="keys-content">
      <div className="admin-intro"><span className="section-kicker">SECRET MANAGEMENT</span><h1>Provider credentials</h1><p>Credentials are masked in this interface and encrypted with AES-256-GCM before storage. Full values are never returned to the browser.</p></div>
      <div className="credential-notice"><span>◈</span><p><strong>{persistence === 'postgresql' ? 'PERSISTENT STORAGE ACTIVE' : 'VOLATILE STORAGE'}</strong> · {note || 'PostgreSQL is needed for keys to persist across restarts.'} Stored keys are encrypted; environment-managed values take precedence.</p></div>
      <div className="key-stats"><span>{stats.configured || 0}<small>CONFIGURED</small></span><span className="text-green">{stats.online || 0}<small>ONLINE</small></span><span className="text-amber">{stats.degraded || 0}<small>DEGRADED</small></span><span className="text-red">{stats.offline || 0}<small>OFFLINE</small></span><span>{stats.pending || 0}<small>PENDING</small></span></div>
      <div className="key-toolbar"><button className="primary-button" onClick={() => void save()} disabled={saving || !Object.values(editing).some((value) => value.trim())}>{saving ? 'SAVING…' : 'SAVE CREDENTIALS'} <span>↗</span></button><button className="secondary-button" onClick={() => void testAll()} disabled={testing.all}>{testing.all ? 'CHECKING…' : 'TEST ALL SOURCES'}</button><button className="secondary-button" onClick={() => void load()}>↻ RELOAD</button><span>{Object.keys(editing).length} UNSAVED</span></div>
      {message && <div className="admin-message" role="status">{message}</div>}
      <div className="key-groups">
        {Object.entries(grouped).map(([category, entries]) => <section className="key-category" key={category}>
          <div className="key-category-title"><span>{CATEGORY_ICON[category] || '◈'}</span><h2>{category}</h2><small>{entries.length} credential fields</small></div>
          {entries.map((key) => <div className="key-row" key={key.keyName}>
            <span className={`credential-status tone-${STATUS_TONE[key.status] || 'pending'}`} title={key.status} />
            <div className="key-description"><strong>{key.displayLabel}</strong><small>{key.description}</small><code>{key.keyName}</code></div>
            <div className="key-current"><span>{key.hasValue ? key.value : 'NOT SET'}</span><small>{key.source === 'environment' ? 'ENVIRONMENT' : key.source === 'stored' ? 'ENCRYPTED STORE' : 'NO CREDENTIAL'}</small></div>
            <input className="key-input" type={key.isPassword ? 'password' : 'text'} autoComplete="new-password" value={editing[key.keyName] || ''} onChange={(event) => setEditing((previous) => ({ ...previous, [key.keyName]: event.target.value }))} placeholder={key.hasValue ? 'Paste new value to replace…' : 'Paste credential…'} aria-label={`New value for ${key.keyName}`} />
            <button className="key-test-button" onClick={() => void test(key.provider)} disabled={Boolean(testing[key.provider])} title={`Test ${key.provider}`}>{testing[key.provider] ? '…' : 'TEST'}</button>
            {key.source === 'stored' && <button className="key-remove-button" onClick={() => void remove(key)} title={`Remove ${key.displayLabel}`}>×</button>}
            {key.latencyMs > 0 && <span className="key-latency">{key.latencyMs}ms</span>}
          </div>)}
        </section>)}
      </div>
      <section className="quick-paste"><div><span className="section-kicker">BULK ENTRY</span><h2>Quick paste</h2><p>Paste environment variable lines to fill matching credential fields. Unknown names are ignored.</p></div><textarea value={quickPaste} onChange={(event) => parseQuickPaste(event.target.value)} placeholder={'NEWS_API_KEY=your-key\nFINNHUB_API_KEY=your-key\nFRED_API_KEY=your-key'} aria-label="Paste provider credentials in KEY=VALUE format" /><div className="quick-paste-foot"><span>{Object.keys(editing).length} fields ready · values remain masked after save</span><button className="primary-button" onClick={() => void save()} disabled={saving || !Object.values(editing).some((value) => value.trim())}>SAVE ALL ↗</button></div></section>
      <div className="credential-footnote">Never paste credentials from public prompts or commit them to source control. Rotate any key that has been disclosed. ThaddeusTechz · WORLDGPZ God's Eye</div>
    </div>
  </main>;
}
