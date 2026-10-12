function compactVolume(value, unit = 'USD') {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return 'volume n/a';
  const compact = new Intl.NumberFormat('en-US', { notation: amount >= 1000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(amount);
  const prefix = unit === 'USD' ? '$' : '';
  const suffix = unit === 'MANA' ? ' MANA' : '';
  return `${prefix}${compact}${suffix} / 24h`;
}

function emptyMessage(error, provider) {
  if (error) return `Dashboard request failed: ${error}`;
  if (provider?.lastError) return `Prediction feed unavailable: ${provider.lastError}`;
  if (provider?.status === 'loading' || provider?.status === 'idle') return 'Connecting to public prediction markets…';
  return 'No active markets are available from the providers.';
}

export default function PredictionPulse({ markets = [], provider, error }) {
  const usingFallback = markets[0]?.source === 'Manifold Markets';
  return (
    <section className="panel prediction-panel">
      <div className="section-heading"><div><span className="section-kicker">CROWD-IMPLIED ODDS</span><h2>Prediction markets</h2></div><span className="source-tag">{usingFallback ? 'MANIFOLD' : 'POLYMARKET'}</span></div>
      {usingFallback && <div className="prediction-fallback-note">Primary market feed unavailable · community play-money forecast fallback.</div>}
      {markets.length > 0 && provider?.lastError && <div className="source-warning">Showing cached market data · {provider.lastError}</div>}
      <div className="prediction-list">
        {markets.slice(0, 6).map((market) => <a className="prediction-row" href={market.url} target="_blank" rel="noreferrer" key={market.id} title={`Open market at ${market.source} · ${market.category}`}>
          <span className="prediction-question">{market.question}</span>
          <span className="prediction-bar"><i style={{ width: `${market.probability}%` }} /></span>
          <span className="prediction-meta"><strong>{market.probability}% <small>{market.outcomeLabel}</small></strong><span>{compactVolume(market.volume24h, market.volumeUnit)}</span></span>
        </a>)}
        {!markets.length && <div className="mini-empty">{emptyMessage(error, provider)}</div>}
      </div>
      <div className="panel-note">Market-implied probabilities are not verified forecasts or financial advice.</div>
    </section>
  );
}
