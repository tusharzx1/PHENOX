const logger = require('../utils/logger');

function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

function errorHandler(err, req, res, _next) {
  const statusCode = Number(err?.status || err?.statusCode || 500);
  const message = err?.message || 'Internal Server Error';

  logger.error('Unhandled error on %s %s: %s', req.method, req.originalUrl, err?.stack || message);

  res.status(statusCode).json({
    success: false,
    message: process.env.NODE_ENV === 'production' && statusCode === 500
      ? 'Internal Server Error'
      : message,
  });
}

module.exports = errorHandler;
module.exports.notFoundHandler = notFoundHandler;
