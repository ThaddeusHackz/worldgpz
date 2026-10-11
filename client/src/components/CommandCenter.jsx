import { useEffect, useRef, useState } from 'react';
import { hasCoordinates, relativeTime, safeUrl, timestamp } from '../lib/mission.js';

function Modal({ className, titleId, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;
    dialog.showModal();
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { dialog.close(); document.body.style.overflow = old; previous?.focus?.(); };
  }, []);
  const trapFocus = (event) => {
    if (event.key !== 'Tab') return;
    const items = [...ref.current.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]')].filter((item) => item.getClientRects().length > 0);
    const first = items[0]; const last = items[items.length - 1];
    if (!first) { event.preventDefault(); ref.current.focus(); return; }
    if (event.shiftKey && (document.activeElement === first || !items.includes(document.activeElement))) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && (document.activeElement === last || !items.includes(document.activeElement))) { event.preventDefault(); first.focus(); }
  };
  return <dialog ref={ref} className={`command-dialog ${className}`} aria-labelledby={titleId} onKeyDown={trapFocus} onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === ref.current) onClose(); }}><div className="dialog-content">{children}</div></dialog>;
}

export function MissionOverview({ mission, events, health, errors, onCommands, onExport, savedCount }) {
  const generated = timestamp(mission?.generatedAt);
  const stale = generated != null && Date.now() - generated > 30 * 60000;
  const sourceCount = new Set(events.map((event) => event.source).filter((source) => source !== 'Unspecified source')).size;
  const unavailable = health.filter((provider) => !['online', 'degraded'].includes(provider.status)).length;
  return <section className="mission-overview" aria-labelledby="mission-title">
    <div className="mission-identity"><span className="section-kicker"><i /> GLOBAL OBSERVATION / COMMAND CENTER</span><h1 id="mission-title">A world in motion.<br /><em>Context at a glance.</em></h1><p>Source-linked signals. Transparent coverage. Your operational picture.</p></div>
    <div className="mission-metrics">
      <div><span>AVAILABLE RECORDS</span><strong>{events.length.toLocaleString()}</strong><small>Mission + loaded feed records</small></div>
      <div className="priority-metric"><span>HIGH / CRITICAL</span><strong>{events.filter((event) => ['high', 'critical'].includes(event.severity)).length.toLocaleString()}</strong><small>Source / rule-assigned severity</small></div>
      <div><span>REPRESENTED SOURCES</span><strong>{sourceCount.toLocaleString()}</strong><small>{health.length ? `${unavailable} uplinks unavailable / pending` : 'Provider health pending'}</small></div>
    </div>
    <div className="mission-actions"><button className="command-trigger" onClick={onCommands}><span>⌕</span> Command center <kbd>⌘ / Ctrl K</kbd></button><button className="secondary-button report-button" onClick={onExport}>↓ Export snapshot <span>JSON</span></button><div className={`mission-status ${stale || errors.mission ? 'is-stale' : ''}`}><i />{mission ? `${stale ? 'STALE MISSION' : 'MISSION SNAPSHOT'} · ${relativeTime(mission.generatedAt)}` : errors.mission ? 'MISSION UNAVAILABLE · FEED VIEW' : 'MISSION PENDING · FEED VIEW'}<small>{savedCount} locally saved · no independent verification</small></div></div>
    <svg className="mission-orbits" viewBox="0 0 220 220" aria-hidden="true"><circle cx="110" cy="110" r="90" /><circle cx="110" cy="110" r="64" /><ellipse cx="110" cy="110" rx="90" ry="32" /><path d="M20 110h180M110 20v180" /><g className="orbit-sweep"><path d="M110 110L110 20A90 90 0 0 1 200 110Z" /></g><circle className="orbit-point" cx="174" cy="46" r="4" /></svg>
    <details className="mission-method"><summary>Coverage & methodology <span>{mission ? `${mission.windowHours ?? '—'}h mission window · ${mission.summary?.total ?? '—'} mission records` : 'Feed snapshot · coverage incomplete'}</span></summary><div><p>{typeof mission?.method === 'string' ? mission.method : 'Available source records are deduplicated by record identifier. Filters use source timestamps; records without a timestamp are excluded from time-limited views. Not a complete global incident inventory.'}</p>{mission?.coverage?.length > 0 && <ul className="coverage-chips">{mission.coverage.map((item) => <li key={item.source}>{item.source} <b>{item.count}</b></li>)}</ul>}<p>{Array.isArray(mission?.limitations) ? mission.limitations.join(' · ') : typeof mission?.limitations === 'string' ? mission.limitations : 'Source latency, unavailable providers and uneven reporting affect this view. Baseline context is not a current incident. Severity labels are not independently verified.'}</p></div></details>
  </section>;
}

export function SignalFilters({ filters, onChange, categories, total, shown, savedCount, onReset }) {
  const update = (key, value) => onChange((previous) => ({ ...previous, [key]: value }));
  return <section className="signal-toolbar" aria-label="Filter intelligence records">
    <label className="signal-query"><span aria-hidden="true">⌕</span><input id="signal-search" value={filters.search} onChange={(event) => update('search', event.target.value)} placeholder="Search signals, places, sources…" aria-label="Search intelligence records" /><kbd>/</kbd></label>
    <label><span>Category</span><select aria-label="Category" value={filters.category} onChange={(event) => update('category', event.target.value)}><option value="all">All categories</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
    <label><span>Severity</span><select aria-label="Severity" value={filters.severity} onChange={(event) => update('severity', event.target.value)}><option value="all">All severities</option>{['critical', 'high', 'medium', 'low', 'unknown'].map((severity) => <option key={severity}>{severity}</option>)}</select></label>
    <label><span>Source time</span><select aria-label="Source time" value={filters.hours} onChange={(event) => update('hours', event.target.value)}><option value="">Any time</option><option value="1">Past hour</option><option value="6">Past 6 hours</option><option value="24">Past 24 hours</option><option value="168">Past 7 days</option></select></label>
    <button className={`watchlist-filter ${filters.saved ? 'active' : ''}`} aria-pressed={filters.saved} onClick={() => update('saved', !filters.saved)}>☆ Watchlist <b>{savedCount}</b></button>
    <button className="filter-reset" onClick={onReset}>Reset</button><span className="filter-result" role="status">{shown} / {total} records</span>
  </section>;
}

export function EventDetail({ event, saved, onSave, onClose, onLocate }) {
  const url = safeUrl(event.url);
  const time = timestamp(event.time ?? event.publishedAt);
  const provenance = event.provenance;
  return <Modal className="event-detail-dialog" titleId="detail-title" onClose={onClose}>
    <header className="detail-header"><span className="section-kicker">SIGNAL DOSSIER / SOURCE RECORD</span><button className="dialog-close" onClick={onClose} aria-label="Close signal details" autoFocus>×</button></header>
    <div className="detail-badges"><span className={`severity-pill severity-${event.severity}`}>{event.severity || 'unknown'} severity</span><span>{event.type || 'signal'}</span>{['baseline', 'stale'].includes(event.provenance) && <span className="data-provenance">{event.provenance === 'baseline' ? 'Baseline context · not live' : 'Stale source record'}</span>}</div>
    <h2 id="detail-title">{event.title}</h2><p className="detail-description">{event.description || 'No additional description was provided by this source.'}</p>
    <div className="detail-actions"><button className={saved ? 'secondary-button' : 'primary-button'} onClick={() => onSave(event)} aria-pressed={saved}>{saved ? '★ Saved · remove' : '☆ Save to watchlist'}</button><button className="secondary-button" disabled={!hasCoordinates(event)} onClick={() => { onLocate(event); onClose(); }}>⌖ Locate on map</button></div>
    <dl className="detail-facts"><div><dt>Source</dt><dd>{event.source || 'Unspecified'}</dd></div><div><dt>Source timestamp</dt><dd>{time === null ? 'Unavailable — not treated as recent' : new Date(time).toUTCString()}<small>{relativeTime(event.time ?? event.publishedAt)}</small></dd></div><div><dt>Location</dt><dd>{event.place || event.country || event.region || 'Not specified'}<small>{hasCoordinates(event) ? `${Number(event.latitude).toFixed(4)}°, ${Number(event.longitude).toFixed(4)}°` : 'Coordinates unavailable'}</small></dd></div><div><dt>Record identifier</dt><dd className="record-id">{event.id || event.external_id || 'Unavailable'}</dd></div>{event.magnitude != null && <div><dt>Magnitude</dt><dd>{event.magnitude}</dd></div>}{event.fatalities != null && <div><dt>Reported fatalities</dt><dd>{event.fatalities} · source report, not independently verified</dd></div>}</dl>
    <section className="source-evidence"><span className="section-kicker">PROVENANCE / EVIDENCE</span><h3>Go beyond the signal.</h3><p>{typeof provenance === 'string' ? provenance : provenance ? JSON.stringify(provenance, null, 2) : 'Ingested source record. Severity is a source label or application heuristic, not a verified assessment.'}</p>{url ? <a className="source-link" href={url} target="_blank" rel="noopener noreferrer">Read original source <span>↗</span><small>{new URL(url).hostname}</small></a> : <div className="evidence-missing">No original source URL supplied. Treat this record as unverified context.</div>}</section>
    {event.savedAt && <p className="detail-caution">Saved locally {relativeTime(event.savedAt)}. This is a retained snapshot; it may not reflect current source information.</p>}
    <p className="detail-caution">A missing signal is not evidence of no activity. Feed availability, reporting lag and geographic coverage vary.</p>
  </Modal>;
}

export function CommandPalette({ commands, events, onSelect, onClose }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const needle = query.trim().toLowerCase();
  const choices = [...commands.filter((command) => command.label.toLowerCase().includes(needle)), ...(needle ? events.filter((event) => `${event.title} ${event.source}`.toLowerCase().includes(needle)).slice(0, 6).map((event) => ({ id: `event-${event.id}`, label: event.title, hint: event.source, run: () => onSelect(event) })) : [])];
  const execute = (choice) => { if (choice) { onClose(); choice.run(); } };
  return <Modal className="palette-dialog" titleId="palette-title" onClose={onClose}><h2 id="palette-title" className="sr-only">Command center</h2><div className="palette-input"><span>⌕</span><input autoFocus placeholder="Find an action or search source records…" aria-label="Search commands and records" role="combobox" aria-expanded="true" aria-controls="command-results" aria-autocomplete="list" aria-activedescendant={choices.length ? `command-${Math.min(active, choices.length - 1)}` : undefined} value={query} onChange={(event) => { setQuery(event.target.value); setActive(0); }} onKeyDown={(event) => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setActive((index) => choices.length ? (index + (event.key === 'ArrowDown' ? 1 : -1) + choices.length) % choices.length : 0); } if (event.key === 'Enter') { event.preventDefault(); execute(choices[active]); } }} /><button onClick={onClose} className="palette-escape" aria-label="Close commands">ESC</button></div><div className="palette-results" role="listbox" id="command-results" aria-label="Commands">{choices.map((choice, index) => <div role="option" aria-selected={index === active} id={`command-${index}`} key={choice.id} className={index === active ? 'is-active' : ''} onMouseEnter={() => setActive(index)} onClick={() => execute(choice)}><span>{choice.label}</span><small>{choice.hint || 'ACTION'} ↵</small></div>)}{!choices.length && <p className="palette-empty">No matching actions or source records.</p>}</div><footer className="palette-footer"><span>↑ ↓ Navigate · Enter select · Esc close</span><span>WORLDGPZ / COMMAND</span></footer></Modal>;
}
