import { useEffect, useState } from 'react';
import { apiRequest } from '../lib/api.js';

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? 'Time unavailable' : date.toLocaleString();
}

export default function CountryBriefDialog({ country, onClose }) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let current = true;
    apiRequest('/api/intel/country-brief', { method: 'POST', body: JSON.stringify({ country: country.name }) })
      .then((data) => { if (current) setResult(data); })
      .catch((requestError) => { if (current) setError(requestError.message); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [country.name]);

  useEffect(() => {
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return <div className="modal-backdrop country-brief-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="shortcut-modal country-brief-dialog" role="dialog" aria-modal="true" aria-labelledby="country-brief-title">
      <button className="modal-close" onClick={onClose} aria-label="Close country brief">×</button>
      <span className="section-kicker">OPENAI · SOURCE-LINKED PROFILE</span>
      <h2 id="country-brief-title">{country.name} brief</h2>
      <p className="country-brief-disclaimer">The model can use only linked current source records. The adjacent index is a WORLDGPZ heuristic, not an official country-risk rating or a forecast.</p>
      {loading && <div className="analyst-status" role="status"><span className="loading-orbit" />Preparing a source-linked country brief…</div>}
      {error && <div className="analyst-error" role="alert">{error}</div>}
      {result && <>
        <div className="country-brief-score"><div><span className="section-kicker">HEURISTIC INDEX · NOT OFFICIAL</span><strong>{result.heuristicIndex?.score ?? country.score} <small>/ 100</small></strong></div><span>{result.heuristicIndex?.level || country.level}</span></div>
        <div className="country-brief-answer">{result.answer}</div>
        <div className="country-brief-meta">{result.signalCounts?.linkedSources ?? result.sources?.length ?? 0} linked sources · {formatDate(result.generatedAt)}</div>
        {result.sources?.length > 0 && <div className="analyst-sources"><strong>SOURCE RECORDS</strong>{result.sources.map((source) => <a key={source.id} href={source.url} target="_blank" rel="noopener noreferrer"><span>[{source.id}]</span> {source.title}<small>{source.source}{source.publishedAt ? ` · ${new Date(source.publishedAt).toLocaleDateString()}` : ''}</small></a>)}</div>}
        {result.heuristicIndex?.basis && <small className="country-brief-basis">{result.heuristicIndex.basis}</small>}
      </>}
    </section>
  </div>;
}
