function FeedEmpty({ provider, error, unconfigured, waiting, fallback }) {
  let message = fallback;
  if (error) message = `Dashboard request failed: ${error}`;
  else if (provider?.status === 'unconfigured') message = unconfigured;
  else if (provider?.status === 'loading' || provider?.status === 'idle') message = waiting;
  else if (provider?.lastError) message = `Source unavailable: ${provider.lastError}`;
  return <div className="mini-empty" role="status">{message}</div>;
}

export function EnergyPanel({ data = [], provider, error }) {
  return (
    <section className="panel data-panel">
      <div className="section-heading"><div><span className="section-kicker">COMMODITIES</span><h2>Energy</h2></div><span className="source-tag">EIA</span></div>
      {data.slice(0, 4).map((item) => <div className="data-row" key={`${item.name}-${item.date}`}><span><strong>{item.name}</strong><small>{item.date || 'latest reported'}</small></span><b>{Number.isFinite(Number(item.value)) ? `$${Number(item.value).toFixed(2)}` : '—'}<small>{item.unit}</small></b></div>)}
      {!data.length && <FeedEmpty provider={provider} error={error} unconfigured="Configure EIA_API_KEY to load energy indicators." waiting="Connecting to the EIA feed…" fallback="No energy observations are available." />}
      <div className="panel-note">Latest available provider observations</div>
    </section>
  );
}

export function EconomicPanel({ data = [], provider, error }) {
  return (
    <section className="panel data-panel economy-panel">
      <div className="section-heading"><div><span className="section-kicker">MACROECONOMICS</span><h2>Economic signals</h2></div><span className="source-tag">FRED</span></div>
      <div className="economy-grid">
        {data.slice(0, 6).map((item) => <div className="economy-item" key={item.series}><span>{item.name}</span><strong>{Number.isFinite(Number(item.value)) ? Number(item.value).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}<small>{item.unit}</small></strong><time>{item.date}</time></div>)}
      </div>
      {!data.length && <FeedEmpty provider={provider} error={error} unconfigured="Configure FRED_API_KEY to show the latest economic series." waiting="Connecting to the FRED feed…" fallback="No economic observations are available." />}
      <div className="panel-note">Most recent non-missing observation · {data[0]?.date || 'awaiting provider'}</div>
    </section>
  );
}

export function WeatherPanel({ weather = [], provider, error }) {
  return (
    <section className="panel weather-panel">
      <div className="section-heading"><div><span className="section-kicker">ATMOSPHERIC CONDITIONS</span><h2>Global weather</h2></div><span className="source-tag">{weather[0]?.source || 'OPEN-METEO'}</span></div>
      <div className="weather-grid">
        {weather.slice(0, 8).map((city) => <div className="weather-city" key={city.name}><span className="weather-symbol">{Number(city.windSpeed) > 12 ? '≋' : '◌'}</span><span className="weather-city-name">{city.name}<small>{city.country}</small></span><strong>{Number.isFinite(Number(city.temperature)) ? `${Math.round(city.temperature)}°` : '—'}</strong><small className="weather-desc">{city.description}</small></div>)}
      </div>
      {!weather.length && <FeedEmpty provider={provider} error={error} unconfigured="No public weather feed is configured." waiting="Connecting to global weather feeds…" fallback="Weather observations are temporarily unavailable." />}
    </section>
  );
}
