const FRIENDLY_NAMES = {
  usgs: 'USGS seismic', eonet: 'NASA EONET', gdelt: 'GDELT news', swpc: 'NOAA SWPC', reliefweb: 'ReliefWeb',
  weather: 'Global weather', news: 'News wire', acled: 'ACLED conflict', flights: 'OpenSky flights', ships: 'AISStream AIS',
  firms: 'NASA FIRMS', markets: 'Finnhub markets', energy: 'U.S. EIA', macro: 'FRED economics', windy: 'Windy webcams',
  youtube: 'YouTube Live', openai: 'OpenAI briefing', iss: 'ISS tracking', outbreaks: 'WHO outbreaks', predictions: 'Prediction markets', launches: 'Launch schedule',
};
const STATUS = {
  online: ['online', 'green'], degraded: ['degraded', 'amber'], offline: ['offline', 'red'],
  unconfigured: ['not set', 'muted'], loading: ['connecting', 'blue'], idle: ['waiting', 'muted'],
};

export default function SourceHealth({ health = [] }) {
  const active = health.filter((provider) => ['online', 'degraded'].includes(provider.status)).length;
  return (
    <section className="panel source-health-panel">
      <div className="section-heading"><div><span className="section-kicker">SERVER-SIDE DATA MESH</span><h2>Source health</h2></div><span className="health-count"><b>{active}</b> / {health.length || 21} UP</span></div>
      <div className="health-grid">
        {health.map((provider) => {
          const [label, tone] = STATUS[provider.status] || STATUS.idle;
          return <div key={provider.name} className={`health-cell tone-${tone}`} title={provider.lastError || provider.name}>
            <span className="health-dot" /><span className="health-cell-copy"><strong>{FRIENDLY_NAMES[provider.name] || provider.name}</strong><small>{label}{provider.latencyMs ? ` · ${provider.latencyMs}ms` : ''}</small>{provider.lastError && <span className="health-detail">{provider.lastError}</span>}</span>
            {provider.dataPoints > 0 && <span className="health-points">{provider.dataPoints}</span>}
          </div>;
        })}
        {!health.length && <div className="health-waiting">Checking provider status…</div>}
      </div>
      <div className="panel-note">Only configured and reachable sources are counted as active.</div>
    </section>
  );
}
