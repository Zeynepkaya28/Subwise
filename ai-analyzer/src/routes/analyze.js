import { Router } from 'express';
import { validateTransactions } from '../utils/validate.js';
import { analyzeTransactions, mapOpenAIError } from '../services/aiService.js';

const router = Router();

/**
 * POST /api/analyze
 *
 * AI-powered subscription analysis endpoint.
 * Accepts a JSON array of bank transactions, sends to OpenAI,
 * and returns structured subscription detection results.
 *
 * ────────────────────────────────────────────────────────────
 * EXAMPLE REQUEST:
 *
 *   POST /api/analyze
 *   Content-Type: application/json
 *
 *   {
 *     "transactions": [
 *       { "date": "2026-01-05", "description": "Netflix",         "amount": -15.99 },
 *       { "date": "2026-02-05", "description": "Netflix",         "amount": -15.99 },
 *       { "date": "2026-03-05", "description": "Netflix",         "amount": -15.99 },
 *       { "date": "2026-01-10", "description": "Spotify Premium", "amount": -9.99  },
 *       { "date": "2026-02-10", "description": "Spotify Premium", "amount": -9.99  },
 *       { "date": "2026-03-10", "description": "Apple Music",     "amount": -10.99 },
 *       { "date": "2026-01-15", "description": "Adobe CC",        "amount": -54.99 },
 *       { "date": "2026-02-15", "description": "Adobe CC",        "amount": -54.99 }
 *     ]
 *   }
 *
 * ────────────────────────────────────────────────────────────
 * EXAMPLE RESPONSE (200 OK):
 *
 *   {
 *     "success": true,
 *     "subscriptions": [
 *       {
 *         "name": "Netflix",
 *         "category": "streaming",
 *         "amount": 15.99,
 *         "currency": "USD",
 *         "frequency": "monthly",
 *         "confidence": 0.98,
 *         "first_seen": "2026-01-05",
 *         "last_seen": "2026-03-05",
 *         "occurrences": 3,
 *         "status": "active"
 *       },
 *       {
 *         "name": "Spotify Premium",
 *         "category": "music",
 *         "amount": 9.99,
 *         "currency": "USD",
 *         "frequency": "monthly",
 *         "confidence": 0.95,
 *         "first_seen": "2026-01-10",
 *         "last_seen": "2026-02-10",
 *         "occurrences": 2,
 *         "status": "active"
 *       },
 *       {
 *         "name": "Adobe Creative Cloud",
 *         "category": "software",
 *         "amount": 54.99,
 *         "currency": "USD",
 *         "frequency": "monthly",
 *         "confidence": 0.95,
 *         "first_seen": "2026-01-15",
 *         "last_seen": "2026-02-15",
 *         "occurrences": 2,
 *         "status": "active"
 *       }
 *     ],
 *     "duplicates": [
 *       {
 *         "services": ["Spotify Premium", "Apple Music"],
 *         "category": "music",
 *         "combined_monthly_cost": 20.98,
 *         "recommendation": "Keep one music service — cancel Apple Music to save $10.99/mo"
 *       }
 *     ],
 *     "savings_opportunities": [
 *       {
 *         "action": "Cancel Apple Music",
 *         "monthly_saving": 10.99,
 *         "yearly_saving": 131.88,
 *         "priority": "high",
 *         "reason": "Duplicate music streaming — you already have Spotify Premium"
 *       }
 *     ],
 *     "insights": "You have 3 active subscriptions totaling $80.97/month ($971.64/year). Canceling the duplicate music service would save you $131.88 annually.",
 *     "_meta": {
 *       "model": "gpt-4o-mini",
 *       "usage": { "prompt_tokens": 420, "completion_tokens": 380, "total_tokens": 800 },
 *       "analyzed_at": "2026-05-09T00:40:00.000Z",
 *       "transaction_count": 8
 *     }
 *   }
 *
 * ────────────────────────────────────────────────────────────
 * ERROR RESPONSES:
 *
 *   400 — Invalid input (validation failed)
 *   429 — AI rate limit / too many requests
 *   502 — AI service error (invalid response)
 *   503 — AI service unavailable (auth/quota)
 *   504 — AI analysis timed out
 */
router.post('/', async (req, res) => {
  // 1. Validate input
  const validation = validateTransactions(req.body);

  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      error: validation.error,
      details: validation.details || undefined,
      example: validation.example || undefined,
    });
  }

  // 2. Check API key is configured
  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({
      success: false,
      error: 'AI analysis service is not configured',
      code: 'NOT_CONFIGURED',
    });
  }

  // 3. Call AI service
  try {
    const result = await analyzeTransactions(validation.data);

    // 4. Return structured analysis
    res.json({
      success: true,
      subscriptions: result.analysis.subscriptions,
      duplicates: result.analysis.duplicates,
      savings_opportunities: result.analysis.savings_opportunities,
      insights: result.analysis.insights,
      _meta: {
        ...result.meta,
        ...(validation.skipped > 0 && {
          skipped_transactions: validation.skipped,
        }),
        ...(validation.warnings && {
          warnings: validation.warnings,
        }),
      },
    });
  } catch (err) {
    console.error('[analyze] AI error:', err.message || err);
    const mapped = mapOpenAIError(err);
    res.status(mapped.status).json({
      success: false,
      error: mapped.error,
      code: mapped.code,
    });
  }
});

export default router;
