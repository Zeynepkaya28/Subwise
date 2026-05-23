// ═══════════════════════════════════════════════════════════
//  CSV Transaction Parser — zero-dependency, robust
// ═══════════════════════════════════════════════════════════

/**
 * Known column name aliases mapped to canonical field names.
 * Supports CSV files from major banks and financial apps.
 */
const COLUMN_ALIASES = {
  // date
  date:             'date',
  transaction_date: 'date',
  transactiondate:  'date',
  trans_date:       'date',
  posting_date:     'date',
  postingdate:      'date',
  posted_date:      'date',
  value_date:       'date',
  tarih:            'date',  // Turkish

  // description
  description:      'description',
  desc:             'description',
  memo:             'description',
  merchant:         'description',
  merchant_name:    'description',
  merchantname:     'description',
  payee:            'description',
  name:             'description',
  narrative:        'description',
  details:          'description',
  transaction:      'description',
  aciklama:         'description',  // Turkish

  // amount
  amount:           'amount',
  amt:              'amount',
  value:            'amount',
  debit:            'amount',
  credit:           'amount',
  transaction_amount: 'amount',
  transactionamount:  'amount',
  tutar:            'amount',  // Turkish
};

/**
 * Parse a single CSV line, respecting quoted fields.
 * Handles: "field with, comma", "field with ""escaped"" quotes"
 */
function parseCsvLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const next = line[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        current += '"';      // escaped quote
        i++;                 // skip next
      } else if (ch === '"') {
        inQuotes = false;    // end of quoted field
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',' || ch === ';' || ch === '\t') {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }

  fields.push(current.trim());
  return fields;
}

/**
 * Detect the column mapping from a header row.
 * Returns: { dateIdx, descIdx, amountIdx } or null if mapping failed.
 */
function detectColumns(headerFields) {
  const mapping = { dateIdx: -1, descIdx: -1, amountIdx: -1 };

  for (let i = 0; i < headerFields.length; i++) {
    const raw = headerFields[i]
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '')  // strip special chars
      .trim();

    const canonical = COLUMN_ALIASES[raw];
    if (canonical === 'date'        && mapping.dateIdx   === -1) mapping.dateIdx   = i;
    if (canonical === 'description' && mapping.descIdx   === -1) mapping.descIdx   = i;
    if (canonical === 'amount'      && mapping.amountIdx === -1) mapping.amountIdx = i;
  }

  // Fall back to positional if we couldn't match all three
  if (mapping.dateIdx === -1 || mapping.descIdx === -1 || mapping.amountIdx === -1) {
    if (headerFields.length >= 3) {
      // Assume: date, description, amount (most common layout)
      return { dateIdx: 0, descIdx: 1, amountIdx: 2, guessed: true };
    }
    return null;
  }

  return mapping;
}

/**
 * Normalize a date string into ISO 8601 (YYYY-MM-DD).
 * Supports: MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD, DD.MM.YYYY, etc.
 */
function normalizeDate(raw) {
  if (!raw || typeof raw !== 'string') return null;

  const cleaned = raw.trim();

  // Already ISO
  const isoMatch = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return formatDate(y, m, d);
  }

  // Slash-separated: could be MM/DD/YYYY or DD/MM/YYYY
  const slashMatch = cleaned.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (slashMatch) {
    let [, part1, part2, year] = slashMatch;
    if (year.length === 2) year = `20${year}`;

    // Heuristic: if part1 > 12, it's DD/MM/YYYY
    if (parseInt(part1) > 12) {
      return formatDate(year, part2, part1);
    }
    // Default: MM/DD/YYYY (US format)
    return formatDate(year, part1, part2);
  }

  // Try native Date parse as last resort
  const d = new Date(cleaned);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }

  return null;
}

function formatDate(year, month, day) {
  const y = String(year).padStart(4, '0');
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');

  // Basic validation
  const mi = parseInt(m);
  const di = parseInt(d);
  if (mi < 1 || mi > 12 || di < 1 || di > 31) return null;

  return `${y}-${m}-${d}`;
}

/**
 * Normalize an amount string to a number.
 * Handles: -15.99, ($15.99), 15,99 (European), "1,234.56", currency symbols.
 */
function normalizeAmount(raw) {
  if (typeof raw === 'number') return raw;
  if (!raw || typeof raw !== 'string') return null;

  let cleaned = raw.trim();

  // Detect negative via parentheses: (15.99) → -15.99
  const isParenNeg = /^\(.*\)$/.test(cleaned);
  if (isParenNeg) {
    cleaned = cleaned.slice(1, -1);
  }

  // Strip currency symbols and whitespace
  cleaned = cleaned.replace(/[£€$₺¥₹\s]/g, '');

  // Detect European format: 1.234,56 → 1234.56
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(cleaned)) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  }
  // Simple European decimal: 15,99 → 15.99
  else if (/^\-?\d+,\d{1,2}$/.test(cleaned)) {
    cleaned = cleaned.replace(',', '.');
  }
  // US thousands: 1,234.56 → 1234.56
  else {
    cleaned = cleaned.replace(/,/g, '');
  }

  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;

  return isParenNeg ? -Math.abs(num) : num;
}

/**
 * Normalize a description string.
 * Strips excess whitespace, control characters, and normalizes casing.
 */
function normalizeDescription(raw) {
  if (!raw || typeof raw !== 'string') return '';
  return raw
    .replace(/[\x00-\x1F\x7F]/g, '')    // strip control chars
    .replace(/\s+/g, ' ')               // collapse whitespace
    .trim();
}

/**
 * Parse CSV content (string or Buffer) into clean transaction JSON.
 *
 * @param {string|Buffer} input — raw CSV content
 * @param {Object}        [options]
 * @param {boolean}       [options.strict=false]     — throw on any invalid row
 * @param {number}        [options.maxRows=10000]    — safety cap
 * @param {boolean}       [options.skipHeader=true]  — auto-detect and skip header
 * @returns {{ transactions, skipped, meta }}
 */
function parseCSV(input, options = {}) {
  const {
    strict = false,
    maxRows = 10000,
    skipHeader = true,
  } = options;

  if (!input) {
    throw new CSVParseError('No CSV data provided', 'EMPTY_INPUT');
  }

  // Convert Buffer to string
  const content = Buffer.isBuffer(input) ? input.toString('utf-8') : input;

  if (typeof content !== 'string' || content.trim().length === 0) {
    throw new CSVParseError('CSV content is empty', 'EMPTY_INPUT');
  }

  // Split into lines, normalize line endings
  const rawLines = content
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter(line => line.trim().length > 0);

  if (rawLines.length === 0) {
    throw new CSVParseError('CSV file contains no data rows', 'NO_ROWS');
  }

  // Detect columns from header row
  const headerFields = parseCsvLine(rawLines[0]);
  const columnMap = detectColumns(headerFields);

  if (!columnMap) {
    throw new CSVParseError(
      'Could not detect required columns (date, description, amount). ' +
      'Ensure the CSV header contains recognizable column names.',
      'INVALID_HEADER'
    );
  }

  const startIdx = skipHeader ? 1 : 0;
  const transactions = [];
  const skipped = [];

  for (let i = startIdx; i < rawLines.length; i++) {
    if (transactions.length >= maxRows) {
      skipped.push({
        line: i + 1,
        content: rawLines[i].slice(0, 100),
        reason: `Max row limit (${maxRows}) reached`,
      });
      break;
    }

    const fields = parseCsvLine(rawLines[i]);

    // Not enough columns
    if (fields.length < 3) {
      const err = {
        line: i + 1,
        content: rawLines[i].slice(0, 100),
        reason: `Expected at least 3 columns, got ${fields.length}`,
      };
      if (strict) throw new CSVParseError(`Row ${i + 1}: ${err.reason}`, 'INVALID_ROW');
      skipped.push(err);
      continue;
    }

    const rawDate = fields[columnMap.dateIdx];
    const rawDesc = fields[columnMap.descIdx];
    const rawAmount = fields[columnMap.amountIdx];

    // Parse & validate date
    const date = normalizeDate(rawDate);
    if (!date) {
      const err = {
        line: i + 1,
        content: rawLines[i].slice(0, 100),
        reason: `Invalid date: "${rawDate}"`,
      };
      if (strict) throw new CSVParseError(`Row ${i + 1}: ${err.reason}`, 'INVALID_DATE');
      skipped.push(err);
      continue;
    }

    // Parse & validate amount
    const amount = normalizeAmount(rawAmount);
    if (amount === null) {
      const err = {
        line: i + 1,
        content: rawLines[i].slice(0, 100),
        reason: `Invalid amount: "${rawAmount}"`,
      };
      if (strict) throw new CSVParseError(`Row ${i + 1}: ${err.reason}`, 'INVALID_AMOUNT');
      skipped.push(err);
      continue;
    }

    // Parse description
    const description = normalizeDescription(rawDesc);
    if (!description) {
      const err = {
        line: i + 1,
        content: rawLines[i].slice(0, 100),
        reason: 'Empty description',
      };
      if (strict) throw new CSVParseError(`Row ${i + 1}: ${err.reason}`, 'EMPTY_DESC');
      skipped.push(err);
      continue;
    }

    transactions.push({ date, description, amount });
  }

  if (transactions.length === 0) {
    throw new CSVParseError(
      `No valid transactions found. ${skipped.length} row(s) were skipped.`,
      'NO_VALID_ROWS'
    );
  }

  return {
    transactions,
    skipped,
    meta: {
      totalRows: rawLines.length - (skipHeader ? 1 : 0),
      validRows: transactions.length,
      skippedRows: skipped.length,
      columnsDetected: columnMap.guessed ? 'positional (guessed)' : 'header-matched',
      parsedAt: new Date().toISOString(),
    },
  };
}


// ═══════════════════════════════════════════════════════════
//  Custom error class for CSV parse failures
// ═══════════════════════════════════════════════════════════

class CSVParseError extends Error {
  constructor(message, code = 'PARSE_ERROR') {
    super(message);
    this.name = 'CSVParseError';
    this.code = code;
  }
}


module.exports = {
  parseCSV,
  CSVParseError,
  // Exported for testing
  parseCsvLine,
  detectColumns,
  normalizeDate,
  normalizeAmount,
  normalizeDescription,
};
