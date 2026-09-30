const riskColor = (score) => score >= 71 ? '#fa615d' : score >= 51 ? '#f3a553' : score >= 31 ? '#e8c45d' : score >= 16 ? '#57c99a' : '#a2b4b9';

export function CountryRisk({ countries = [] }) {
  const shown = countries.slice(0, 8);
  return (
    <section className="panel compact-panel">
      <div className="section-heading"><div><span className="section-kicker">COUNTRY SIGNALS</span><h2>Risk index <sup>EST.</sup></h2></div><span className="counter-badge">{countries.length || '—'}<small> MONITORED</small></span></div>
      <div className="country-list">
        {shown.map((country) => <div className="country-risk-row" key={country.name} title={country.basis}>
          <span className="country-risk-name">{country.name}</span>
          <span className="country-meter"><i style={{ width: `${country.score}%`, background: riskColor(country.score) }} /></span>
          <strong style={{ color: riskColor(country.score) }}>{country.score}</strong>
          <span className="country-level">{country.level}</span>
        </div>)}
        {!shown.length && <div className="mini-empty">Scoring available when signal data loads.</div>}
      </div>
      <div className="panel-note">Heuristic baseline + live feed counts · not an official risk rating</div>
    </section>
  );
}

export function Chokepoints({ points = [] }) {
  const shown = points.slice(0, 6);
  const pressured = points.filter((point) => point.status === 'strained' || point.status === 'disrupted').length;
  return (
    <section className="panel compact-panel">
      <div className="section-heading"><div><span className="section-kicker">MARITIME / LOGISTICS</span><h2>Trade routes</h2></div><span className="route-counter"><b>{pressured}</b> SIGNALS</span></div>
      <div className="route-list">
        {shown.map((point) => <div className="route-row" key={point.name}>
          <span className={`route-mark ${point.status || 'monitoring'}`} />
          <span className="route-name">{point.name}<small>{point.region}</small></span>
          {point.signalCount > 0 && <span className="route-signals">{point.signalCount} SIG</span>}
          <span className={`route-state ${point.status || 'monitoring'}`}>{point.status || 'monitoring'}</span>
        </div>)}
        {!shown.length && <div className="mini-empty">Route context will be calculated from available feeds.</div>}
      </div>
      <div className="panel-note">Signal-derived watch status · not vessel traffic telemetry</div>
    </section>
  );
}
