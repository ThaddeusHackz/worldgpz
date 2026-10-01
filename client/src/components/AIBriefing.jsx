import { useState } from 'react';
import { apiRequest } from '../lib/api.js';

function threatFrom(content = '') {
  return content.match(/(?:THREAT|SIGNAL) LEVEL\s*[:—-]?\s*(LOW|ELEVATED|HIGH|CRITICAL)/i)?.[1]?.toUpperCase() || 'MONITOR';
}

export default function AIBriefing({ briefing, provider, error }) {
  const [expanded, setExpanded] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState(null);
  const [chatError, setChatError] = useState('');
  const [asking, setAsking] = useState(false);
  const content = briefing?.content || (error ? `Briefing request failed: ${error}` : provider?.lastError ? `Briefing source unavailable: ${provider.lastError}` : 'Collecting the latest headlines for a global digest…');
  const level = threatFrom(content);
  const lines = content.split('\n').filter(Boolean);

  const submitQuestion = async (event) => {
    event.preventDefault();
    const submitted = question.trim();
    if (submitted.length < 4 || asking) return;
    setAsking(true);
    setChatError('');
    setAnswer(null);
    try {
      const result = await apiRequest('/api/intel/chat', { method: 'POST', body: JSON.stringify({ question: submitted }) });
      setAnswer(result);
    } catch (requestError) {
      setChatError(requestError.message);
    } finally {
      setAsking(false);
    }
  };

  return <>
    <section className="panel briefing-panel">
      <div className="section-heading"><div><span className="section-kicker">{briefing?.source === 'openai' ? 'OPENAI-POWERED SYNTHESIS' : briefing?.source === 'local-fallback' ? 'LOCAL KEYWORD DIGEST · NOT AI' : 'OPENAI-POWERED SYNTHESIS'}</span><h2><span className="ai-spark">✳</span> World brief</h2></div><span className={`threat-pill threat-${level.toLowerCase()}`}>{level}</span></div>
      <div className={`briefing-copy ${expanded ? 'expanded' : ''}`}>
        {lines.slice(0, expanded ? 8 : 4).map((line, index) => <p key={`${index}-${line}`} className={line.toUpperCase().includes('THREAT LEVEL') || line.toUpperCase().includes('SIGNAL LEVEL') ? 'briefing-conclusion' : ''}>{line}</p>)}
      </div>
      {lines.length > 4 && <button className="text-action" onClick={() => setExpanded((value) => !value)}>{expanded ? 'SHOW LESS' : 'READ FULL BRIEF'} <span>{expanded ? '↑' : '→'}</span></button>}
      <div className="briefing-meta"><span>{briefing?.model || 'Local digest'}</span><span>{briefing?.headlineCount ?? 0} headlines</span><span>{briefing?.generatedAt ? `${Math.max(0, Math.floor((Date.now() - Date.parse(briefing.generatedAt)) / 60_000))}m ago` : 'awaiting sources'}</span></div>
      {briefing?.source === 'local-fallback' && <div className="fallback-note">Local headline digest · configure server-side OPENAI_API_KEY for model analysis.</div>}
      {briefing && provider?.lastError && <div className="source-warning">Showing the last cached brief · OpenAI refresh failed: {provider.lastError}</div>}
      <div className="analyst-action">
        <button className="text-action analyst-open-button" disabled={!provider?.configured} onClick={() => { setChatOpen(true); setChatError(''); }}>
          <span>✳</span> ASK OPENAI ANALYST <span>→</span>
        </button>
        {!provider?.configured && <small>Set OPENAI_API_KEY server-side to enable.</small>}
      </div>
    </section>

    {chatOpen && <div className="modal-backdrop analyst-backdrop" role="presentation" onClick={() => !asking && setChatOpen(false)}>
      <section className="shortcut-modal analyst-modal" role="dialog" aria-modal="true" aria-labelledby="analyst-title" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={() => !asking && setChatOpen(false)} aria-label="Close analyst">×</button>
        <span className="section-kicker">OPENAI · LIVE SOURCE CONTEXT</span>
        <h2 id="analyst-title">Ask the analyst</h2>
        <p className="analyst-disclaimer">Answers are grounded in current available news and event records. Verify important claims with linked sources; the model may make mistakes.</p>
        <form className="analyst-form" onSubmit={submitQuestion}>
          <label htmlFor="analyst-question">QUESTION</label>
          <textarea id="analyst-question" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={1200} rows={4} placeholder="What are the main developments in the latest reports?" disabled={asking} />
          <div className="analyst-form-footer"><small>{question.length}/1200 · limited to 6 requests per 5 minutes</small><button className="primary-button" type="submit" disabled={asking || question.trim().length < 4}>{asking ? 'ANALYZING…' : 'ASK OPENAI'}</button></div>
        </form>
        {asking && <div className="analyst-status" role="status"><span className="loading-orbit" />Reviewing current source records…</div>}
        {chatError && <div className="analyst-error" role="alert">{chatError}</div>}
        {answer && <div className="analyst-answer" aria-live="polite">
          <div className="analyst-answer-label"><span>ANALYST RESPONSE</span><small>{answer.model} · {answer.sources?.length || 0} sources</small></div>
          <div className="analyst-answer-copy">{answer.answer}</div>
          {!!answer.sources?.length && <div className="analyst-sources"><strong>SOURCE RECORDS</strong>{answer.sources.map((source) => <a key={source.id} href={source.url} target="_blank" rel="noreferrer"><span>[{source.id}]</span> {source.title}<small>{source.source}{source.publishedAt ? ` · ${new Date(source.publishedAt).toLocaleDateString()}` : ''}</small></a>)}</div>}
        </div>}
      </section>
    </div>}
  </>;
}
