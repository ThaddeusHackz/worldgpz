import { useMemo } from 'react';

function priorityFor(item) {
  if (item.severity === 'critical' || /major earthquake|mass casualty|declares war/i.test(item.title || '')) return 'CRITICAL';
  if (item.severity === 'high') return 'HIGH';
  return 'WIRE';
}

export default function LiveWire({ articles = [], onSelect }) {
  const items = useMemo(() => [...articles].slice(0, 18), [articles]);
  return (
    <section className="wirebar" aria-label="Latest news wire">
      <div className="wire-label"><span className="wire-icon">⌁</span><span>LIVE WIRE</span><i /></div>
      <div className="wire-track">
        {items.length ? items.map((item, index) => {
          const priority = priorityFor(item);
          return <button key={item.id || item.external_id || index} className="wire-item" onClick={() => onSelect?.(item)}>
            <span className={`wire-priority priority-${priority.toLowerCase()}`}>{priority}</span>
            <span className="wire-headline">{item.title}</span>
            <span className="wire-source">{item.domain || item.source || 'SIGNAL'}</span>
            <span className="wire-divider">/</span>
          </button>;
        }) : <div className="wire-placeholder">Awaiting news headlines · Public GDELT feed is used when a NewsAPI key is not configured</div>}
      </div>
      <div className="wire-date">{new Date().toISOString().slice(0, 10)}</div>
    </section>
  );
}
