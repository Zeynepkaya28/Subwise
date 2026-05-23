/**
 * Input validation utilities for the subscription analyzer API.
 */

const MAX_TRANSACTIONS = 2000;
const MAX_DESCRIPTION_LENGTH = 256;

/**
 * Validates and sanitizes the transactions array from the request body.
 *
 * @param {Object} body — raw request body
 * @returns {{ valid: true, data: Array, warnings?: string[], skipped: number }
 *         | { valid: false, error: string, details?: string[] }}
 */
export function validateTransactions(body) {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object' };
  }

  const { transactions } = body;

  if (transactions === undefined || transactions === null) {
    return {
      valid: false,
      error: 'Missing required field: "transactions"',
      example: {
        transactions: [
          { date: '2026-01-01', description: 'Netflix', amount: -15.99 },
        ],
      },
    };
  }

  if (!Array.isArray(transactions)) {
    return { valid: false, error: '"transactions" must be an array' };
  }

  if (transactions.length === 0) {
    return { valid: false, error: '"transactions" array must not be empty' };
  }

  if (transactions.length > MAX_TRANSACTIONS) {
    return {
      valid: false,
      error: `"transactions" array exceeds maximum of ${MAX_TRANSACTIONS} items (got ${transactions.length})`,
    };
  }

  const errors = [];
  const sanitized = [];

  for (let i = 0; i < transactions.length; i++) {
    const t = transactions[i];

    if (!t || typeof t !== 'object' || Array.isArray(t)) {
      errors.push(`transactions[${i}]: must be an object`);
      continue;
    }

    // date — required, YYYY-MM-DD format
    if (!t.date || typeof t.date !== 'string') {
      errors.push(`transactions[${i}].date: required string`);
      continue;
    }
    const dateStr = t.date.trim();
    if (!/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      errors.push(`transactions[${i}].date: must be YYYY-MM-DD format (got "${dateStr}")`);
      continue;
    }
    // Validate the date is a real date
    const parsed = new Date(dateStr.slice(0, 10));
    if (isNaN(parsed.getTime())) {
      errors.push(`transactions[${i}].date: invalid date "${dateStr}"`);
      continue;
    }

    // description — required, non-empty string
    if (!t.description || typeof t.description !== 'string') {
      errors.push(`transactions[${i}].description: required string`);
      continue;
    }
    const desc = sanitizeString(t.description);
    if (desc.length === 0) {
      errors.push(`transactions[${i}].description: empty after sanitization`);
      continue;
    }

    // amount — required, finite number
    if (t.amount === undefined || t.amount === null || typeof t.amount !== 'number') {
      errors.push(`transactions[${i}].amount: required number`);
      continue;
    }
    if (!Number.isFinite(t.amount)) {
      errors.push(`transactions[${i}].amount: must be a finite number`);
      continue;
    }

    sanitized.push({
      date: dateStr.slice(0, 10),
      description: desc.slice(0, MAX_DESCRIPTION_LENGTH),
      amount: Math.round(t.amount * 100) / 100, // 2 decimal precision
    });
  }

  if (errors.length > 0 && sanitized.length === 0) {
    return {
      valid: false,
      error: 'All transactions failed validation',
      details: errors.slice(0, 20), // cap error details
    };
  }

  return {
    valid: true,
    data: sanitized,
    warnings: errors.length > 0 ? errors.slice(0, 20) : undefined,
    skipped: errors.length,
  };
}

/**
 * Validate a single transaction object (for unit testing).
 */
export function isValidTransaction(t) {
  if (!t || typeof t !== 'object') return false;
  if (typeof t.date !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(t.date)) return false;
  if (typeof t.description !== 'string' || t.description.trim().length === 0) return false;
  if (typeof t.amount !== 'number' || !Number.isFinite(t.amount)) return false;
  return true;
}

/**
 * Strip HTML tags, null bytes, control characters.
 */
function sanitizeString(input) {
  return input
    .replace(/\0/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/<[^>]*>/g, '')
    .trim();
}
