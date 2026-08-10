import { Link } from "react-router-dom";

export function Brand({ compact = false, to = "/" }) {
  return (
    <Link
      to={to}
      className={`brand ${compact ? "brand-compact" : ""}`}
      aria-label="WORLDGPZ home"
    >
      <span className="brand-mark" aria-hidden="true">
        <span className="brand-orbit" />
        <span className="brand-dot" />
      </span>
      {!compact && (
        <span className="brand-copy">
          <strong>WORLDGPZ</strong>
          <small>Global intelligence</small>
        </span>
      )}
    </Link>
  );
}
