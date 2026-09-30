export function EnergyPanel({ data = [] }) {
  return (
    <section className="panel data-panel">
      <div className="section-heading"><div><span className="section-kicker">COMMODITIES</span><h2>Energy</h2></div><span className="source-tag">EIA</span></div>
      {data.slice(0, 4).map((item) => <div className="data-row" key={`${item.name}-${item.date}`}><span><strong>{item.name}</strong><small>{item.date || 'latest reported'}</small></span><b>{Number.isFinite(Number(item.value)) ? `$${Number(item.value).toFixed(2)}` : '—'}<small>{item.unit}</small></b></div>)}
      {!data.length && <div className="mini-empty">Add an EIA key to load energy indicators.</div>}
      <div className="panel-note">Latest available provider observations</div>
    </section>
  );
}

export function EconomicPanel({ data = [] }) {
  return (
    <section className="panel data-panel economy-panel">
      <div className="section-heading"><div><span className="section-kicker">MACROECONOMICS</span><h2>Economic signals</h2></div><span className="source-tag">FRED</span></div>
      <div className="economy-grid">
        {data.slice(0, 6).map((item) => <div className="economy-item" key={item.series}><span>{item.name}</span><strong>{Number.isFinite(Number(item.value)) ? Number(item.value).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}<small>{item.unit}</small></strong><time>{item.date}</time></div>)}
      </div>
      {!data.length && <div className="mini-empty">Configure FRED_API_KEY to show the latest economic series.</div>}
      <div className="panel-note">Most recent non-missing observation · {data[0]?.date || 'awaiting provider'}</div>
    </section>
  );
}

export function WeatherPanel({ weather = [] }) {
  return (
    <section className="panel weather-panel">
      <div className="section-heading"><div><span className="section-kicker">ATMOSPHERIC CONDITIONS</span><h2>Global weather</h2></div><span className="source-tag">{weather[0]?.source || 'OPEN-METEO'}</span></div>
      <div className="weather-grid">
        {weather.slice(0, 8).map((city) => <div className="weather-city" key={city.name}><span className="weather-symbol">{Number(city.windSpeed) > 12 ? '≋' : '◌'}</span><span className="weather-city-name">{city.name}<small>{city.country}</small></span><strong>{Number.isFinite(Number(city.temperature)) ? `${Math.round(city.temperature)}°` : '—'}</strong><small className="weather-desc">{city.description}</small></div>)}
      </div>
      {!weather.length && <div className="mini-empty">Connecting to global weather feeds…</div>}
    </section>
  );
}
