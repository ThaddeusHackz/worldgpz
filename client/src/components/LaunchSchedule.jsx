function formatLaunchTime(value) {
  const stamp = Date.parse(value || '');
  if (!Number.isFinite(stamp)) return 'Launch time TBD';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(stamp) + ' UTC';
}

function emptyMessage(error, provider) {
  if (error) return `Dashboard request failed: ${error}`;
  if (provider?.lastError) return `Launch schedule unavailable: ${provider.lastError}`;
  if (provider?.status === 'loading' || provider?.status === 'idle') return 'Connecting to Launch Library…';
  return 'No upcoming launches are currently listed.';
}

export default function LaunchSchedule({ launches = [], provider, error }) {
  return (
    <section className="panel launch-panel">
      <div className="section-heading"><div><span className="section-kicker">SPACEFLIGHT SCHEDULE</span><h2>Upcoming launches</h2></div><span className="source-tag">LAUNCH LIBRARY 2</span></div>
      {launches.length > 0 && provider?.lastError && <div className="source-warning">Showing cached launch schedule · {provider.lastError}</div>}
      <div className="launch-list">
        {launches.slice(0, 5).map((launch) => <article className="launch-row" key={launch.id}>
          <div className="launch-row-time"><time>{formatLaunchTime(launch.net)}</time><span>{launch.status}</span></div>
          <strong>{launch.name}</strong>
          <p>{launch.provider} · {launch.vehicle}</p>
          <small>{launch.pad} · {launch.location}</small>
          {launch.probability !== null && <span className="launch-probability">Provider-listed launch probability: {launch.probability}%</span>}
          {launch.url && <a href={launch.url} target="_blank" rel="noreferrer">Mission information ↗</a>}
        </article>)}
        {!launches.length && <div className="mini-empty">{emptyMessage(error, provider)}</div>}
      </div>
      <div className="panel-note">Schedule and status supplied by Launch Library 2; times and probabilities can change.</div>
    </section>
  );
}
