import { useEffect, useMemo, useRef, useState } from 'react';
import { apiRequest } from '../lib/api.js';

const STORAGE_KEY = 'worldgpz.market-watchlist.v1';
const WATCHLIST_LIMIT = 50;
const SYMBOL_PATTERN = /^[A-Z0-9][A-Z0-9._:-]{0,23}$/;

function readSymbols() {
  if (typeof window === 'undefined') return [];
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(stored) ? [...new Set(stored.map((item) => String(item || '').trim().toUpperCase()).filter((item) => SYMBOL_PATTERN.test(item)))].slice(0, WATCHLIST_LIMIT) : [];
  } catch { return []; }
}

function money(value) {
  if (!Number.isFinite(Number(value))) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);
}

export default function MarketPulse({ markets = [], provider, error }) {
  const [symbols, setSymbols] = useState(readSymbols);
  const [seeded, setSeeded] = useState(() => readSymbols().length > 0);
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState('');
  const [quotes, setQuotes] = useState([]);
  const [watchError, setWatchError] = useState('');
  const [watchStatus, setWatchStatus] = useState('idle');
  const [loading, setLoading] = useState(false);
  const requestRef = useRef(0);
  const symbolQuery = useMemo(() => symbols.join(','), [symbols]);

  useEffect(() => {
    if (!seeded && markets.length) {
      setSymbols(markets.map((item) => item.symbol).slice(0, WATCHLIST_LIMIT));
      setSeeded(true);
    }
  }, [markets, seeded]);

  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(symbols)); } catch { setNotice('Browser storage is unavailable; the watchlist will not persist.'); }
  }, [symbols]);

  useEffect(() => {
    const requestId = ++requestRef.current;
    if (!symbolQuery) {
      setQuotes([]);
      setWatchStatus('idle');
      setWatchError('');
      return undefined;
    }
    const controller = new AbortController();
    const refresh = async () => {
      setLoading(true);
      try {
        const response = await apiRequest(`/api/markets/watchlist?symbols=${encodeURIComponent(symbolQuery)}`, { signal: controller.signal });
        if (requestRef.current !== requestId) return;
        setQuotes(Array.isArray(response.quotes) ? response.quotes : []);
        setWatchStatus(response.status || 'unknown');
        setWatchError(response.error || '');
      } catch (requestError) {
        if (controller.signal.aborted || requestRef.current !== requestId) return;
        setWatchError(requestError.message);
        setWatchStatus('offline');
      } finally {
        if (requestRef.current === requestId) setLoading(false);
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 5 * 60_000);
    return () => { window.clearInterval(timer); requestRef.current += 1; controller.abort(); };
  }, [symbolQuery]);

  const addSymbol = (event) => {
    event.preventDefault();
    const symbol = draft.trim().toUpperCase();
    if (!SYMBOL_PATTERN.test(symbol)) { setNotice('Enter a valid ticker, for example AAPL or BINANCE:BTCUSDT.'); return; }
    if (symbols.includes(symbol)) { setNotice(`${symbol} is already on your list.`); return; }
    if (symbols.length >= WATCHLIST_LIMIT) { setNotice(`Your local list is limited to ${WATCHLIST_LIMIT} symbols.`); return; }
    setSymbols((previous) => [...previous, symbol]);
    setDraft('');
    setNotice(`${symbol} added to this browser's watchlist.`);
  };

  const removeSymbol = (symbol) => {
    setSymbols((previous) => previous.filter((item) => item !== symbol));
    setNotice(`${symbol} removed.`);
  };

  return (
    <section className="panel compact-panel market-panel">
      <div className="section-heading"><div><span className="section-kicker">CAPITAL FLOWS</span><h2>Market pulse</h2></div><span className="source-tag">FINNHUB</span></div>
      <div className="market-list">
        {markets.slice(0, 7).map((market) => <div className="market-row" key={market.symbol}>
          <span className="market-symbol-wrap"><strong>{market.symbol.replace('BINANCE:', '')}</strong><small>{market.name}</small></span>
          <span className="market-price-wrap"><strong>{money(market.current)}</strong><small className={market.changePercent >= 0 ? 'positive' : 'negative'}>{market.changePercent >= 0 ? '↗' : '↘'} {Math.abs(Number(market.changePercent) || 0).toFixed(2)}%</small></span>
        </div>)}
        {!markets.length && <div className="market-empty"><span>⌁</span><p>{error ? `Dashboard request failed: ${error}` : provider?.status === 'unconfigured' ? 'Market quotes require a Finnhub API key.' : provider?.lastError ? `Market feed unavailable: ${provider.lastError}` : provider?.status === 'loading' || provider?.status === 'idle' ? 'Connecting to market data…' : 'No market quotes are available.'}</p><small>{provider?.status === 'unconfigured' ? 'Configure it in the administrator console.' : 'Provider availability and market hours affect coverage.'}</small></div>}
      </div>
      <div className="market-watchlist-block">
        <div className="market-watchlist-heading"><strong>MY SYMBOLS</strong><small>{symbols.length}/{WATCHLIST_LIMIT} · {loading ? 'UPDATING' : watchStatus.toUpperCase()}</small></div>
        <form className="market-watchlist-form" onSubmit={addSymbol}>
          <input aria-label="Add market ticker" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={24} placeholder="Add ticker, e.g. AAPL" />
          <button type="submit" disabled={!draft.trim() || symbols.length >= WATCHLIST_LIMIT}>ADD</button>
        </form>
        <div className="market-watchlist-rows">
          {quotes.map((quote) => <div className="market-watch-row" key={quote.symbol}>
            <span><strong>{quote.symbol}</strong><small>{quote.name}</small></span>
            <span><strong>{money(quote.current)}</strong><small className={Number(quote.changePercent) >= 0 ? 'positive' : 'negative'}>{Number(quote.changePercent) >= 0 ? '+' : ''}{Number(quote.changePercent || 0).toFixed(2)}%</small></span>
            <button onClick={() => removeSymbol(quote.symbol)} aria-label={`Remove ${quote.symbol}`}>×</button>
          </div>)}
          {symbols.filter((symbol) => !quotes.some((quote) => quote.symbol === symbol)).map((symbol) => <div className="market-watch-row market-watch-pending" key={symbol}>
            <span><strong>{symbol}</strong><small>{watchStatus === 'unconfigured' ? 'Finnhub key required' : 'Quote unavailable'}</small></span><span><strong>—</strong></span><button onClick={() => removeSymbol(symbol)} aria-label={`Remove ${symbol}`}>×</button>
          </div>)}
          {!symbols.length && <small className="market-watch-empty">Add up to 50 symbols. Ticker quotes require a server-side Finnhub key.</small>}
        </div>
        {watchError && <div className="market-watch-error" role="status">{watchError}</div>}
        {notice && <div className="market-watch-notice" role="status">{notice}</div>}
      </div>
      <div className="panel-note">Quotes can be delayed or unavailable outside provider coverage. Watchlist settings stay in this browser.</div>
    </section>
  );
}
