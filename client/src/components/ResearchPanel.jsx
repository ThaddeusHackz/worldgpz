import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../lib/api.js';
import { relativeTime, safeUrl } from '../lib/mission.js';
import '../workspace.css';

export default function ResearchPanel() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const controller = useRef(null);
  useEffect(() => () => controller.current?.abort(), []);
  const research = async (event) => {
    event.preventDefault(); if (!query.trim() || pending) return;
    controller.current = new AbortController(); setPending(true); setError(''); setResult(null);
    try { setResult(await apiRequest('/api/admin/research', { method: 'POST', body: JSON.stringify({ query: query.trim() }), signal: controller.current.signal })); }
    catch (failure) { if (failure.name !== 'AbortError') setError(failure.message); }
    finally { setPending(false); }
  };
  return <section className="admin-provider-section research-panel" aria-labelledby="research-title"><div className="admin-section-title"><div><span className="section-kicker">AUTHENTICATED / ON-DEMAND RESEARCH</span><h2 id="research-title">Extend the evidence trail.</h2></div><span className="research-provider">TAVILY / WEB SOURCES</span></div><p>Search beyond the monitoring feeds using your configured Tavily credential. This action may consume provider quota. Nothing runs automatically, and web results are not verified observations.</p><form onSubmit={research}><label className="sr-only" htmlFor="research-query">Administrator research query</label><input id="research-query" maxLength={500} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Research a source, place or event…" /><button className="primary-button" disabled={pending || !query.trim()}>{pending ? 'SEARCHING…' : 'RUN TAVILY RESEARCH ↗'}</button></form><div aria-live="polite" aria-busy={pending}>{error && <div className="admin-message">Research unavailable: {error}. No substitute results were generated.</div>}{result && <><div className="research-result-meta">{result.results?.length || 0} SOURCE RESULTS · {result.cached ? 'CACHED' : 'PROVIDER RESPONSE'} · {relativeTime(result.generatedAt)}</div><div className="research-results">{(result.results || []).slice(0, 10).map((item, index) => { const url = safeUrl(item.url); return <article key={item.id || `${index}-${item.title}`}><span>{String(index + 1).padStart(2, '0')}</span><div><h3>{url ? <a href={url} target="_blank" rel="noopener noreferrer">{item.title} ↗</a> : item.title}</h3><small>{item.source || (url ? new URL(url).hostname : 'Source URL unavailable')}</small><p>{item.content || 'No excerpt provided.'}</p></div></article>; })}</div>{!result.results?.length && <p>No source results returned. Try a more specific query.</p>}<details className="research-method" open><summary>Method & limitations</summary><p>{result.method}</p>{(result.limitations || []).map((item, index) => <p key={index}>{item}</p>)}</details></>}</div></section>;
}
