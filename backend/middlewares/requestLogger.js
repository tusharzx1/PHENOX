const logger = require('../utils/logger');

function requestLogger(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    logger.info(
      'HTTP %s %s %s %dms',
      req.method,
      req.originalUrl,
      res.statusCode,
      durationMs
    );
  });

  next();
}

module.exports = requestLogger;
