import { Link } from 'react-router-dom';

export default function Brand() {
  return (
    <Link to="/" className="brand" aria-label="WORLDGPZ dashboard home">
      <span className="brand-emblem" aria-hidden="true"><i /><i /><i /><b /></span>
      <span className="brand-copy">
        <span className="brand-title">WORLDGPZ <em>GOD’S EYE</em></span>
        <span className="brand-subtitle">GLOBAL SIGNAL INTELLIGENCE <b>·</b> THADDEUSTECHZ</span>
      </span>
    </Link>
  );
}
