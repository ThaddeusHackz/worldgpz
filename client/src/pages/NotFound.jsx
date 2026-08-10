import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Brand } from "../components/Brand.jsx";

export default function NotFound() {
  return (
    <main className="not-found">
      <Brand />
      <div className="eyebrow">Error 404</div>
      <h1>Signal lost.</h1>
      <p>The page you requested is outside the monitored area.</p>
      <Link className="button primary" to="/">
        <ArrowLeft size={16} /> Return to command center
      </Link>
    </main>
  );
}
