const crypto = require('crypto');
const { verifyToken } = require('@clerk/backend');

const adminAuthToken = String(process.env.ADMIN_AUTH_TOKEN || '').trim();
const clerkSecretKey = String(process.env.CLERK_SECRET_KEY || '').trim();
const allowInsecureDemoAuth =
  String(process.env.ALLOW_INSECURE_DEMO_AUTH || '').toLowerCase() === 'true' &&
  String(process.env.NODE_ENV || '').toLowerCase() !== 'production';

const extractBearerToken = (authorizationHeader = '') => {
  if (typeof authorizationHeader !== 'string') return '';
  if (!authorizationHeader.toLowerCase().startsWith('bearer ')) return '';
  return authorizationHeader.slice(7).trim();
};

const secureTokenMatch = (expected, provided) => {
  if (!expected || !provided) return false;
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  if (expectedBuffer.length !== providedBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
};

const validateAdminAuthConfig = () => {
  const isProduction = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
  const insecureFlagEnabled = String(process.env.ALLOW_INSECURE_DEMO_AUTH || '').toLowerCase() === 'true';

  if (isProduction && insecureFlagEnabled) {
    throw new Error('ALLOW_INSECURE_DEMO_AUTH must be false in production');
  }

  if (isProduction && !adminAuthToken && !clerkSecretKey) {
    throw new Error('Production requires ADMIN_AUTH_TOKEN or CLERK_SECRET_KEY');
  }
};

const requireAdminAuth = async (req, res, next) => {
  const bearerToken = extractBearerToken(req.headers.authorization);

  if (adminAuthToken) {
    if (!secureTokenMatch(adminAuthToken, bearerToken)) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    req.userId = 'admin-token';
    req.auth = { claims: { email: 'admin-token@phenox.local' } };
    return next();
  }

  if (clerkSecretKey) {
    if (!bearerToken) {
      return res.status(401).json({ success: false, message: 'Missing bearer token' });
    }

    try {
      const payload = await verifyToken(bearerToken, { secretKey: clerkSecretKey });
      req.userId = payload?.sub || 'clerk-admin';
      req.auth = {
        claims: {
          email: payload?.email || payload?.sub || 'clerk-admin'
        }
      };
      return next();
    } catch {
      return res.status(401).json({ success: false, message: 'Invalid auth token' });
    }
  }

  if (allowInsecureDemoAuth) {
    req.userId = 'demo-admin';
    req.auth = { claims: { email: 'demo@phenox.com' } };
    return next();
  }

  return res.status(503).json({
    success: false,
    message: 'Admin auth not configured. Set ADMIN_AUTH_TOKEN or CLERK_SECRET_KEY.'
  });
};

module.exports = {
  requireAdminAuth,
  validateAdminAuthConfig
};
