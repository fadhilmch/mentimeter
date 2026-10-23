export function notFound(req, res) {
  res.status(404).json({ message: 'Not found' });
}

export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  // A save lost a race with another writer (full optimistic concurrency): ask the client to reload and retry.
  if (err.name === 'VersionError') return res.status(409).json({ message: 'This changed in the meantime. Reload and try again.', code: 'CONFLICT' });
  const status = err.status ?? 500;
  if (status >= 500) console.error(err);
  return res.status(status).json({ message: status >= 500 ? 'Internal server error' : err.message });
}
