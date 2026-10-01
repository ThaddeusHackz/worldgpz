import { useEffect, useMemo, useRef, useState } from 'react';
import { findWatchlistMatches, normalizeWatchlist, WATCHLIST_STORAGE_KEY, WATCHLIST_LIMIT, WATCHLIST_TERM_LENGTH } from '../lib/watchlist.js';

function readWatchlist() {
  if (typeof window === 'undefined') return [];
  try { return normalizeWatchlist(JSON.parse(window.localStorage.getItem(WATCHLIST_STORAGE_KEY) || '[]')); }
  catch { return []; }
}

function readNotificationsEnabled() {
  if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') return false;
  try { return window.localStorage.getItem('worldgpz.desktop-alerts.v1') === 'true'; }
  catch { return false; }
}

function shortDate(value) {
  const timestamp = Number(value) || Date.parse(value || '');
  return Number.isFinite(timestamp) ? new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'recent';
}

export default function WatchlistPanel({ news = [], events = [], ready = false }) {
  const [terms, setTerms] = useState(readWatchlist);
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(readNotificationsEnabled);
  const seenMatches = useRef({ signature: null, ids: new Set(), ready: false });
  const matches = useMemo(() => findWatchlistMatches(news, events, terms), [news, events, terms]);
  const signature = terms.map((term) => term.toLocaleLowerCase()).join('|');

  useEffect(() => {
    try { window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(terms)); }
    catch { setNotice('Browser storage is unavailable; watch terms will not persist.'); }
  }, [terms]);

  useEffect(() => {
    const ids = new Set(matches.map((item) => item.watchId));
    if (!ready || seenMatches.current.signature !== signature || !seenMatches.current.ready) {
      seenMatches.current = { signature, ids, ready };
      return;
    }
    const previous = seenMatches.current.ids;
    const incoming = matches.filter((item) => !previous.has(item.watchId));
    const recentIds = [...new Set([...previous, ...ids])].slice(-500);
    seenMatches.current = { signature, ids: new Set(recentIds), ready };
    if (!notificationsEnabled || !incoming.length || !('Notification' in window) || Notification.permission !== 'granted') return;
    const item = incoming[0];
    try {
      new Notification(`WORLDGPZ watchlist · ${item.watchTerm}`, { body: String(item.title || 'New matching signal').slice(0, 180), tag: `worldgpz-${item.watchId}` });
    } catch { setNotice('Desktop notification could not be shown.'); }
  }, [matches, notificationsEnabled, signature, ready]);

  const addTerm = (event) => {
    event.preventDefault();
    const term = draft.trim().replace(/\s+/g, ' ').slice(0, WATCHLIST_TERM_LENGTH);
    if (!term) return;
    if (terms.some((item) => item.toLocaleLowerCase() === term.toLocaleLowerCase())) {
      setNotice('That watch term is already saved.');
      return;
    }
    if (terms.length >= WATCHLIST_LIMIT) {
      setNotice(`You can save up to ${WATCHLIST_LIMIT} watch terms.`);
      return;
    }
    setTerms((previous) => normalizeWatchlist([...previous, term]));
    setDraft('');
    setNotice('Watch term saved on this browser.');
  };

  const removeTerm = (term) => {
    setTerms((previous) => previous.filter((item) => item !== term));
    setNotice(`${term} removed from your watchlist.`);
  };

  const enableNotifications = async () => {
    if (notificationsEnabled) {
      setNotificationsEnabled(false);
      try { window.localStorage.setItem('worldgpz.desktop-alerts.v1', 'false'); } catch {}
      setNotice('Desktop alerts muted. In-app watchlist matches remain available.');
      return;
    }
    if (!('Notification' in window)) { setNotice('This browser does not support desktop notifications.'); return; }
    try {
      const permission = await Notification.requestPermission();
      const enabled = permission === 'granted';
      setNotificationsEnabled(enabled);
      try { window.localStorage.setItem('worldgpz.desktop-alerts.v1', String(enabled)); } catch {}
      setNotice(enabled ? 'Desktop alerts enabled for new matching signals.' : 'Notification permission was not granted. In-app watchlist matches remain available.');
    } catch { setNotice('Could not request notification permission.'); }
  };

  return (
    <section className="panel watchlist-panel">
      <div className="section-heading"><div><span className="section-kicker">LOCAL ALERT RULES</span><h2>Watchlist</h2></div><span className="counter-badge">{matches.length}<small> MATCHES</small></span></div>
      <form className="watchlist-form" onSubmit={addTerm}>
        <input aria-label="Watchlist keyword or place" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={WATCHLIST_TERM_LENGTH} placeholder="Keyword, country or place…" />
        <button type="submit" disabled={!draft.trim() || terms.length >= WATCHLIST_LIMIT} aria-label="Add watch term">ADD</button>
      </form>
      <div className="watchlist-terms" aria-label="Saved watch terms">
        {terms.map((term) => <span className="watchlist-chip" key={term}>{term}<button onClick={() => removeTerm(term)} aria-label={`Remove ${term}`}>×</button></span>)}
        {!terms.length && <small className="watchlist-empty">Add a term to watch current headlines and events.</small>}
      </div>
      <div className="watchlist-controls"><button className="watchlist-alert-button" onClick={() => void enableNotifications()}>{notificationsEnabled ? 'MUTE DESKTOP ALERTS' : 'ENABLE DESKTOP ALERTS'}</button><small>LOCAL · {terms.length}/{WATCHLIST_LIMIT}</small></div>
      {notice && <div className="watchlist-notice" role="status">{notice}</div>}
      <div className="watchlist-matches">
        {matches.slice(0, 5).map((item) => <article key={item.watchId}>
          <div><span>{item.watchTerm}</span><time>{shortDate(item.time || item.publishedAt)}</time></div>
          {item.url ? <a href={item.url} target="_blank" rel="noreferrer">{item.title || 'Matching signal'} ↗</a> : <strong>{item.title || 'Matching signal'}</strong>}
          <small>{item.source || item.type || 'Signal feed'}</small>
        </article>)}
        {!!terms.length && !matches.length && <small className="watchlist-empty">No current matches. Matching reports will appear here as feeds refresh.</small>}
      </div>
      <div className="panel-note">Watch terms and matching history stay in this browser. Alerts require the dashboard tab to remain open.</div>
    </section>
  );
}
