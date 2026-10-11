import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../lib/api.js';
import { relativeTime, safeUrl } from '../lib/mission.js';

const QUESTIONS = ['What are the highest-priority observations?', 'Where are observations geographically concentrated?', 'Which sources are represented and what are the gaps?', 'Summarize recent seismic activity.'];

export default function AnalystWorkspace({ onSelect, compact = false }) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const controller = useRef(null);
  useEffect(() => () => controller.current?.abort(), []);
  const ask = async (value) => {
    if (!value.trim() || pending) return;
    setQuestion(value); setPending(true); setError(''); setAnswer(null);
    controller.current = new AbortController();
    try { setAnswer(await apiRequest('/api/intel/ask', { method: 'POST', body: JSON.stringify({ question: value.trim() }), signal: controller.current.signal })); }
    catch (failure) { if (failure.name !== 'AbortError') setError(failure.message); }
    finally { setPending(false); }
  };
  return <section className={`analyst-workspace ${compact ? 'is-compact' : ''}`} aria-labelledby="analyst-title">
    <header className="analyst-intro"><span className="workspace-eyebrow">EVIDENCE ANALYST / LOCAL SYNTHESIS</span><h1 id="analyst-title">Ask better questions.<br /><em>Follow the evidence.</em></h1><p>A focused reading of available source observations. Deterministic synthesis, not a generative AI conversation or an independent assessment.</p></header>
    <div className="analyst-layout"><div className="analyst-console"><div className="console-label"><span className="analyst-mark">✳</span><span>YOUR QUESTION<small>Public source evidence · no paid research call</small></span></div>
      <form onSubmit={(event) => { event.preventDefault(); void ask(question); }}><label className="sr-only" htmlFor="analyst-question">Ask the evidence analyst</label><textarea id="analyst-question" maxLength={500} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="What should I pay attention to — and why?" rows={3} /><div className="analyst-submit"><span>{question.length} / 500</span><button className="workspace-primary" disabled={pending || !question.trim()}>{pending ? 'Reading observations…' : 'Analyze evidence ↗'}</button></div></form>
      <div className="suggested-questions"><span className="workspace-eyebrow">START WITH A QUESTION</span>{QUESTIONS.map((item, index) => <button key={item} disabled={pending} onClick={() => void ask(item)}><small>0{index + 1}</small>{item}<span>↗</span></button>)}</div>
    </div><div className="analyst-response" aria-live="polite" aria-busy={pending}>
      {pending ? <div className="analyst-empty"><span className="evidence-orbit" /><h2>Reading the available evidence.</h2><p>Identifying source records and coverage limitations.</p></div> : error ? <div className="analyst-empty"><span>↯</span><h2>Analysis unavailable.</h2><p>{error}</p><p>No response has been substituted. Try another question or refresh your sources.</p></div> : answer ? <>
        <div className="answer-meta"><span>LOCAL / SOURCE-GROUNDED</span><time>{relativeTime(answer.generatedAt)}</time></div><h2>{answer.question || question}</h2><p className="answer-copy">{answer.answer || 'The analyst returned no answer text.'}</p>
        <div className="answer-evidence"><span className="workspace-eyebrow">EVIDENCE TRAIL / {answer.citations?.length || 0} CITATIONS</span>{(answer.citations || []).slice(0, 12).map((citation, index) => { const url = safeUrl(citation.url); return <div className="citation-card" key={`${citation.id}-${index}`}><b>{String(index + 1).padStart(2, '0')}</b><div>{url ? <a href={url} target="_blank" rel="noopener noreferrer">{citation.title} ↗</a> : <span>{citation.title}</span>}<small>{citation.source} {!url && '· source URL unavailable'}</small></div></div>; })}{!answer.citations?.length && <p className="workspace-note">No source links supplied. This response has limited verifiability.</p>}</div>
        {answer.signals?.length > 0 && <div className="answer-signals">{answer.signals.slice(0, 5).map((signal) => <button key={signal.id} onClick={() => onSelect(signal)}><span>Inspect source record</span><strong>{signal.title}</strong><i>↗</i></button>)}</div>}
        <details className="analyst-method" open><summary>Method & limitations</summary><p>{answer.method}</p>{(answer.limitations || []).map((item, index) => <p key={index}>{item}</p>)}</details>
      </> : <div className="analyst-empty"><div className="evidence-diagram" aria-hidden="true"><i /><i /><i /><span>✳</span></div><span className="workspace-eyebrow">NOT AN ANSWER ENGINE. AN EVIDENCE LENS.</span><h2>Context you can inspect.</h2><p>Ask a question to connect observations with original sources. Answers are only as complete as the feeds currently available.</p><div className="analyst-principles"><span>01 / Source-linked</span><span>02 / Coverage-aware</span><span>03 / No invented certainty</span></div></div>}
    </div></div>
  </section>;
}
