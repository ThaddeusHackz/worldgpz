export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  const status = Number(error.status || error.statusCode) || 500;
  console.error(JSON.stringify({ level: 'error', path: req.path, message: error.message }));
  res.status(status).json({
    error: status >= 500 && process.env.NODE_ENV === 'production' ? 'Internal server error.' : error.message,
  });
}
