import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import Brand from '../components/Brand.jsx';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function submit(event) {
    event.preventDefault(); setError(''); setLoading(true);
    try { await login(email, password); navigate('/admin', { replace: true }); }
    catch (failure) { setError(failure.message || 'Sign-in failed.'); }
    finally { setLoading(false); }
  }

  return <main className="login-page">
    <div className="login-top"><Brand /><Link to="/">← DASHBOARD</Link></div>
    <section className="login-card">
      <div className="login-symbol">⌘</div><span className="section-kicker">RESTRICTED CONSOLE</span><h1>Administrator sign-in</h1><p>Use the account configured for this deployment. There are no built-in demo credentials.</p>
      <form onSubmit={submit}>
        <label htmlFor="admin-email">EMAIL ADDRESS</label><input id="admin-email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={255} />
        <label htmlFor="admin-password">PASSWORD</label><input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required maxLength={4096} />
        {error && <div className="login-error" role="alert">{error}</div>}
        <button className="primary-button login-submit" type="submit" disabled={loading}>{loading ? 'AUTHENTICATING…' : 'OPEN ADMIN CONSOLE'} <span>↗</span></button>
      </form>
      <div className="login-security"><span>◈</span> Session secured with an HTTP-only cookie · 24h expiry</div>
    </section>
    <footer className="login-footer">THADDEUSTECHZ · GOD’S EYE ACCESS CONTROL</footer>
  </main>;
}
