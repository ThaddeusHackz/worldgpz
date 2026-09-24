import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Brand } from "../components/Brand.jsx";

export default function NotFound() {
  return (
    <main className="not-found">
      <div className="hud-grid" aria-hidden="true" />
      <Brand />
      <div className="eyebrow">
        <i /> Error 404 · Signal lost
      </div>
      <h1>Off the grid.</h1>
      <p>
        The page you requested lies outside the monitored area. The eye cannot
        see it — return to the command center.
      </p>
      <Link className="button primary" to="/">
        <ArrowLeft size={16} /> Return to command center
      </Link>
    </main>
  );
}
