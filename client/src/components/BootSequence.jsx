import { useEffect, useState } from 'react';

const LINES = [
  'WORLDGPZ // GOD’S EYE · THADDEUSTECHZ',
  'Establishing encrypted dashboard session…',
  'Calibrating geospatial signal layers…',
  'Waiting for configured source uplinks…',
  'Global observation workspace ready.',
];

export default function BootSequence({ onComplete }) {
  const [visible, setVisible] = useState(0);
  useEffect(() => {
    const timers = LINES.map((_, index) => setTimeout(() => setVisible(index + 1), 150 + index * 140));
    const finish = setTimeout(onComplete, 1_050);
    return () => { timers.forEach(clearTimeout); clearTimeout(finish); };
  }, [onComplete]);
  return (
    <main className="boot-screen" aria-label="Starting WORLDGPZ">
      <div className="boot-card">
        <div className="boot-mark"><span>◉</span></div>
        <div className="boot-wordmark">WORLDGPZ<span> / GOD’S EYE</span></div>
        <div className="boot-console" aria-live="polite">
          {LINES.slice(0, visible).map((line, index) => <div className="boot-console-line" key={line}><span>{String(index + 1).padStart(2, '0')}</span>{line}</div>)}
        </div>
        <div className="boot-meter"><span style={{ width: `${Math.min(visible / LINES.length * 100, 100)}%` }} /></div>
        <div className="boot-credit">THADDEUSTECHZ · GLOBAL SIGNAL INTELLIGENCE</div>
      </div>
    </main>
  );
}
