function money(value, type) {
  if (!Number.isFinite(Number(value))) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: type === 'crypto' ? 2 : 2 }).format(value);
}

export default function MarketPulse({ markets = [], provider, error }) {
  return (
    <section className="panel compact-panel market-panel">
      <div className="section-heading"><div><span className="section-kicker">CAPITAL FLOWS</span><h2>Market pulse</h2></div><span className="source-tag">FINNHUB</span></div>
      <div className="market-list">
        {markets.slice(0, 7).map((market) => <div className="market-row" key={market.symbol}>
          <span className="market-symbol-wrap"><strong>{market.symbol.replace('BINANCE:', '')}</strong><small>{market.name}</small></span>
          <span className="market-price-wrap"><strong>{money(market.current, market.type)}</strong><small className={market.changePercent >= 0 ? 'positive' : 'negative'}>{market.changePercent >= 0 ? '↗' : '↘'} {Math.abs(Number(market.changePercent) || 0).toFixed(2)}%</small></span>
        </div>)}
        {!markets.length && <div className="market-empty"><span>⌁</span><p>{error ? `Dashboard request failed: ${error}` : provider?.status === 'unconfigured' ? 'Market quotes require a Finnhub API key.' : provider?.lastError ? `Market feed unavailable: ${provider.lastError}` : provider?.status === 'loading' || provider?.status === 'idle' ? 'Connecting to market data…' : 'No market quotes are available.'}</p><small>{provider?.status === 'unconfigured' ? 'Configure it in the administrator console.' : 'Provider availability and market hours affect coverage.'}</small></div>}
      </div>
      <div className="panel-note">Quotes are delayed or unavailable outside provider coverage.</div>
    </section>
  );
}
