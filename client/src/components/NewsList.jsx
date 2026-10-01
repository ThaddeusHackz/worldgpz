import { useMemo, useState } from 'react';

export default function NewsList({ articles = [], provider, error }) {
  const [active, setActive] = useState('all');
  const filtered = useMemo(() => active === 'all' ? articles : articles.filter((item) => (item.region || 'GLOBAL').toLowerCase().includes(active)), [active, articles]);
  return (
    <section className="panel news-panel">
      <div className="section-heading"><div><span className="section-kicker">MULTI-SOURCE WATCH</span><h2>Latest reporting</h2></div><span className="counter-badge">{articles.length}<small> ITEMS</small></span></div>
      <div className="news-regions">
        {['all', 'middle east', 'europe', 'asia pacific'].map((item) => <button key={item} onClick={() => setActive(item)} className={active === item ? 'active' : ''}>{item === 'all' ? 'ALL' : item.toUpperCase()}</button>)}
      </div>
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
