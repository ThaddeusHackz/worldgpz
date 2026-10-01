import { useEffect, useMemo, useState } from 'react';

function formatTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? 'Unknown time' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'medium' }).format(date);
}

export default function SnapshotHistory({ snapshots, onCapture, onClose, onSelectEvent, canCapture = false, storageError = '' }) {
  const [selectedId, setSelectedId] = useState(snapshots[0]?.id || '');
  useEffect(() => {
    if (!snapshots.some((snapshot) => snapshot.id === selectedId)) setSelectedId(snapshots[0]?.id || '');
  }, [snapshots, selectedId]);
  useEffect(() => {
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);
  const selected = useMemo(() => snapshots.find((snapshot) => snapshot.id === selectedId) || snapshots[0] || null, [snapshots, selectedId]);

  return <div className="modal-backdrop snapshot-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="snapshot-dialog" role="dialog" aria-modal="true" aria-labelledby="snapshot-title">
      <header className="snapshot-dialog-header">
        <div><span className="section-kicker">LOCAL HISTORY / 7-DAY RETENTION</span><h2 id="snapshot-title">Dashboard snapshots</h2><p>Automatic compact snapshots are stored in this browser every 15 minutes while the dashboard is open.</p></div>
        <button className="modal-close" onClick={onClose} aria-label="Close snapshot history">×</button>
      </header>
      <div className="snapshot-dialog-actions"><span>{snapshots.length} saved · not a server archive</span><button className="primary-button" onClick={onCapture} disabled={!canCapture}>CAPTURE NOW</button></div>
      {storageError && <div className="snapshot-storage-warning" role="status">{storageError}</div>}
      <div className="snapshot-browser">
        <nav className="snapshot-timeline" aria-label="Saved snapshots">
          {snapshots.map((snapshot) => <button className={snapshot.id === selected?.id ? 'active' : ''} key={snapshot.id} onClick={() => setSelectedId(snapshot.id)} aria-pressed={snapshot.id === selected?.id}>
            <strong>{formatTime(snapshot.timestamp)}</strong><small>{snapshot.counts?.events ?? 0} events · {snapshot.counts?.headlines ?? 0} headlines</small>
          </button>)}
          {!snapshots.length && <div className="snapshot-empty">No local snapshots yet. Wait for the first feed response or capture one manually.</div>}
        </nav>
        <section className="snapshot-detail" aria-live="polite">
          {selected ? <>
            <div className="snapshot-selected-time"><span className="section-kicker">HISTORICAL VIEW</span><h3>{formatTime(selected.timestamp)}</h3></div>
            <div className="snapshot-metrics">
              <div><strong>{selected.counts?.events ?? 0}</strong><small>events</small></div>
              <div><strong>{selected.counts?.headlines ?? 0}</strong><small>headlines</small></div>
              <div><strong>{selected.counts?.markets ?? 0}</strong><small>market quotes</small></div>
              <div><strong>{selected.counts?.activeSources ?? 0}</strong><small>active sources</small></div>
            </div>
            <div className="snapshot-records">
              <section><h4>Event sample</h4>{selected.events?.length ? selected.events.map((event, index) => <button className="snapshot-record" key={`${event.id || event.title}-${index}`} onClick={() => onSelectEvent(event)} disabled={!Number.isFinite(event.latitude) || !Number.isFinite(event.longitude)}>
                <strong>{event.title || 'Untitled event'}</strong><small>{[event.type, event.severity, event.source].filter(Boolean).join(' · ')}</small>
              </button>) : <small className="snapshot-no-records">No event records captured.</small>}</section>
              <section><h4>Headline sample</h4>{selected.news?.length ? selected.news.map((article, index) => article.url ? <a className="snapshot-record" key={`${article.id || article.url}-${index}`} href={article.url} target="_blank" rel="noopener noreferrer"><strong>{article.title}</strong><small>{[article.source, article.region].filter(Boolean).join(' · ')}</small></a> : <div className="snapshot-record" key={`${article.id || article.title}-${index}`}><strong>{article.title}</strong><small>{article.source}</small></div>) : <small className="snapshot-no-records">No headline records captured.</small>}</section>
            </div>
            <p className="snapshot-limit-note">This is a compact local record for browsing recent context; it does not reproduce full provider payloads or replace independently verified historical data.</p>
          </> : <div className="snapshot-empty snapshot-detail-empty">Select a saved snapshot to browse its captured context.</div>}
        </section>
      </div>
    </section>
  </div>;
}
