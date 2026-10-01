import { useMemo } from 'react';
import { countEventsByRollingHour } from '../lib/signalVelocity.js';

export default function SignalVelocity({ events = [] }) {
  const bars = useMemo(() => countEventsByRollingHour(events), [events]);
  const total = bars.reduce((sum, value) => sum + value, 0);
  const max = Math.max(1, ...bars);
  return (
    <section className="panel velocity-panel">
      <div className="section-heading"><div><span className="section-kicker">GLOBAL / LAST 24 HOURS</span><h2>Signal velocity</h2></div><span className="velocity-total">{total} <small>signals</small></span></div>
      <div className="velocity-chart" role="img" aria-label="Hourly count of events over the rolling past 24 hours">
        {bars.map((value, index) => <div key={index} className="velocity-column" title={`${index === 23 ? 'Current hour' : `${23 - index}h ago`} · ${value} signals`}><i style={{ height: `${Math.max(value ? 8 : 3, (value / max) * 100)}%` }} /></div>)}
      </div>
      <div className="velocity-axis"><span>−24h</span><span>−18h</span><span>−12h</span><span>−6h</span><span>NOW</span></div>
    </section>
  );
}
