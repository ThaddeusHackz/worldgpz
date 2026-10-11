import { useEffect, useRef, useState } from 'react';
import { relativeTime, safeUrl } from '../lib/mission.js';

function threatFrom(content = '') {
  return content.match(/(?:THREAT|SIGNAL) LEVEL\s*[:—-]?\s*(LOW|ELEVATED|HIGH|CRITICAL)/i)?.[1]?.toUpperCase() || 'MONITOR';
}

export default function AIBriefing({ briefing, provider, error }) {
  const [expanded, setExpanded] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const speechRef = useRef(null);
  const speechAvailable = typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
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
  return (
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
      {briefing?.source === 'local-fallback' && <div className="fallback-note">Local headline digest · configure AI_API_KEY for model-generated analysis.</div>}
    </section>
  );
}
