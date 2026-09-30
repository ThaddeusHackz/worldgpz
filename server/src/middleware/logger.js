const MAX_RECENT_LOGS = 250;
const recentLogs = [];

export function recordOperationalLog(entry = {}) {
  const timestamp = typeof entry.timestamp === 'string' ? entry.timestamp : new Date().toISOString();
  const log = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp,
    level: ['info', 'warn', 'error'].includes(entry.level) ? entry.level : 'info',
    type: String(entry.type || 'runtime').slice(0, 40),
  };
  for (const field of ['method', 'path', 'provider', 'message']) {
    if (entry[field] !== undefined && entry[field] !== null) log[field] = String(entry[field]).slice(0, 240);
  }
  for (const field of ['status', 'durationMs']) {
    const value = Number(entry[field]);
    if (Number.isFinite(value)) log[field] = value;
  }
  recentLogs.unshift(log);
  if (recentLogs.length > MAX_RECENT_LOGS) recentLogs.length = MAX_RECENT_LOGS;
  return log;
}

export function getRecentLogs(limit = 100) {
  const count = Math.max(0, Math.min(MAX_RECENT_LOGS, Number(limit) || 0));
  return recentLogs.slice(0, count).map((entry) => ({ ...entry }));
}

export function requestLogger(req, res, next) {
  const started = Date.now();
  res.on('finish', () => {
    if (req.path === '/api/stream' || req.path === '/api/health') return;
    const durationMs = Date.now() - started;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    if (req.path.startsWith('/api/admin') || req.path.startsWith('/api/auth') || res.statusCode >= 400) {
      recordOperationalLog({
        level, type: 'request', method: req.method, path: req.path,
        status: res.statusCode, durationMs,
      });
    }
    // Do not include request bodies, headers, cookies, credentials, or query strings in logs.
    console.log(JSON.stringify({ level: 'info', method: req.method, path: req.path, status: res.statusCode, durationMs }));
  });
  next();
}
