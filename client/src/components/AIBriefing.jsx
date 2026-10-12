import { useEffect, useRef, useState } from 'react';
import { relativeTime, safeUrl } from '../lib/mission.js';
import { apiRequest } from '../lib/api.js';

function threatFrom(content = '') {
  return content.match(/(?:THREAT|SIGNAL) LEVEL\s*[:—-]?\s*(LOW|ELEVATED|HIGH|CRITICAL)/i)?.[1]?.toUpperCase() || 'MONITOR';
}

const ANALYST_MIN_LENGTH = 4;
const ANALYST_MAX_LENGTH = 1200;

export default function AIBriefing({ briefing, provider, error }) {
  const [expanded, setExpanded] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const speechRef = useRef(null);
  const speechAvailable = typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  const [chatOpen, setChatOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState(null);
  const [chatError, setChatError] = useState('');
  const [asking, setAsking] = useState(false);
  useEffect(() => {
    setSpeaking(false);
    return () => { if (speechRef.current) { speechRef.current.onend = null; speechRef.current.onerror = null; window.speechSynthesis?.cancel(); speechRef.current = null; } };
  }, [briefing?.content]);
  const toggleSpeech = () => {
    if (speaking) { window.speechSynthesis.cancel(); speechRef.current = null; setSpeaking(false); return; }
    const speech = new SpeechSynthesisUtterance(briefing.content);
    speech.onend = speech.onerror = () => { setSpeaking(false); speechRef.current = null; };
    speechRef.current = speech; setSpeaking(true); window.speechSynthesis.speak(speech);
  };
  const content = briefing?.content || (error ? `Briefing request failed: ${error}` : provider?.lastError ? `Briefing source unavailable: ${provider.lastError}` : 'Collecting the latest headlines for a global digest…');
  const level = threatFrom(content);
  const lines = content.split('\n').filter(Boolean);

  const submitQuestion = async (event) => {
    event.preventDefault();
    const submitted = question.trim();
    if (submitted.length < ANALYST_MIN_LENGTH || asking) return;
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
      <div className="section-heading"><div><span className="section-kicker">MACHINE-ASSISTED SYNTHESIS</span><h2><span className="ai-spark">✳</span> World brief</h2></div><span className={`threat-pill threat-${level.toLowerCase()}`}>{level}</span></div>
      <div className={`briefing-copy ${expanded ? 'expanded' : ''}`}>
        {lines.slice(0, expanded ? lines.length : 4).map((line, index) => <p key={`${index}-${line}`} className={line.toUpperCase().includes('THREAT LEVEL') || line.toUpperCase().includes('SIGNAL LEVEL') ? 'briefing-conclusion' : ''}>{line}</p>)}
      </div>
      {lines.length > 4 && <button className="text-action" onClick={() => setExpanded((value) => !value)}>{expanded ? 'SHOW LESS' : 'READ FULL BRIEF'} <span>{expanded ? '↑' : '→'}</span></button>}
      {speechAvailable && briefing?.content && <button className="text-action briefing-speech" onClick={toggleSpeech} aria-pressed={speaking}>{speaking ? '■ STOP READING' : '▷ READ BRIEF ALOUD'}<small>DEVICE VOICE</small></button>}
      <div className="briefing-meta"><span>{briefing?.model || 'Digest pending'}</span><span>{briefing?.stale ? 'STALE BRIEF' : briefing?.fallback || briefing?.source === 'local-fallback' ? 'LOCAL FALLBACK' : briefing ? 'SOURCE SYNTHESIS' : 'AWAITING SOURCES'}</span><span>{briefing?.generatedAt ? relativeTime(briefing.generatedAt) : 'awaiting sources'}</span></div>
      {(briefing?.stale || briefing?.fallbackReason) && <div className="fallback-note">{briefing.stale ? 'Retained briefing — source information may be out of date. ' : ''}{briefing.fallbackReason || ''}</div>}
      {briefing?.limitations?.length > 0 && <details className="briefing-citations briefing-limitations"><summary>Briefing limitations</summary><ul>{briefing.limitations.map((limitation, index) => <li key={index}>{limitation}</li>)}</ul></details>}
      {briefing?.citations?.length > 0 && <details className="briefing-citations"><summary>Evidence / {briefing.citations.length} source citations</summary><ol>{briefing.citations.map((citation, index) => <li key={citation.id || index}>{safeUrl(citation.url) ? <a href={safeUrl(citation.url)} target="_blank" rel="noopener noreferrer">{citation.title || citation.source || `Source ${index + 1}`} ↗</a> : <span>{citation.title || 'Source URL unavailable'}</span>}<small>{citation.source}</small></li>)}</ol></details>}
      {briefing?.source === 'local-fallback' && <div className="fallback-note">Local headline digest · configure AI_API_KEY (or OPENAI_API_KEY) for model-generated analysis.</div>}
      <div className="analyst-action">
        <button className="text-action analyst-open-button" disabled={!provider?.configured} onClick={() => { setChatOpen(true); setChatError(''); }}>
          <span>✳</span> ASK OPENAI ANALYST <span>→</span>
        </button>
        {!provider?.configured && <small>Set AI_API_KEY (or OPENAI_API_KEY) server-side to enable.</small>}
      </div>
    </section>

    {chatOpen && <div className="modal-backdrop analyst-backdrop" role="presentation" onClick={() => !asking && setChatOpen(false)}>
      <section className="shortcut-modal analyst-modal" role="dialog" aria-modal="true" aria-labelledby="analyst-title" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={() => !asking && setChatOpen(false)} aria-label="Close analyst">×</button>
        <span className="section-kicker">OPENAI · CURRENT SOURCE RECORDS ONLY</span>
        <h2 id="analyst-title">Ask the analyst</h2>
        <p className="analyst-disclaimer">Answers are grounded in the source records the server supplies with the question. Verify important claims with the linked sources; the model may still make mistakes.</p>
        <form className="analyst-form" onSubmit={submitQuestion}>
          <label htmlFor="analyst-question">QUESTION</label>
          <textarea id="analyst-question" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={ANALYST_MAX_LENGTH} rows={4} placeholder="What are the main developments in the latest reports?" disabled={asking} />
          <div className="analyst-form-footer"><small>{question.length}/{ANALYST_MAX_LENGTH} · limited to 6 requests per 5 minutes</small><button className="primary-button" type="submit" disabled={asking || question.trim().length < ANALYST_MIN_LENGTH}>{asking ? 'ANALYZING…' : 'ASK OPENAI'}</button></div>
        </form>
        {asking && <div className="analyst-status" role="status"><span className="loading-orbit" />Reviewing current source records…</div>}
        {chatError && <div className="analyst-error" role="alert">{chatError}</div>}
        {answer && <div className="analyst-answer" aria-live="polite">
          <div className="analyst-answer-label"><span>ANALYST RESPONSE</span><small>{answer.model} · {answer.sources?.length || 0} sources</small></div>
          <div className="analyst-answer-copy">{answer.answer}</div>
          {!!answer.sources?.length && <div className="analyst-sources"><strong>SOURCE RECORDS</strong>{answer.sources.map((source) => safeUrl(source.url) ? <a key={source.id} href={safeUrl(source.url)} target="_blank" rel="noreferrer"><span>[{source.id}]</span> {source.title}<small>{source.source}{source.publishedAt ? ` · ${new Date(source.publishedAt).toLocaleDateString()}` : ''}</small></a> : <span key={source.id}><span>[{source.id}]</span> {source.title}<small>{source.source}</small></span>)}</div>}
        </div>}
      </section>
    </div>}
  </>;
}
