import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import analyzeRouter from './routes/analyze.js';

const app = express();

// ── Security ────────────────────────────────────────────
app.use(helmet());
app.use(cors());

// ── Body parsing ────────────────────────────────────────
app.use(express.json({ limit: '500kb' }));

// ── Request timeout (35s — slightly above OpenAI's 30s) ─
app.use((req, res, next) => {
  const timeout = parseInt(process.env.OPENAI_TIMEOUT_MS || '30000', 10) + 5000;
  res.setTimeout(timeout, () => {
    if (!res.headersSent) {
      res.status(504).json({ success: false, error: 'Request timed out' });
    }
  });
  next();
});

// ── Routes ──────────────────────────────────────────────
app.use('/api/analyze', analyzeRouter);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'subscription-analyzer',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    openai_configured: !!process.env.OPENAI_API_KEY,
  });
});

// ── 404 ─────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Not found' });
});

// ── Error handler ───────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('[server] Unhandled:', err.message);

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, error: 'Invalid JSON in request body' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ success: false, error: 'Request body too large (max 500KB)' });
  }

  res.status(500).json({ success: false, error: 'Internal server error' });
});

// ── Start ───────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '3000', 10);
app.listen(PORT, () => {
  console.log(`🔍 Subscription Analyzer API → http://localhost:${PORT}`);
  console.log(`   POST http://localhost:${PORT}/api/analyze`);
  console.log(`   GET  http://localhost:${PORT}/api/health`);
  console.log(`   OpenAI: ${process.env.OPENAI_API_KEY ? '✅ configured' : '❌ missing OPENAI_API_KEY'}`);
});
