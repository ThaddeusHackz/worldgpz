function dateLabel(value) {
  const stamp = Date.parse(value || '');
  return Number.isFinite(stamp) ? new Date(stamp).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }) : 'date unavailable';
}

function emptyMessage(error, provider) {
  if (error) return `Dashboard request failed: ${error}`;
  if (provider?.lastError) return `WHO feed unavailable: ${provider.lastError}`;
  if (provider?.status === 'loading' || provider?.status === 'idle') return 'Connecting to WHO Disease Outbreak News…';
  return 'No recent WHO notices are available.';
}

export default function OutbreakMonitor({ outbreaks = [], provider, error }) {
  return (
    <section className="panel outbreak-panel">
      <div className="section-heading"><div><span className="section-kicker">PUBLIC HEALTH WATCH</span><h2>Disease outbreaks</h2></div><span className="source-tag">WHO DON</span></div>
      {outbreaks.length > 0 && provider?.lastError && <div className="source-warning">Showing cached WHO notices · {provider.lastError}</div>}
      {outbreaks.length > 0 && provider?.status === 'degraded' && !provider?.lastError && <div className="source-warning">WHO date-filter fallback · notices ordered and filtered locally.</div>}
      <div className="outbreak-list">
        {outbreaks.slice(0, 6).map((notice) => <article className="outbreak-row" key={notice.id}>
          <div className="outbreak-row-head"><time>{dateLabel(notice.publishedAt)}</time>{notice.noticeId && <span>{notice.noticeId}</span>}</div>
          <a href={notice.url} target="_blank" rel="noreferrer">{notice.title}<span aria-hidden="true"> ↗</span></a>
          {notice.description && <p>{notice.description}</p>}
        </article>)}
        {!outbreaks.length && <div className="mini-empty">{emptyMessage(error, provider)}</div>}
      </div>
      <div className="panel-note">Official WHO notices sorted by publication date · not a clinical alerting system.</div>
    </section>
  );
}
