const express = require('express');
const User = require('../models/User');
const { authenticate, issueToken } = require('../middleware/auth');
const {
  authLimiter,
  bruteForceGuard,
  recordFailedLogin,
  clearFailedLogins,
  sanitize,
  isValidEmail,
} = require('../middleware/security');
const { sendWelcomeEmail } = require('../services/emailService');

const router = express.Router();

// Apply auth-specific rate limiter to all auth routes
router.use(authLimiter);


// ═══════════════════════════════════════════════════════════
//  POST /api/auth/register
// ═══════════════════════════════════════════════════════════

/**
 * Register a new user.
 *
 * Body: { email: string, password: string }
 *
 * Response 201:
 *   { token: "jwt...", user: { id, email, plan } }
 *
 * Errors:
 *   400 — missing fields, invalid format, weak password
 *   409 — email already registered
 *   500 — server error
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    // ── Input validation ──────────────────────────────────
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const cleanEmail = sanitize(email).toLowerCase();
    if (!isValidEmail(cleanEmail)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    if (password.length > 128) {
      return res.status(400).json({ error: 'Password must be at most 128 characters' });
    }

    // ── Duplicate check ──────────────────────────────────
    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // ── Create user (password is hashed by pre-save hook) ─
    const user = await User.create({ email: cleanEmail, password });

    // ── Issue JWT ─────────────────────────────────────────
    const token = issueToken({ id: user._id, email: user.email, plan: user.plan });

    // ── Welcome email (fire-and-forget) ──────────────────
    sendWelcomeEmail(cleanEmail).catch(err =>
      console.error('Welcome email failed:', err.message)
    );

    res.status(201).json({
      token,
      user: { id: user._id, email: user.email, plan: user.plan },
    });
  } catch (err) {
    // Handle Mongoose duplicate key error (race condition)
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});


// ═══════════════════════════════════════════════════════════
//  POST /api/auth/login
// ═══════════════════════════════════════════════════════════

/**
 * Authenticate a user.
 *
 * Body: { email: string, password: string }
 *
 * Response 200:
 *   { token: "jwt...", user: { id, email, plan, subscriptionStatus } }
 *
 * Errors:
 *   400 — missing fields, invalid email
 *   401 — invalid credentials
 *   429 — brute-force lockout
 *   500 — server error
 */
router.post('/login', bruteForceGuard, async (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;

  try {
    const { email, password } = req.body;

    // ── Input validation ──────────────────────────────────
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const cleanEmail = sanitize(email).toLowerCase();
    if (!isValidEmail(cleanEmail)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // ── Find user (include password for comparison) ───────
    const user = await User.findOne({ email: cleanEmail }).select('+password');
    if (!user) {
      recordFailedLogin(`ip:${ip}`);
      recordFailedLogin(`email:${cleanEmail}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // ── Verify password ──────────────────────────────────
    const valid = await user.comparePassword(password);
    if (!valid) {
      const ipResult = recordFailedLogin(`ip:${ip}`);
      const emailResult = recordFailedLogin(`email:${cleanEmail}`);

      // Warn user when close to lockout
      const attemptsLeft = Math.min(
        ipResult.attemptsLeft ?? 0,
        emailResult.attemptsLeft ?? 0
      );

      return res.status(401).json({
        error: 'Invalid credentials',
        ...(attemptsLeft > 0 && attemptsLeft <= 3 && {
          warning: `${attemptsLeft} attempt(s) remaining before temporary lockout`,
        }),
      });
    }

    // ── Successful login — clear lockout records ─────────
    clearFailedLogins(`ip:${ip}`);
    clearFailedLogins(`email:${cleanEmail}`);

    // ── Issue JWT ─────────────────────────────────────────
    const token = issueToken({ id: user._id, email: user.email, plan: user.plan });

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        plan: user.plan,
        subscriptionStatus: user.subscriptionStatus,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});


// ═══════════════════════════════════════════════════════════
//  GET /api/auth/me — Protected route example
// ═══════════════════════════════════════════════════════════

/**
 * Get the currently authenticated user's profile.
 * Requires: Authorization: Bearer <token>
 *
 * Response 200:
 *   { user: { id, email, plan, subscriptionStatus, createdAt, ... } }
 */
router.get('/me', authenticate, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  res.json({ user: user.toSafeJSON() });
});


// ═══════════════════════════════════════════════════════════
//  PUT /api/auth/password — Change password (protected)
// ═══════════════════════════════════════════════════════════

/**
 * Change password for the authenticated user.
 *
 * Body: { currentPassword: string, newPassword: string }
 *
 * Response 200: { message: 'Password updated', token: "new-jwt..." }
 */
router.put('/password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }
    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }
    if (newPassword.length > 128) {
      return res.status(400).json({ error: 'New password must be at most 128 characters' });
    }

    const user = await User.findById(req.user.id).select('+password');
    if (!user) return res.status(404).json({ error: 'User not found' });

    const valid = await user.comparePassword(currentPassword);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    user.password = newPassword; // pre-save hook will hash
    await user.save();

    // Issue a fresh token (old token is still valid until expiry)
    const token = issueToken({ id: user._id, email: user.email, plan: user.plan });

    res.json({ message: 'Password updated', token });
  } catch (err) {
    console.error('Password change error:', err);
    res.status(500).json({ error: 'Password change failed' });
  }
});


module.exports = router;
