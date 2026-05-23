const express = require('express');
const { authenticate } = require('../middleware/auth');
const {
  requireFeature,
  requirePlan,
  requireLimit,
  requireTransactionLimit,
} = require('../middleware/planGuard');
const { analyzeLimiter } = require('../middleware/security');
const { parseCSV, CSVParseError } = require('../utils/csvParser');

const router = express.Router();
router.use(authenticate);

const SYSTEM_PROMPT = `You are a financial analysis AI. You receive raw transaction data (CSV format) and produce a structured JSON analysis.

Rules:
- Identify recurring subscriptions by detecting repeated merchants with similar amounts
- Flag duplicate or overlapping subscriptions (e.g., two music streaming services)
- Calculate potential annual savings if duplicates/unused subscriptions are canceled
- Categorize each subscription (streaming, music, cloud, fitness, food, software, other)
- Be conservative — only flag clear patterns, not one-time purchases

Respond ONLY with valid JSON matching this exact schema:
{
  "subscriptions": [
    {
      "name": "Service Name",
      "category": "streaming|music|cloud|fitness|food|software|other",
      "amount": 15.99,
      "currency": "USD",
      "frequency": "monthly|yearly|weekly",
      "confidence": 0.95,
      "firstSeen": "2026-01-05",
      "lastSeen": "2026-04-05",
      "occurrences": 4
    }
  ],
  "duplicates": [
    {
      "services": ["Spotify", "Apple Music"],
      "category": "music",
      "combinedMonthlyCost": 19.98,
      "suggestion": "Consider keeping only one music streaming service"
    }
  ],
  "savings": {
    "monthly": 19.98,
    "yearly": 239.76,
    "actionItems": [
      {
        "action": "Cancel Apple Music",
        "monthlySaving": 10.99,
        "priority": "high",
        "reason": "Duplicate music streaming — you already have Spotify"
      }
    ]
  },
  "summary": {
    "totalSubscriptions": 5,
    "totalMonthlyCost": 65.94,
    "totalYearlyCost": 791.28,
    "duplicateCount": 1,
    "riskLevel": "medium"
  }
}`;

const ADVANCED_PROMPT = `You are an expert financial advisor AI. Perform a deep analysis of the user's transactions.

In addition to standard subscription detection, you MUST also provide:
- Spending trend analysis (month-over-month changes)
- Category-level breakdown with percentages
- Personalized budget recommendations
- Predicted next-month spending
- Risk scoring per subscription (unused likelihood)

Respond ONLY with valid JSON matching this schema:
{
  "subscriptions": [...],
  "duplicates": [...],
  "savings": { ... },
  "summary": { ... },
  "trends": {
    "monthlyBreakdown": [
      { "month": "2026-01", "total": 85.97 },
      { "month": "2026-02", "total": 92.96 }
    ],
    "direction": "increasing|decreasing|stable",
    "percentChange": 8.1
  },
  "categoryBreakdown": [
    { "category": "streaming", "amount": 22.99, "percentage": 25.3 }
  ],
  "predictions": {
    "nextMonthEstimate": 95.50,
    "confidence": 0.82,
    "factors": ["Netflix price increase expected", "New Hulu trial ending"]
  },
  "budgetRecommendations": [
    {
      "category": "streaming",
      "currentSpend": 38.97,
      "recommendedBudget": 22.99,
      "suggestion": "Consider consolidating to one streaming service"
    }
  ]
}`;


// ═══════════════════════════════════════════════════════════
//  POST /api/analyze — Basic AI analysis
//  Gate: basicAnalysis feature + daily limit + transaction limit
//  Plans: free (3/day, 50 txns), premium (20/day, 500), pro (∞)
// ═══════════════════════════════════════════════════════════

router.post(
  '/',
  requireFeature('basicAnalysis'),
  requireLimit('maxAnalysesPerDay', 'analyses'),
  requireTransactionLimit(),
  analyzeLimiter,
  async (req, res) => {
    await handleAnalysis(req, res, SYSTEM_PROMPT, 'gpt-4o-mini');
  }
);


// ═══════════════════════════════════════════════════════════
//  POST /api/analyze/advanced — Advanced AI analysis
//  Gate: premium plan + advancedAnalysis feature + limits
//  Plans: pro only
// ═══════════════════════════════════════════════════════════

router.post(
  '/advanced',
  requirePlan('pro'),
  requireFeature('advancedAnalysis'),
  requireLimit('maxAnalysesPerDay', 'analyses'),
  requireTransactionLimit(),
  analyzeLimiter,
  async (req, res) => {
    await handleAnalysis(req, res, ADVANCED_PROMPT, 'gpt-4o');
  }
);


// ═══════════════════════════════════════════════════════════
//  POST /api/analyze/duplicates — Duplicate detection only
//  Gate: premium plan + duplicateDetection feature
// ═══════════════════════════════════════════════════════════

router.post(
  '/duplicates',
  requirePlan('premium'),
  requireFeature('duplicateDetection'),
  requireLimit('maxAnalysesPerDay', 'analyses'),
  requireTransactionLimit(),
  analyzeLimiter,
  async (req, res) => {
    const dupePrompt = `You are a subscription duplicate detector. Analyze the transactions and find ONLY duplicate/overlapping subscriptions.
Respond ONLY with valid JSON: { "duplicates": [...], "potentialSavings": { "monthly": 0, "yearly": 0 } }`;

    await handleAnalysis(req, res, dupePrompt, 'gpt-4o-mini');
  }
);


// ═══════════════════════════════════════════════════════════
//  POST /api/analyze/savings — Savings report
//  Gate: premium plan + savingsReport feature
// ═══════════════════════════════════════════════════════════

router.post(
  '/savings',
  requirePlan('premium'),
  requireFeature('savingsReport'),
  requireLimit('maxAnalysesPerDay', 'analyses'),
  requireTransactionLimit(),
  analyzeLimiter,
  async (req, res) => {
    const savingsPrompt = `You are a savings optimization AI. Analyze the transactions and produce a detailed savings action plan.
Respond ONLY with valid JSON: { "actionItems": [{ "action": "", "monthlySaving": 0, "priority": "high|medium|low", "reason": "" }], "totalMonthlySavings": 0, "totalYearlySavings": 0 }`;

    await handleAnalysis(req, res, savingsPrompt, 'gpt-4o-mini');
  }
);


// ═══════════════════════════════════════════════════════════
//  SHARED ANALYSIS HANDLER
// ═══════════════════════════════════════════════════════════

async function handleAnalysis(req, res, systemPrompt, model) {
  try {
    const { transactions } = req.body;

    // ── Accept CSV string or pre-parsed JSON array ──────────
    let csvForAI;

    if (typeof transactions === 'string') {
      if (transactions.trim().length < 10) {
        return res.status(400).json({
          error: 'Please provide transaction data as a CSV string in the "transactions" field',
          example: {
            transactions: "date,description,amount\n2026-01-05,Netflix,-15.99\n2026-01-10,Spotify Premium,-9.99"
          }
        });
      }

      if (transactions.length > 50000) {
        return res.status(400).json({ error: 'Transaction data too large. Maximum 50,000 characters.' });
      }

      // Pre-validate CSV
      try {
        const parsed = parseCSV(transactions, { strict: false });
        if (parsed.transactions.length === 0) {
          return res.status(422).json({ error: 'No valid transactions found in CSV data' });
        }
      } catch (err) {
        if (err instanceof CSVParseError) {
          return res.status(422).json({ error: err.message, code: err.code });
        }
      }

      csvForAI = transactions;

    } else if (Array.isArray(transactions)) {
      if (transactions.length === 0) {
        return res.status(400).json({ error: 'Transactions array is empty' });
      }

      csvForAI = 'date,description,amount\n' +
        transactions.map(t => `${t.date},"${(t.description || '').replace(/"/g, '""')}",${t.amount}`).join('\n');

    } else {
      return res.status(400).json({
        error: 'The "transactions" field must be a CSV string or an array of { date, description, amount }',
      });
    }

    // ── Call OpenAI API ──────────────────────────────────────
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: 'AI analysis service is not configured' });
    }

    const selectedModel = process.env.OPENAI_MODEL || model;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Analyze these transactions:\n\n${csvForAI}`
          },
        ],
        temperature: 0.1,
        max_tokens: 4000,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('OpenAI API error:', response.status, errBody);

      if (response.status === 429) {
        return res.status(429).json({ error: 'AI rate limit reached. Please try again in a moment.' });
      }
      if (response.status === 401) {
        return res.status(503).json({ error: 'AI service authentication failed' });
      }
      return res.status(502).json({ error: 'AI analysis service unavailable' });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return res.status(502).json({ error: 'AI returned empty response' });
    }

    let analysis;
    try {
      analysis = JSON.parse(content);
    } catch {
      console.error('Failed to parse AI response:', content);
      return res.status(502).json({ error: 'AI returned invalid JSON' });
    }

    res.json({
      success: true,
      analysis,
      meta: {
        model: data.model,
        tokens: data.usage,
        plan: req.userPlan,
        usage: req.usageCount ? `${req.usageCount}/${req.usageLimit === Infinity ? '∞' : req.usageLimit}` : undefined,
        analyzedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('Analysis error:', err);

    if (err.name === 'AbortError' || err.code === 'ETIMEDOUT') {
      return res.status(504).json({ error: 'AI analysis timed out. Please try again.' });
    }

    res.status(500).json({ error: 'Analysis failed unexpectedly' });
  }
}


module.exports = router;
