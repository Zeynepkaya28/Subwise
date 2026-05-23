import OpenAI from 'openai';

// ═══════════════════════════════════════════════════════════
//  OpenAI Client Setup
// ═══════════════════════════════════════════════════════════

const TIMEOUT_MS = parseInt(process.env.OPENAI_TIMEOUT_MS || '30000', 10);

let _client = null;

/** Lazy-init — avoids crash when OPENAI_API_KEY is not set at import time */
function getClient() {
  if (!_client) {
    _client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: TIMEOUT_MS,
      maxRetries: 2,
    });
  }
  return _client;
}

// ═══════════════════════════════════════════════════════════
//  System Prompt
// ═══════════════════════════════════════════════════════════

const SYSTEM_PROMPT = `You are an expert financial analyst AI. You receive a JSON array of bank transactions and produce a comprehensive subscription analysis.

ANALYSIS TASKS:
1. SUBSCRIPTIONS: Identify recurring charges by detecting the same or similar merchant appearing multiple times with consistent amounts.
   - Include: name, category, amount (positive), currency, frequency, confidence, first_seen, last_seen, occurrences, status.
   - Only flag patterns with 2+ occurrences — never flag one-time purchases.

2. DUPLICATES: Find overlapping services in the same category (e.g., two music services, two cloud storage plans).
   - Include: the service names, category, combined cost, and a clear recommendation.

3. SAVINGS OPPORTUNITIES: Calculate concrete savings if the user cancels duplicates, downgrades plans, or switches providers.
   - Include: action, monthly_saving, yearly_saving, priority (high/medium/low), reason.
   - Sort by yearly_saving descending.

4. INSIGHTS: Write 2-3 concise sentences summarizing the user's subscription health, total monthly spend, and the most impactful action they can take.

RULES:
- Amounts must be positive numbers (absolute values).
- Confidence: 0.0 to 1.0 based on pattern strength.
- Categories: streaming, music, cloud, fitness, food, software, gaming, news, productivity, other.
- Frequency: monthly, weekly, yearly, quarterly.
- Be conservative — only flag clear patterns with high confidence.
- If no subscriptions are found, return empty arrays and say so in insights.

OUTPUT FORMAT — respond with EXACTLY this JSON structure:
{
  "subscriptions": [
    {
      "name": "Service Name",
      "category": "streaming",
      "amount": 15.99,
      "currency": "USD",
      "frequency": "monthly",
      "confidence": 0.95,
      "first_seen": "2026-01-01",
      "last_seen": "2026-04-01",
      "occurrences": 4,
      "status": "active"
    }
  ],
  "duplicates": [
    {
      "services": ["Service A", "Service B"],
      "category": "music",
      "combined_monthly_cost": 20.98,
      "recommendation": "Consider keeping only one music service"
    }
  ],
  "savings_opportunities": [
    {
      "action": "Cancel Service B",
      "monthly_saving": 10.99,
      "yearly_saving": 131.88,
      "priority": "high",
      "reason": "Duplicate music streaming service"
    }
  ],
  "insights": "You have 5 active subscriptions totaling $65.94/month..."
}`;


// ═══════════════════════════════════════════════════════════
//  Core Analysis Function
// ═══════════════════════════════════════════════════════════

/**
 * Analyze transactions using OpenAI.
 *
 * @param {Array<{date: string, description: string, amount: number}>} transactions
 * @returns {Promise<{analysis: Object, meta: Object}>}
 * @throws {AIServiceError} on AI failures
 */
export async function analyzeTransactions(transactions) {
  // Build an AbortController for timeout safety
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS + 5000);

  try {
    const userMessage = [
      `Analyze these ${transactions.length} bank transactions and identify all recurring subscriptions, duplicates, and savings opportunities:`,
      '',
      JSON.stringify(transactions, null, 2),
    ].join('\n');

    const completion = await getClient().chat.completions.create(
      {
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.1,
        max_tokens: 4096,
        response_format: { type: 'json_object' },
      },
      { signal: controller.signal }
    );

    const content = completion.choices?.[0]?.message?.content;

    if (!content) {
      throw new AIServiceError('AI returned empty response', 'EMPTY_RESPONSE');
    }

    // Parse JSON — guarded against malformed output
    let result;
    try {
      result = JSON.parse(content);
    } catch {
      throw new AIServiceError(
        'AI returned invalid JSON — please retry',
        'INVALID_JSON'
      );
    }

    // Normalize structure — ensure all required fields exist
    result = normalizeResult(result);

    return {
      analysis: result,
      meta: {
        model: completion.model,
        usage: {
          prompt_tokens: completion.usage?.prompt_tokens ?? 0,
          completion_tokens: completion.usage?.completion_tokens ?? 0,
          total_tokens: completion.usage?.total_tokens ?? 0,
        },
        analyzed_at: new Date().toISOString(),
        transaction_count: transactions.length,
      },
    };
  } finally {
    clearTimeout(timeoutId);
  }
}


// ═══════════════════════════════════════════════════════════
//  Result Normalization
// ═══════════════════════════════════════════════════════════

/**
 * Ensures the AI response conforms to the expected schema.
 * Fills missing fields with safe defaults.
 */
function normalizeResult(raw) {
  const result = { ...raw };

  // subscriptions
  if (!Array.isArray(result.subscriptions)) {
    result.subscriptions = [];
  }
  result.subscriptions = result.subscriptions.map(sub => ({
    name: sub.name || 'Unknown',
    category: sub.category || 'other',
    amount: Math.abs(Number(sub.amount) || 0),
    currency: sub.currency || 'USD',
    frequency: sub.frequency || 'monthly',
    confidence: Math.min(1, Math.max(0, Number(sub.confidence) || 0)),
    first_seen: sub.first_seen || null,
    last_seen: sub.last_seen || null,
    occurrences: parseInt(sub.occurrences) || 0,
    status: sub.status || 'active',
  }));

  // duplicates
  if (!Array.isArray(result.duplicates)) {
    result.duplicates = [];
  }
  result.duplicates = result.duplicates.map(dup => ({
    services: Array.isArray(dup.services) ? dup.services : [],
    category: dup.category || 'other',
    combined_monthly_cost: Math.abs(Number(dup.combined_monthly_cost) || 0),
    recommendation: dup.recommendation || '',
  }));

  // savings_opportunities
  if (!Array.isArray(result.savings_opportunities)) {
    result.savings_opportunities = [];
  }
  result.savings_opportunities = result.savings_opportunities
    .map(sav => ({
      action: sav.action || '',
      monthly_saving: Math.abs(Number(sav.monthly_saving) || 0),
      yearly_saving: Math.abs(Number(sav.yearly_saving) || 0),
      priority: ['high', 'medium', 'low'].includes(sav.priority) ? sav.priority : 'medium',
      reason: sav.reason || '',
    }))
    .sort((a, b) => b.yearly_saving - a.yearly_saving); // highest savings first

  // insights
  if (typeof result.insights !== 'string' || result.insights.trim().length === 0) {
    if (result.subscriptions.length === 0) {
      result.insights = 'No recurring subscriptions were detected in the provided transactions.';
    } else {
      const total = result.subscriptions.reduce((sum, s) => sum + s.amount, 0);
      result.insights = `Found ${result.subscriptions.length} subscription(s) totaling $${total.toFixed(2)}/month.`;
    }
  }

  return result;
}


// ═══════════════════════════════════════════════════════════
//  Error Handling
// ═══════════════════════════════════════════════════════════

/**
 * Custom error class for AI service failures.
 */
export class AIServiceError extends Error {
  constructor(message, code, statusCode = 502) {
    super(message);
    this.name = 'AIServiceError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Maps OpenAI SDK errors to user-friendly HTTP responses.
 *
 * @param {Error} err
 * @returns {{ status: number, error: string, code: string }}
 */
export function mapOpenAIError(err) {
  // Our own errors
  if (err instanceof AIServiceError) {
    return { status: err.statusCode, error: err.message, code: err.code };
  }

  // AbortController timeout
  if (err.name === 'AbortError') {
    return {
      status: 504,
      error: 'AI analysis timed out. Try with fewer transactions.',
      code: 'TIMEOUT',
    };
  }

  // OpenAI SDK error codes
  const status = err?.status || err?.response?.status;

  if (status === 401) {
    return { status: 503, error: 'AI service authentication failed', code: 'AUTH_FAILED' };
  }
  if (status === 429) {
    return { status: 429, error: 'AI rate limit reached. Please try again in a moment.', code: 'RATE_LIMITED' };
  }
  if (status === 500 || status === 503) {
    return { status: 502, error: 'AI service temporarily unavailable', code: 'SERVICE_DOWN' };
  }

  // Network errors
  if (err?.code === 'ETIMEDOUT' || err?.code === 'ECONNABORTED' || err?.code === 'ECONNREFUSED') {
    return { status: 504, error: 'AI service connection failed', code: 'NETWORK_ERROR' };
  }

  // Quota errors
  if (err?.code === 'insufficient_quota') {
    return { status: 503, error: 'AI service quota exceeded', code: 'QUOTA_EXCEEDED' };
  }

  // Content filter
  if (err?.code === 'content_filter') {
    return { status: 400, error: 'Request was blocked by content filter', code: 'CONTENT_FILTER' };
  }

  // Unknown
  return { status: 500, error: 'Analysis failed unexpectedly', code: 'UNKNOWN' };
}
