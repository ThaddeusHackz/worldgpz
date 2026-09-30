import { useState } from 'react';

function threatFrom(content = '') {
  return content.match(/(?:THREAT|SIGNAL) LEVEL\s*[:—-]?\s*(LOW|ELEVATED|HIGH|CRITICAL)/i)?.[1]?.toUpperCase() || 'MONITOR';
}

export default function AIBriefing({ briefing, provider, error }) {
  const [expanded, setExpanded] = useState(false);
  const content = briefing?.content || (error ? `Briefing request failed: ${error}` : provider?.lastError ? `Briefing source unavailable: ${provider.lastError}` : 'Collecting the latest headlines for a global digest…');
  const level = threatFrom(content);
  const lines = content.split('\n').filter(Boolean);
  return (
    <section className="panel briefing-panel">
      <div className="section-heading"><div><span className="section-kicker">MACHINE-ASSISTED SYNTHESIS</span><h2><span className="ai-spark">✳</span> World brief</h2></div><span className={`threat-pill threat-${level.toLowerCase()}`}>{level}</span></div>
      <div className={`briefing-copy ${expanded ? 'expanded' : ''}`}>
        {lines.slice(0, expanded ? 8 : 4).map((line, index) => <p key={`${index}-${line}`} className={line.toUpperCase().includes('THREAT LEVEL') || line.toUpperCase().includes('SIGNAL LEVEL') ? 'briefing-conclusion' : ''}>{line}</p>)}
      </div>
      {lines.length > 4 && <button className="text-action" onClick={() => setExpanded((value) => !value)}>{expanded ? 'SHOW LESS' : 'READ FULL BRIEF'} <span>{expanded ? '↑' : '→'}</span></button>}
      <div className="briefing-meta"><span>{briefing?.model || 'Local digest'}</span><span>{briefing?.headlineCount ?? 0} headlines</span><span>{briefing?.generatedAt ? `${Math.max(0, Math.floor((Date.now() - Date.parse(briefing.generatedAt)) / 60_000))}m ago` : 'awaiting sources'}</span></div>
      {briefing?.source === 'local-fallback' && <div className="fallback-note">Local headline digest · configure AI_API_KEY for model-generated analysis.</div>}
    </section>
  );
}
