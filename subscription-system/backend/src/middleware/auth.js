const jwt = require('jsonwebtoken');

// ═══════════════════════════════════════════════════════════
//  authenticate — Required JWT guard
//  Blocks the request if no valid token is present.
//  Attaches decoded payload to req.user = { id, email, plan }
// ═══════════════════════════════════════════════════════════

/**
 * JWT authentication middleware (required).
 *
 * Usage:
 *   router.get('/profile', authenticate, handler)
 */
function authenticate(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  const token = header.slice(7);

  if (!token || token === 'null' || token === 'undefined') {
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id: payload.id,
      email: payload.email,
      plan: payload.plan || 'free',
    };
    req.token = token;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token has expired',
        code: 'TOKEN_EXPIRED',
      });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Invalid token',
        code: 'TOKEN_INVALID',
      });
    }
    return res.status(401).json({ error: 'Authentication failed' });
  }
}


// ═══════════════════════════════════════════════════════════
//  optionalAuth — Soft JWT guard
//  Attaches req.user if a valid token is present, but does
//  NOT block the request if the token is missing or invalid.
// ═══════════════════════════════════════════════════════════

/**
 * Optional JWT authentication middleware.
 * req.user will be set if a valid token exists, null otherwise.
 *
 * Usage:
 *   router.get('/public', optionalAuth, handler)
 *   // in handler: if (req.user) { … }
 */
function optionalAuth(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = header.slice(7);
  if (!token || token === 'null' || token === 'undefined') {
    req.user = null;
    return next();
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id: payload.id,
      email: payload.email,
      plan: payload.plan || 'free',
    };
    req.token = token;
  } catch {
    req.user = null;
  }

  next();
}


// ═══════════════════════════════════════════════════════════
//  requireOwner — Resource ownership guard
//  Blocks the request if the authenticated user's ID
//  doesn't match the :userId route param.
// ═══════════════════════════════════════════════════════════

/**
 * Ownership middleware — must be used AFTER authenticate.
 *
 * Usage:
 *   router.get('/users/:userId/data', authenticate, requireOwner, handler)
 */
function requireOwner(req, res, next) {
  const paramId = req.params.userId;
  if (!paramId) return next(); // no :userId param → skip

  if (String(req.user.id) !== String(paramId)) {
    return res.status(403).json({ error: 'Access denied — not resource owner' });
  }
  next();
}


// ═══════════════════════════════════════════════════════════
//  Token Helper
// ═══════════════════════════════════════════════════════════

/**
 * Issue a signed JWT token.
 *
 * @param {{ id: string, email: string, plan: string }} payload
 * @param {string} [expiresIn='7d']
 * @returns {string} Signed JWT
 */
function issueToken(payload, expiresIn = '7d') {
  return jwt.sign(
    {
      id: payload.id,
      email: payload.email,
      plan: payload.plan || 'free',
    },
    process.env.JWT_SECRET,
    { expiresIn }
  );
}


module.exports = {
  authenticate,
  optionalAuth,
  requireOwner,
  issueToken,
};
