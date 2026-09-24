import { Link } from "react-router-dom";

/**
 * WORLDGPZ // GOD'S EYE — brand lockup.
 * The mark is a radar aperture: diamond frame, sweeping orbit, locked core.
 */
export function Brand({ compact = false, to = "/" }) {
  return (
    <Link
      to={to}
      className={`brand ${compact ? "brand-compact" : ""}`}
      aria-label="WORLDGPZ God's Eye home"
    >
      <span className="brand-mark" aria-hidden="true">
        <span className="brand-orbit" />
        <span className="brand-dot" />
      </span>
      {!compact && (
        <span className="brand-copy">
          <strong>WORLDGPZ</strong>
          <small>God&apos;s Eye · Global Signal Grid</small>
        </span>
      )}
    </Link>
  );
}
