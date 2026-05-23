const crypto = require('crypto');

// ═══════════════════════════════════════════════════════════
//  RATE LIMITER — In-memory sliding window (per IP)
// ═══════════════════════════════════════════════════════════

const rateLimitStore = new Map();

/**
 * Creates a rate limiter middleware.
 * @param {number} windowMs  — time window in ms
 * @param {number} maxReqs   — max requests per window
 * @param {string} [message] — error message
 */
function rateLimit(windowMs, maxReqs, message = 'Too many requests, please try again later') {
  return (req, res, next) => {
    const key = req.ip || req.connection.remoteAddress;
    const now = Date.now();

    if (!rateLimitStore.has(key)) {
      rateLimitStore.set(key, []);
    }

    const timestamps = rateLimitStore.get(key).filter(t => t > now - windowMs);
    timestamps.push(now);
    rateLimitStore.set(key, timestamps);

    res.setHeader('X-RateLimit-Limit', maxReqs);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxReqs - timestamps.length));

    if (timestamps.length > maxReqs) {
      return res.status(429).json({ error: message });
    }

    next();
  };
}

// Global: 100 req / 15 min
const globalLimiter = rateLimit(15 * 60 * 1000, 100);

// Auth: 10 req / 15 min (brute-force protection)
const authLimiter = rateLimit(15 * 60 * 1000, 10, 'Too many auth attempts');

// Analyze: 20 req / hour (AI endpoint)
const analyzeLimiter = rateLimit(60 * 60 * 1000, 20, 'Analysis rate limit reached');

// Clean up old entries every 10 minutes
setInterval(() => {
  const cutoff = Date.now() - 60 * 60 * 1000;
  for (const [key, timestamps] of rateLimitStore) {
    const filtered = timestamps.filter(t => t > cutoff);
    if (filtered.length === 0) rateLimitStore.delete(key);
    else rateLimitStore.set(key, filtered);
  }
}, 10 * 60 * 1000);


// ═══════════════════════════════════════════════════════════
//  BRUTE-FORCE LOGIN PROTECTION — progressive lockout
// ═══════════════════════════════════════════════════════════

const loginAttemptStore = new Map();

const BRUTE_FORCE_CONFIG = {
  maxAttempts: 5,            // lock after 5 failed attempts
  lockoutMs: 15 * 60 * 1000, // 15-minute lockout
  windowMs: 30 * 60 * 1000,  // 30-minute tracking window
};

/**
 * Track a failed login attempt for the given key (email or IP).
 * Returns { locked, remainingMs } if the account is currently locked out.
 */
function recordFailedLogin(key) {
  const now = Date.now();
  const entry = loginAttemptStore.get(key) || { attempts: [], lockedUntil: 0 };

  // Still locked?
  if (entry.lockedUntil > now) {
    return { locked: true, remainingMs: entry.lockedUntil - now };
  }

  // Purge old attempts outside the window
  entry.attempts = entry.attempts.filter(t => t > now - BRUTE_FORCE_CONFIG.windowMs);
  entry.attempts.push(now);

  if (entry.attempts.length >= BRUTE_FORCE_CONFIG.maxAttempts) {
    entry.lockedUntil = now + BRUTE_FORCE_CONFIG.lockoutMs;
    entry.attempts = []; // reset counter
    loginAttemptStore.set(key, entry);
    return { locked: true, remainingMs: BRUTE_FORCE_CONFIG.lockoutMs };
  }

  loginAttemptStore.set(key, entry);
  return { locked: false, attemptsLeft: BRUTE_FORCE_CONFIG.maxAttempts - entry.attempts.length };
}

/** Clear failed attempts on successful login. */
function clearFailedLogins(key) {
  loginAttemptStore.delete(key);
}

/**
 * Middleware: check brute-force lockout before login handler runs.
 * Uses both IP and email (from body) as lock keys.
 */
function bruteForceGuard(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const email = (req.body?.email || '').toLowerCase().trim();

  // Check IP-based lockout
  const ipEntry = loginAttemptStore.get(`ip:${ip}`);
  if (ipEntry && ipEntry.lockedUntil > Date.now()) {
    const retryAfter = Math.ceil((ipEntry.lockedUntil - Date.now()) / 1000);
    res.setHeader('Retry-After', retryAfter);
    return res.status(429).json({
      error: 'Too many failed login attempts. Please try again later.',
      retryAfterSeconds: retryAfter,
    });
  }

  // Check email-based lockout
  if (email) {
    const emailEntry = loginAttemptStore.get(`email:${email}`);
    if (emailEntry && emailEntry.lockedUntil > Date.now()) {
      const retryAfter = Math.ceil((emailEntry.lockedUntil - Date.now()) / 1000);
      res.setHeader('Retry-After', retryAfter);
      return res.status(429).json({
        error: 'This account is temporarily locked due to too many failed attempts.',
        retryAfterSeconds: retryAfter,
      });
    }
  }

  next();
}

// Clean up old lockout entries every 15 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of loginAttemptStore) {
    if (entry.lockedUntil < now && entry.attempts.length === 0) {
      loginAttemptStore.delete(key);
    }
  }
}, 15 * 60 * 1000);


// ═══════════════════════════════════════════════════════════
//  INPUT SANITIZATION — XSS + NoSQL injection prevention
// ═══════════════════════════════════════════════════════════

/** Sanitize a string: strip HTML tags, null bytes, control chars, trim */
function sanitize(input) {
  if (typeof input !== 'string') return '';
  return input
    .replace(/\0/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/<[^>]*>/g, '')
    .trim();
}

/**
 * HTML-encode dangerous characters to prevent XSS in responses.
 * Use this when reflecting user input back in API responses.
 */
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;', '/': '&#x2F;' };
  return str.replace(/[&<>"'/]/g, (ch) => map[ch]);
}

/**
 * Strip MongoDB/NoSQL operators from an object recursively.
 * Any key starting with "$" or containing "." is removed.
 * This prevents attacks like { email: { $gt: "" } }.
 */
function stripNoSQLOperators(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  // Arrays: recurse each element
  if (Array.isArray(obj)) {
    return obj.map(item => stripNoSQLOperators(item));
  }

  // Objects: strip dangerous keys, recurse values
  const cleaned = {};
  for (const [key, value] of Object.entries(obj)) {
    // Block keys starting with $ (MongoDB operators)
    if (key.startsWith('$')) continue;
    // Block keys containing . (field path traversal)
    if (key.includes('.')) continue;

    cleaned[key] = typeof value === 'object' ? stripNoSQLOperators(value) : value;
  }
  return cleaned;
}

/**
 * Middleware: sanitize all incoming request bodies, query params, and URL params.
 * Strips NoSQL operators, sanitizes strings, blocks prototype pollution.
 */
function sanitizeInput(req, res, next) {
  // Sanitize body
  if (req.body && typeof req.body === 'object') {
    req.body = stripNoSQLOperators(req.body);
  }

  // Sanitize query parameters
  if (req.query && typeof req.query === 'object') {
    req.query = stripNoSQLOperators(req.query);
  }

  // Sanitize URL params
  if (req.params && typeof req.params === 'object') {
    for (const key of Object.keys(req.params)) {
      if (typeof req.params[key] === 'string') {
        req.params[key] = sanitize(req.params[key]);
      }
    }
  }

  // Block prototype pollution via __proto__, constructor, prototype keys
  if (req.body) {
    const dangerous = ['__proto__', 'constructor', 'prototype'];
    const bodyStr = JSON.stringify(req.body);
    for (const key of dangerous) {
      if (bodyStr.includes(`"${key}"`)) {
        return res.status(400).json({ error: 'Malicious input detected' });
      }
    }
  }

  next();
}

/**
 * Validate email format.
 * Uses a practical regex — not RFC-complete, but good enough for real emails.
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

/**
 * Middleware: validate request body fields.
 * @param {Object} schema — { fieldName: { type, required, minLength, maxLength, pattern } }
 */
function validateBody(schema) {
  return (req, res, next) => {
    const errors = [];

    for (const [field, rules] of Object.entries(schema)) {
      const value = req.body[field];

      if (rules.required && (value === undefined || value === null || value === '')) {
        errors.push({ field, message: `${field} is required` });
        continue;
      }

      if (value === undefined || value === null) continue;

      if (rules.type === 'string' && typeof value !== 'string') {
        errors.push({ field, message: `${field} must be a string` });
      } else if (rules.type === 'number' && typeof value !== 'number') {
        errors.push({ field, message: `${field} must be a number` });
      }

      if (typeof value === 'string') {
        if (rules.minLength && value.length < rules.minLength) {
          errors.push({ field, message: `${field} must be at least ${rules.minLength} characters` });
        }
        if (rules.maxLength && value.length > rules.maxLength) {
          errors.push({ field, message: `${field} must be at most ${rules.maxLength} characters` });
        }
        if (rules.pattern && !rules.pattern.test(value)) {
          errors.push({ field, message: `${field} format is invalid` });
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }

    // Sanitize all string fields
    for (const key of Object.keys(req.body)) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitize(req.body[key]);
      }
    }

    next();
  };
}


// ═══════════════════════════════════════════════════════════
//  ENCRYPTION — AES-256-GCM for sensitive data at rest
// ═══════════════════════════════════════════════════════════

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

/**
 * Encrypt a UTF-8 string using AES-256-GCM.
 * Returns { ciphertext, iv, tag } all base64-encoded.
 */
function encrypt(plaintext, masterKeyB64) {
  const key = Buffer.from(masterKeyB64, 'base64');
  if (key.length !== 32) throw new Error('Master key must be 32 bytes');

  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv, { authTagLength: TAG_LEN });
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    ciphertext: enc.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  };
}

/**
 * Decrypt an AES-256-GCM encrypted blob back to UTF-8 string.
 */
function decrypt(blob, masterKeyB64) {
  const key = Buffer.from(masterKeyB64, 'base64');
  const iv = Buffer.from(blob.iv, 'base64');
  const tag = Buffer.from(blob.tag, 'base64');
  const decipher = crypto.createDecipheriv(ALGO, key, iv, { authTagLength: TAG_LEN });
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([
    decipher.update(Buffer.from(blob.ciphertext, 'base64')),
    decipher.final(),
  ]);
  return plain.toString('utf8');
}


// ═══════════════════════════════════════════════════════════
//  HELMET CONFIGURATION — hardened Content Security Policy
// ═══════════════════════════════════════════════════════════

/**
 * Returns a hardened Helmet configuration object.
 * Configures CSP, HSTS, and other HTTP security headers.
 */
function helmetConfig() {
  return {
    // Content Security Policy — restrict where resources load from
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],   // needed for some CSS frameworks
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    // Strict Transport Security — force HTTPS
    hsts: {
      maxAge: 31536000,         // 1 year
      includeSubDomains: true,
      preload: true,
    },
    // Prevent MIME sniffing
    noSniff: true,
    // Prevent clickjacking
    frameguard: { action: 'deny' },
    // Disable X-Powered-By
    hidePoweredBy: true,
    // Referrer Policy
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    // Cross-Origin policies
    crossOriginEmbedderPolicy: false,  // disable if embedding external resources
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-origin' },
  };
}


// ═══════════════════════════════════════════════════════════
//  CORS CONFIGURATION — strict origin control
// ═══════════════════════════════════════════════════════════

/**
 * Returns a strict CORS options object.
 * Only allows requests from the configured client URL.
 */
function corsConfig() {
  const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:3000')
    .split(',')
    .map(o => o.trim());

  return {
    origin: (origin, callback) => {
      // Allow requests with no origin (server-to-server, curl, Postman)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      callback(new Error(`CORS: origin ${origin} is not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'Retry-After'],
    maxAge: 600, // cache preflight for 10 minutes
    optionsSuccessStatus: 204,
  };
}


// ═══════════════════════════════════════════════════════════
//  SECURITY HEADERS — additional beyond Helmet
// ═══════════════════════════════════════════════════════════

function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '0'); // Modern browsers don't need this; CSP is better
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  // Remove server fingerprint
  res.removeHeader('X-Powered-By');
  next();
}


// ═══════════════════════════════════════════════════════════
//  REQUEST SIZE & TYPE GUARDS
// ═══════════════════════════════════════════════════════════

/**
 * Middleware: reject unexpected Content-Types to prevent content-type confusion attacks.
 * Only allows JSON and form-urlencoded for non-GET requests.
 */
function enforceContentType(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS', 'DELETE'].includes(req.method)) {
    return next();
  }

  const contentType = req.headers['content-type'] || '';
  const allowed = [
    'application/json',
    'application/x-www-form-urlencoded',
    'multipart/form-data',
  ];

  if (!allowed.some(type => contentType.startsWith(type))) {
    return res.status(415).json({
      error: `Unsupported Content-Type: ${contentType || '(none)'}`,
    });
  }

  next();
}


module.exports = {
  // Rate limiting
  rateLimit,
  globalLimiter,
  authLimiter,
  analyzeLimiter,

  // Brute-force protection
  bruteForceGuard,
  recordFailedLogin,
  clearFailedLogins,

  // Input sanitization & validation
  sanitize,
  escapeHtml,
  stripNoSQLOperators,
  sanitizeInput,
  isValidEmail,
  validateBody,

  // Encryption
  encrypt,
  decrypt,

  // Security configs
  helmetConfig,
  corsConfig,
  securityHeaders,
  enforceContentType,
};
