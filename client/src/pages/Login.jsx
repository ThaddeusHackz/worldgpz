import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Brand } from "../components/Brand.jsx";
import { useAuth } from "../lib/auth.jsx";

export default function Login() {
  const { login, authenticated } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
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
      await login(email.trim(), password);
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
            <i /> Restricted operations
          </span>
          <h1>
            Control the signal.
            <br />
            <em>Protect the truth.</em>
          </h1>
          <p>
            The secure console gives authorized editors control over curated
            events, source health, and the audit trail.
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
              <Sparkles size={18} />
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
          <ArrowLeft size={15} /> Back to live monitor
        </Link>
        <form className="login-form" onSubmit={submit}>
          <div className="login-icon">
            <KeyRound size={24} />
          </div>
          <span className="panel-kicker">Administrator access</span>
          <h2>Welcome back</h2>
          <p>
            Use the credentials configured in your private environment
            variables.
          </p>

          <label>
            <span>Email address</span>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@example.com"
              required
              autoFocus
            />
          </label>
          <label>
            <span>Password</span>
            <div className="password-field">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your secure password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </label>
          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}
          <button
            className="button primary login-submit"
            type="submit"
            disabled={busy}
          >
            {busy ? (
              "Authenticating…"
            ) : (
              <>
                Open secure console <ArrowRight size={16} />
              </>
            )}
          </button>
          <div className="form-security">
            <ShieldCheck size={14} /> Credentials are sent only to the
            same-origin API over HTTPS in production.
          </div>
        </form>
      </section>
    </main>
  );
}
