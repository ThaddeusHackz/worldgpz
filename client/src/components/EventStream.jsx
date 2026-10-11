import { relativeTime } from '../lib/mission.js';

const COLORS = { critical: 'var(--red)', high: 'var(--orange)', medium: 'var(--yellow)', low: 'var(--blue)', unknown: 'var(--muted)' };

export default function EventStream({ events = [], onSelect, onSave, connected, savedIds = [], error, savedView }) {
  return <section className="panel event-stream-panel" aria-labelledby="stream-title">
    <div className="section-heading event-heading"><div><span className="section-kicker">{savedView ? 'LOCAL / RETAINED RECORDS' : 'SOURCE-LINKED INTELLIGENCE'}</span><h2 id="stream-title">{savedView ? 'Your watchlist' : 'Signal stream'}</h2></div><span className={`section-live ${connected ? 'connected' : ''}`}><i />{connected ? 'SSE ON' : 'SNAPSHOT'}</span></div>
    <div className="stream-context">{error ? 'Event feed unavailable. Other available / retained records may be shown.' : savedView ? 'Saved on this device. Records may be out of date.' : 'Select a record to inspect its source and provenance.'}</div>
    <div className="event-list">
      {events.slice(0, 100).map((event) => <div className="signal-record" key={event.id}>
        <button className="event-row" onClick={() => onSelect?.(event)} aria-label={`Inspect ${event.title}`}>
          <span className="event-severity-bar" style={{ background: COLORS[event.severity] || COLORS.unknown }} />
          <span className="event-row-content"><span className="event-row-top"><span className={`severity-label severity-${event.severity}`}>{event.severity}</span><time>{relativeTime(event.time ?? event.publishedAt)}</time></span><strong>{event.title}</strong><span className="event-row-bottom"><span>{event.type}</span><i>·</i><span>{event.source}</span></span>{['baseline', 'stale'].includes(event.provenance) && <span className="data-provenance">{event.provenance === 'baseline' ? 'BASELINE CONTEXT · NOT LIVE' : 'STALE SOURCE RECORD'}</span>}{event.savedAt && <span className="event-extra">LOCAL SNAPSHOT · {relativeTime(event.savedAt)}</span>}</span><span className="event-open" aria-hidden="true">→</span>
        </button><button className={`record-save ${savedIds.includes(event.id) ? 'is-saved' : ''}`} aria-label={`${savedIds.includes(event.id) ? 'Remove' : 'Save'} ${event.title} ${savedIds.includes(event.id) ? 'from' : 'to'} watchlist`} aria-pressed={savedIds.includes(event.id)} onClick={() => onSave?.(event)}>{savedIds.includes(event.id) ? '★' : '☆'}</button>
      </div>)}
      {!events.length && <div className="empty-state"><span>◎</span><strong>{savedView ? 'Your watchlist is clear' : 'No matching source records'}</strong><small>{savedView ? 'Save a signal with ☆ to keep its source record.' : 'Adjust filters or wait for available feeds.'}</small><small>No records does not mean no activity.</small></div>}
    </div><div className="event-footer"><span>SHOWING {Math.min(events.length, 100)} / {events.length}</span><span>NEWEST SOURCE TIME FIRST</span></div>
  </section>;
}
