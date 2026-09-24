import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Fingerprint,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  ScanFace,
} from "lucide-react";
import { Brand } from "../components/Brand.jsx";
import { useAuth } from "../lib/auth.jsx";

export default function Login() {
  const { login, authenticated } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (authenticated) navigate("/admin", { replace: true });
  }, [authenticated, navigate]);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(identifier.trim(), password);
      navigate("/admin", { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-visual">
        <Brand />
        <div className="login-visual-copy">
          <span className="eyebrow">
            <i /> Restricted operations · clearance omega
          </span>
          <h1>
            Whoever you look for,
            <br />
            <em>the eye will find.</em>
          </h1>
          <p>
            The secure console gives authorized operators command over curated
            events, uplink health, and the full audit trail.
          </p>
          <div className="security-points">
            <div>
              <ShieldCheck size={18} />
              <span>
                <strong>Source-aware publishing</strong>
                <small>Every signal carries provenance</small>
              </span>
            </div>
            <div>
              <LockKeyhole size={18} />
              <span>
                <strong>Role-protected controls</strong>
                <small>Signed, expiring admin sessions</small>
              </span>
            </div>
            <div>
              <ScanFace size={18} />
              <span>
                <strong>Recorded changes</strong>
                <small>Full operational audit trail</small>
              </span>
            </div>
          </div>
        </div>
        <div className="login-globe" aria-hidden="true">
          <span />
          <i />
          <b />
        </div>
        <p className="visual-footnote">
          WORLDGPZ · Secure administration gateway
        </p>
      </section>

      <section className="login-form-side">
        <Link to="/" className="back-link">
          <ArrowLeft size={15} /> Back to live grid
        </Link>
        <form className="login-form" onSubmit={submit}>
          <div className="login-icon">
            <KeyRound size={24} />
          </div>
          <span className="panel-kicker">Operator authentication</span>
          <h2>Identify yourself</h2>
          <p>
            Clearance-level access to the GOD&apos;S EYE command console —
            signals registry, uplink keys, and the full audit trail.
          </p>

          <label>
            <span>Operator ID</span>
            <input
              type="text"
              autoComplete="username"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder="admin"
              required
              autoFocus
            />
          </label>
          <label className="password-field">
            <span>Access phrase</span>
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="•••••••••"
              required
              minLength={8}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </label>

          {error && <div className="login-error">{error}</div>}

          <button
            type="submit"
            className="button primary full login-submit"
            disabled={busy}
          >
            {busy ? (
              <>
                <Fingerprint size={16} className="spin" /> Verifying identity…
              </>
            ) : (
              <>
                <Fingerprint size={16} /> Authenticate
              </>
            )}
          </button>
          <p className="security-note">
            Sessions expire automatically. All authentication attempts are
            recorded to the audit trail.
          </p>
        </form>
      </section>
    </main>
  );
}
