import { useMemo, useState } from 'react';

const FILTERS = ['all', 'critical', 'high', 'medium', 'low'];
const COLORS = { critical: 'var(--red)', high: 'var(--orange)', medium: 'var(--yellow)', low: 'var(--blue)' };
const TYPE_LABELS = { seismic: 'SEISMIC', natural: 'NATURAL', conflict: 'CONFLICT', fire: 'FIRE', humanitarian: 'HUMANITARIAN', infrastructure: 'WATCHPOINT' };

function age(value) {
  const stamp = typeof value === 'number' ? value : Date.parse(value || '');
  if (!Number.isFinite(stamp)) return 'recent';
  const minutes = Math.max(0, Math.floor((Date.now() - stamp) / 60_000));
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1_440) return `${Math.floor(minutes / 60)}h`;
  return `${Math.floor(minutes / 1_440)}d`;
}

export default function EventStream({ events = [], onSelect, connected }) {
  const [filter, setFilter] = useState('all');
  const sorted = useMemo(() => [...events].sort((a, b) => (Number(b.time) || Date.parse(b.publishedAt) || 0) - (Number(a.time) || Date.parse(a.publishedAt) || 0)), [events]);
  const filtered = filter === 'all' ? sorted : sorted.filter((event) => event.severity === filter);
  return (
    <section className="panel event-stream-panel">
      <div className="section-heading event-heading">
        <div><span className="section-kicker">SITUATIONAL AWARENESS</span><h2>Signal stream</h2></div>
        <span className={`section-live ${connected ? 'connected' : ''}`}><i />{connected ? 'LIVE' : 'SYNC'}</span>
      </div>
      <div className="event-filters" role="tablist" aria-label="Filter signal severity">
        {FILTERS.map((item) => <button key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)} role="tab" aria-selected={filter === item}>{item}<span>{item === 'all' ? sorted.length : sorted.filter((event) => event.severity === item).length}</span></button>)}
      </div>
      <div className="event-list" aria-live="polite">
        {filtered.slice(0, 70).map((event, index) => {
          const severity = event.severity || 'low';
          const location = event.place || event.country || event.region || event.category || event.source;
          return <button className="event-row" key={event.id || event.external_id || `${event.title}-${index}`} onClick={() => onSelect?.(event)}>
            <span className="event-severity-bar" style={{ background: COLORS[severity] || COLORS.low }} />
            <span className="event-row-content">
              <span className="event-row-top"><span className={`severity-label severity-${severity}`}>{severity}</span><time>{age(event.time || event.publishedAt)}</time></span>
              <strong>{event.title}</strong>
              <span className="event-row-bottom"><span>{TYPE_LABELS[event.type] || String(event.type || 'SIGNAL').toUpperCase()}</span><i>·</i><span className="event-row-location">{location || 'Global'}</span><i>·</i><span>{event.source || 'Signal feed'}</span></span>
              {event.magnitude && <span className="event-extra">Magnitude {Number(event.magnitude).toFixed(1)} · depth {event.depth} km</span>}
              {Number(event.fatalities) > 0 && <span className="event-extra text-red">{event.fatalities} fatalities reported</span>}
            </span>
            <span className="event-open" aria-hidden="true">↗</span>
          </button>;
        })}
        {!filtered.length && <div className="empty-state"><span>◎</span><strong>No matching signals</strong><small>New items will appear as feeds refresh.</small></div>}
      </div>
      <div className="event-footer"><span>DISPLAYING {Math.min(filtered.length, 70)} OF {filtered.length} SIGNALS</span><span>RECENCY ↑</span></div>
    </section>
  );
}
