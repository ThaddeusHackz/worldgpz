import { Link } from 'react-router-dom';
export default function NotFound() {
  return <main className="not-found"><span className="section-kicker">SIGNAL LOST</span><h1>404</h1><p>This page is outside the current observation grid.</p><Link to="/">Return to God's Eye ↗</Link><small>THADDEUSTECHZ INTELLIGENCE SYSTEMS</small></main>;
}
