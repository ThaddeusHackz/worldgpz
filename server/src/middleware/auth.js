import jwt from 'jsonwebtoken';

export const SESSION_COOKIE = 'worldgpz_session';

function readCookie(req, name) {
  const raw = req.headers.cookie || '';
  for (const item of raw.split(';')) {
    const separator = item.indexOf('=');
    if (separator < 0) continue;
    if (item.slice(0, separator).trim() === name) {
      try { return decodeURIComponent(item.slice(separator + 1).trim()); } catch { return ''; }
    }
  }
  return '';
}

export function issueToken(user) {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be set to a unique value with at least 32 characters.');
  }
  return jwt.sign({ sub: user.email, name: user.name, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '24h', issuer: 'worldgpz' });
}

export function verifyToken(token) {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) return null;
  try { return jwt.verify(token, process.env.JWT_SECRET, { issuer: 'worldgpz' }); } catch { return null; }
}

export function authMiddleware(req, res, next) {
  const bearer = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : '';
  const token = bearer || readCookie(req, SESSION_COOKIE);
  const payload = verifyToken(token);
  if (!payload || payload.role !== 'admin') return res.status(401).json({ error: 'Administrator authentication required.' });
  req.user = { email: payload.sub, name: payload.name, role: payload.role };
  next();
}

export function authConfigurationReady() {
  const hasPassword = Boolean(process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD_HASH);
  const strongJwt = Boolean(process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32);
  return Boolean(process.env.ADMIN_EMAIL && hasPassword && strongJwt);
}

export function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 24 * 60 * 60 * 1000,
  };
}
