import { useMemo } from 'react';

export default function SignalVelocity({ events = [] }) {
  const bars = useMemo(() => {
    const values = Array(24).fill(0);
    const now = Date.now();
    for (const event of events) {
      const time = Number(event.time) || Date.parse(event.publishedAt || '');
      if (Number.isFinite(time) && now - time < 24 * 60 * 60_000) values[new Date(time).getUTCHours()] += 1;
    }
    return values;
  }, [events]);
  const max = Math.max(1, ...bars);
  return (
    <section className="panel velocity-panel">
      <div className="section-heading"><div><span className="section-kicker">GLOBAL / LAST 24 HOURS</span><h2>Signal velocity</h2></div><span className="velocity-total">{events.length} <small>signals</small></span></div>
      <div className="velocity-chart" role="img" aria-label="Hourly count of events over the past 24 hours">
        {bars.map((value, index) => <div key={index} className="velocity-column" title={`${String(index).padStart(2, '0')}:00 UTC · ${value} signals`}><i style={{ height: `${Math.max(value ? 8 : 3, (value / max) * 100)}%` }} /></div>)}
      </div>
      <div className="velocity-axis"><span>00 UTC</span><span>06</span><span>12</span><span>18</span><span>NOW</span></div>
    </section>
  );
}
