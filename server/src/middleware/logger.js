export function requestLogger(req, res, next) {
  const started = Date.now();
  res.on('finish', () => {
    if (req.path === '/api/stream' || req.path === '/api/health') return;
    console.log(JSON.stringify({
      level: 'info', method: req.method, path: req.path,
      status: res.statusCode, durationMs: Date.now() - started,
    }));
  });
  next();
}
