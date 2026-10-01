import { Link } from 'react-router-dom';
import Brand from '../components/Brand.jsx';

export default function About() {
  return <main className="document-page"><header className="document-header"><Brand /><Link to="/" className="back-link">← RETURN TO DASHBOARD</Link></header>
    <article className="about-card"><span className="section-kicker">ABOUT THIS PROJECT</span><h1>WORLDGPZ <em>God’s Eye</em></h1>
      <p>WORLDGPZ God's Eye is a real-time global signal intelligence dashboard developed by <strong>ThaddeusTechz</strong>.</p>
      <p>It brings together public geospatial feeds, news, weather, financial and economic indicators, satellite fire detections, and optional AI-assisted analysis in one map-led interface.</p>
      <div className="about-note"><strong>Data integrity</strong><span>Provider access depends on credentials, quotas and upstream availability. Country scores and route conditions are heuristic context indicators. Editorial map markers are not live event reports, vessel-traffic telemetry or operational advice.</span></div>
      <div className="about-sources"><span>OPEN DATA</span><span>SERVER-SIDE PROVIDER PROXIES</span><span>OPTIONAL AI SUMMARIES</span></div>
      <footer>Created by <strong>ThaddeusTechz</strong> — Advanced Intelligence Systems<br />© 2026 ThaddeusTechz. All rights reserved.</footer>
    </article>
  </main>;
}
