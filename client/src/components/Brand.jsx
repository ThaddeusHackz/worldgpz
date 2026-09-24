import { Link } from "react-router-dom";

/**
 * WORLDGPZ // GOD'S EYE — brand lockup.
 * The mark is a radar aperture: diamond frame, sweeping orbit, locked core.
 */
export function Brand({ compact = false, to = "/", bare = false }) {
  const className = `brand ${compact ? "brand-compact" : ""}`;
  const content = (
    <>
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
    </>
  );

  // `bare` renders a plain span for use inside an existing <Link>/<a>.
  // Nesting <a> inside <a> is invalid HTML: browsers split the tree and React
  // logs a hydration error, so the parent link silently misbehaves.
  if (bare) return <span className={className}>{content}</span>;

  return (
    <Link to={to} className={className} aria-label="WORLDGPZ God's Eye home">
      {content}
    </Link>
  );
}
