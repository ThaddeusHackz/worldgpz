import { useEffect, useMemo, useRef, useState } from 'react';

const COMMANDS = [
  { label: 'Show map view', detail: '2D map and full dashboard', group: 'Views', action: { type: 'view', value: 'map' }, keywords: '2d map layers' },
  { label: 'Show live wire', detail: 'Chronological news and event stream', group: 'Views', action: { type: 'view', value: 'wire' }, keywords: 'news timeline feed' },
  { label: 'Show 3D globe', detail: 'Orbital globe and signal layers', group: 'Views', action: { type: 'view', value: 'globe' }, keywords: '3d earth orbit' },
  { label: 'Open World brief', detail: 'AI briefing powered by OpenAI when configured', group: 'Panels', action: { type: 'panel', value: 'briefing' }, keywords: 'ai intelligence summary' },
  { label: 'Open latest reporting', detail: 'News headlines and source links', group: 'Panels', action: { type: 'panel', value: 'news' }, keywords: 'news wire' },
  { label: 'Open event stream', detail: 'Current event records', group: 'Panels', action: { type: 'panel', value: 'events' }, keywords: 'incidents signals' },
  { label: 'Open market pulse', detail: 'Configured stock and crypto quotes', group: 'Panels', action: { type: 'panel', value: 'markets' }, keywords: 'stocks crypto finance' },
  { label: 'Open prediction markets', detail: 'Market-implied event probabilities', group: 'Panels', action: { type: 'panel', value: 'predictions' }, keywords: 'polymarket odds' },
  { label: 'Open local watchlist', detail: 'Browser-local keyword and place alerts', group: 'Panels', action: { type: 'panel', value: 'watchlist' }, keywords: 'monitor alerts' },
  { label: 'Open source health', detail: 'Provider availability and freshness', group: 'Panels', action: { type: 'panel', value: 'health' }, keywords: 'providers status feeds' },
  { label: 'Customize dashboard layout', detail: 'Choose a workspace, show or hide panels, and reorder them', group: 'Workspace', action: { type: 'settings' }, keywords: 'settings panels layout finance crisis' },
  { label: 'Browse dashboard snapshots', detail: 'Review compact local history captured every 15 minutes', group: 'Workspace', action: { type: 'snapshots' }, keywords: 'history playback archive' },
  { label: 'Ask the OpenAI analyst', detail: 'Source-linked answers; requires OPENAI_API_KEY', group: 'Analysis', action: { type: 'analyst' }, keywords: 'chat assistant ai' },
  { label: 'Refresh available feeds', detail: 'Request an update from connected providers', group: 'Actions', action: { type: 'refresh' }, keywords: 'reload sync' },
  { label: 'Export dashboard data as JSON', detail: 'Download the currently loaded dashboard snapshot', group: 'Actions', action: { type: 'export', value: 'json' }, keywords: 'download data backup' },
  { label: 'Export event records as CSV', detail: 'Download loaded event records', group: 'Actions', action: { type: 'export', value: 'csv' }, keywords: 'download spreadsheet' },
  { label: 'Copy shareable map link', detail: 'Include map position, layers and time filter', group: 'Actions', action: { type: 'map', value: 'share' }, keywords: 'url bookmark share' },
  { label: 'Show all map layers', detail: 'Enable every available map layer', group: 'Map layers', action: { type: 'map', value: 'all-layers' }, keywords: 'enable' },
  { label: 'Show conflicts layer', group: 'Map layers', action: { type: 'map', value: 'layer:conflicts' }, keywords: 'war incidents' },
  { label: 'Show protests layer', group: 'Map layers', action: { type: 'map', value: 'layer:protests' }, keywords: 'unrest demonstrations' },
  { label: 'Show aircraft layer', group: 'Map layers', action: { type: 'map', value: 'layer:flights' }, keywords: 'aviation planes' },
  { label: 'Show vessels layer', group: 'Map layers', action: { type: 'map', value: 'layer:ships' }, keywords: 'maritime ships ais' },
  { label: 'Show chokepoints layer', group: 'Map layers', action: { type: 'map', value: 'layer:chokepoints' }, keywords: 'trade routes infrastructure' },
  { label: 'Filter map to last hour', group: 'Time range', action: { type: 'map', value: 'time:1' }, keywords: '1h recent' },
  { label: 'Filter map to last 6 hours', group: 'Time range', action: { type: 'map', value: 'time:6' }, keywords: '6h recent' },
  { label: 'Filter map to last 24 hours', group: 'Time range', action: { type: 'map', value: 'time:24' }, keywords: '24h day' },
  { label: 'Filter map to last 48 hours', group: 'Time range', action: { type: 'map', value: 'time:48' }, keywords: '48h two days' },
  { label: 'Filter map to last 7 days', group: 'Time range', action: { type: 'map', value: 'time:168' }, keywords: '7d week' },
  { label: 'Remove map time filter', group: 'Time range', action: { type: 'map', value: 'time:all' }, keywords: 'all history' },
  ...[
    ['World', '21,13,2'], ['North America', '43,-100,3'], ['Latin America', '-12,-70,3'], ['Europe', '50,14,4'],
    ['Africa', '2,20,3'], ['Middle East', '29,43,4'], ['Asia Pacific', '21,112,3'], ['Oceania', '-24,134,3'],
  ].map(([label, coordinates]) => ({ label: `Navigate to ${label}`, detail: 'Regional map preset', group: 'Regions', action: { type: 'map', value: `region:${coordinates}` }, keywords: label.toLowerCase() })),
];

export default function CommandPalette({ open, onClose, onAction }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef(null);
  const results = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return COMMANDS.slice(0, 12);
    return COMMANDS.filter((command) => `${command.label} ${command.detail || ''} ${command.group} ${command.keywords || ''}`.toLocaleLowerCase().includes(needle)).slice(0, 16);
  }, [query]);

  useEffect(() => {
    if (!open) { setQuery(''); setSelected(0); return undefined; }
    const timer = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => { setSelected(0); }, [query]);

  if (!open) return null;
  const run = (command) => { onAction(command.action); onClose(); };
  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setSelected((index) => Math.min(results.length - 1, index + 1)); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setSelected((index) => Math.max(0, index - 1)); }
    else if (event.key === 'Enter' && results[selected]) { event.preventDefault(); run(results[selected]); }
    else if (event.key === 'Escape') { event.preventDefault(); onClose(); }
  };

  return <div className="modal-backdrop command-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="command-palette" role="dialog" aria-modal="true" aria-label="Command palette" onKeyDown={handleKeyDown}>
      <div className="command-search"><span aria-hidden="true">⌕</span><input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search panels, map layers, regions, actions…" aria-label="Search commands" /><kbd>ESC</kbd></div>
      <div className="command-results" role="listbox" aria-label="Commands">
        {results.map((command, index) => <button key={`${command.group}-${command.label}`} className={`command-result ${index === selected ? 'selected' : ''}`} role="option" aria-selected={index === selected} onMouseEnter={() => setSelected(index)} onClick={() => run(command)}>
          <span className="command-result-main"><strong>{command.label}</strong>{command.detail && <small>{command.detail}</small>}</span><span className="command-result-group">{command.group}</span>
        </button>)}
        {!results.length && <div className="command-empty">No matching commands.</div>}
      </div>
      <footer><span>↑ ↓ navigate</span><span>ENTER run</span><span>CTRL / ⌘ K open</span></footer>
    </section>
  </div>;
}
