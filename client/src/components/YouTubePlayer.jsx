import { useMemo, useState } from 'react';

const REGIONS = [
  ['all', 'ALL'], ['middle-east', 'MIDDLE EAST'], ['europe', 'EUROPE'], ['americas', 'AMERICAS'], ['asia', 'ASIA'], ['space', 'SPACE'],
];

export default function YouTubePlayer({ webcams = [], status = 'unconfigured' }) {
  const [region, setRegion] = useState('all');
  const [active, setActive] = useState(null);
  const visible = useMemo(() => region === 'all' ? webcams : webcams.filter((webcam) => webcam.region === region), [region, webcams]);
  return (
    <section className="panel webcams-panel">
      <div className="section-heading"><div><span className="section-kicker">PUBLIC LIVE VIDEO</span><h2>Live windows</h2></div><span className="webcam-count">{webcams.length} FEEDS</span></div>
      <div className="webcam-tabs" role="tablist" aria-label="Filter webcam feeds">
        {REGIONS.map(([id, label]) => <button key={id} onClick={() => { setRegion(id); setActive(null); }} className={region === id ? 'active' : ''} role="tab" aria-selected={region === id}>{label}</button>)}
      </div>
      {active && <div className="video-player">
        <div className="video-title"><span><i /> LIVE · {active.title}</span><button onClick={() => setActive(null)} aria-label="Close video">×</button></div>
        <iframe src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(active.videoId)}?autoplay=1&mute=1&rel=0`} title={active.title} allow="autoplay; encrypted-media; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
      </div>}
      <div className="webcam-grid">
        {visible.slice(0, 18).map((cam) => <button className="webcam-card" key={cam.videoId} onClick={() => setActive(cam)} title={`Play ${cam.title}`}>
          {cam.thumbnail ? <img src={cam.thumbnail} alt="" loading="lazy" /> : <span className="webcam-placeholder">◉</span>}
          <span className="webcam-card-info"><strong>{cam.title}</strong><small>{cam.channel} · {cam.regionLabel || cam.region}</small></span>
          <span className="webcam-live-tag">LIVE</span>
        </button>)}
        {!visible.length && <div className="webcam-empty"><span>◉</span><strong>{status === 'unconfigured' ? 'Live video is not configured' : 'No live streams returned'}</strong><small>Set YOUTUBE_API_KEY to search for live public streams.</small><a href="https://www.youtube.com/results?search_query=live+world+news" target="_blank" rel="noreferrer">Browse live streams on YouTube ↗</a></div>}
      </div>
      <div className="panel-note">Streams are surfaced through the YouTube Data API; availability is controlled by each channel.</div>
    </section>
  );
}
