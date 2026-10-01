import { useMemo, useState } from 'react';

export default function NewsList({ articles = [], provider, error }) {
  const [active, setActive] = useState('all');
  const [activeSource, setActiveSource] = useState('all');
  const sources = useMemo(() => [...new Set(articles.map((item) => item.source || item.domain).filter(Boolean))].sort((left, right) => left.localeCompare(right)), [articles]);
  const filtered = useMemo(() => articles.filter((item) => {
    const inRegion = active === 'all' || (item.region || 'GLOBAL').toLowerCase().includes(active);
    const inSource = activeSource === 'all' || (item.source || item.domain) === activeSource;
    return inRegion && inSource;
  }), [active, activeSource, articles]);
  return (
    <section className="panel news-panel">
      <div className="section-heading"><div><span className="section-kicker">MULTI-SOURCE WATCH</span><h2>Latest reporting</h2></div><span className="counter-badge">{articles.length}<small> ITEMS</small></span></div>
      <div className="news-regions">
        {['all', 'middle east', 'europe', 'asia pacific'].map((item) => <button key={item} onClick={() => setActive(item)} className={active === item ? 'active' : ''}>{item === 'all' ? 'ALL' : item.toUpperCase()}</button>)}
      </div>
      <label className="news-source-filter"><span>SOURCE</span><select aria-label="Filter headlines by source" value={activeSource} onChange={(event) => setActiveSource(event.target.value)}><option value="all">ALL SOURCES</option>{sources.map((source) => <option key={source} value={source}>{source}</option>)}</select></label>
      <div className="news-list">
        {filtered.slice(0, 16).map((article, index) => <a key={article.id || article.external_id || index} href={article.url || '#'} target={article.url ? '_blank' : undefined} rel="noreferrer" className="news-item">
          <span className={`news-priority news-${article.severity || 'low'}`} />
          <span><strong>{article.title}</strong><small>{article.source || article.domain || 'Global wire'} <i>·</i> {article.region || 'GLOBAL'}</small></span>
          <span className="news-arrow">↗</span>
        </a>)}
        {!filtered.length && <div className="mini-empty" role="status">{error ? `Dashboard request failed: ${error}` : provider?.lastError ? `News sources unavailable: ${provider.lastError}` : provider?.status === 'loading' || provider?.status === 'idle' ? 'Connecting to news feeds…' : 'No headlines match this filter. GDELT is used when NewsAPI is not configured.'}</div>}
      </div>
    </section>
  );
}
