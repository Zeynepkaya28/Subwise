require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const connectMongoDB = require('./config/mongodb');

const authRoutes = require('./routes/auth');
const subscriptionRoutes = require('./routes/subscription');
const webhookRoutes = require('./routes/webhook');
const analyzeRoutes = require('./routes/analyze');
const uploadRoutes = require('./routes/upload');
const {
  globalLimiter,
  securityHeaders,
  helmetConfig,
  corsConfig,
  sanitizeInput,
  enforceContentType,
} = require('./middleware/security');

const app = express();

// ── 1. Security headers (Helmet with hardened CSP + custom) ─
app.use(helmet(helmetConfig()));
app.use(securityHeaders);

// ── 2. CORS — strict origin validation ─────────────────────
app.use(cors(corsConfig()));

// ── 3. Global rate limiter (100 req / 15 min per IP) ────────
app.use(globalLimiter);

// ── 4. Stripe webhook needs raw body — mount BEFORE json ────
app.use('/api/webhook', express.raw({ type: 'application/json' }), webhookRoutes);

// ── 5. JSON parser with size limit ─────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// ── 6. Content-Type enforcement (reject unexpected types) ───
app.use(enforceContentType);

// ── 7. Global input sanitization (NoSQL injection + XSS) ────
app.use(sanitizeInput);

// ── 8. Routes ──────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/analyze', analyzeRoutes);
app.use('/api/upload', uploadRoutes);

// ── Health check ────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── 404 handler ─────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// ── Global error handler ────────────────────────────────────
app.use((err, req, res, next) => {
  // Handle CORS errors specifically
  if (err.message && err.message.startsWith('CORS:')) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  console.error('Unhandled error:', err.message);
  // Never leak stack traces in production
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message;
  res.status(500).json({ error: message });
});

// ── Start ───────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '4000', 10);

async function start() {
  await connectMongoDB();

  app.listen(PORT, () => {
    console.log(`🚀 Subscription API running on http://localhost:${PORT}`);
    console.log(`   Health:  http://localhost:${PORT}/api/health`);
    console.log(`   Webhook: http://localhost:${PORT}/api/webhook`);
  });
}

start().catch(err => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});
