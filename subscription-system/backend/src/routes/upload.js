const express = require('express');
const multer = require('multer');
const path = require('path');
const { authenticate } = require('../middleware/auth');
const { analyzeLimiter } = require('../middleware/security');
const { parseCSV, CSVParseError } = require('../utils/csvParser');

const router = express.Router();

// ── Multer configuration ────────────────────────────────────
const storage = multer.memoryStorage(); // keep file in memory (no disk writes)

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,  // 5 MB max
    files: 1,                    // single file only
  },
  fileFilter: (req, file, cb) => {
    // Allow only CSV and plain text MIME types
    const allowedMimes = [
      'text/csv',
      'text/plain',
      'application/csv',
      'application/vnd.ms-excel',         // some browsers send this for .csv
      'application/octet-stream',         // fallback for unknown
    ];

    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.csv' && ext !== '.txt') {
      return cb(new MulterValidationError('Only .csv and .txt files are allowed'));
    }

    if (!allowedMimes.includes(file.mimetype)) {
      return cb(new MulterValidationError(`Unsupported file type: ${file.mimetype}`));
    }

    cb(null, true);
  },
});

/**
 * Custom error for Multer validation failures.
 */
class MulterValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MulterValidationError';
  }
}


// ═══════════════════════════════════════════════════════════
//  POST /api/upload — CSV file upload + parse
// ═══════════════════════════════════════════════════════════

router.post(
  '/',
  authenticate,
  analyzeLimiter,
  handleMulterUpload,
  async (req, res) => {
    try {
      // ── Validate file presence ──────────────────────────────
      if (!req.file) {
        return res.status(400).json({
          error: 'No file uploaded',
          hint: 'Send a CSV file in the "file" field using multipart/form-data',
        });
      }

      // ── Parse CSV ───────────────────────────────────────────
      const result = parseCSV(req.file.buffer, {
        strict: false,
        maxRows: 10000,
      });

      // ── Respond ─────────────────────────────────────────────
      res.json({
        success: true,
        data: result.transactions,
        meta: {
          ...result.meta,
          filename: req.file.originalname,
          fileSize: req.file.size,
        },
        ...(result.skipped.length > 0 && {
          warnings: {
            skippedRows: result.skipped.length,
            details: result.skipped.slice(0, 20), // show first 20 skipped rows
          },
        }),
      });
    } catch (err) {
      if (err instanceof CSVParseError) {
        return res.status(422).json({
          error: err.message,
          code: err.code,
        });
      }
      console.error('Upload parse error:', err);
      res.status(500).json({ error: 'Failed to process uploaded file' });
    }
  }
);


// ═══════════════════════════════════════════════════════════
//  POST /api/upload/text — CSV as raw text in request body
// ═══════════════════════════════════════════════════════════

router.post(
  '/text',
  authenticate,
  analyzeLimiter,
  async (req, res) => {
    try {
      const { csv } = req.body;

      if (!csv || typeof csv !== 'string') {
        return res.status(400).json({
          error: 'Missing "csv" field in request body',
          example: {
            csv: 'date,description,amount\n2026-01-05,Netflix,-15.99\n2026-01-10,Spotify,-9.99',
          },
        });
      }

      if (csv.length > 5 * 1024 * 1024) {
        return res.status(413).json({ error: 'CSV data exceeds 5 MB limit' });
      }

      const result = parseCSV(csv, {
        strict: false,
        maxRows: 10000,
      });

      res.json({
        success: true,
        data: result.transactions,
        meta: result.meta,
        ...(result.skipped.length > 0 && {
          warnings: {
            skippedRows: result.skipped.length,
            details: result.skipped.slice(0, 20),
          },
        }),
      });
    } catch (err) {
      if (err instanceof CSVParseError) {
        return res.status(422).json({
          error: err.message,
          code: err.code,
        });
      }
      console.error('Text parse error:', err);
      res.status(500).json({ error: 'Failed to parse CSV data' });
    }
  }
);


// ═══════════════════════════════════════════════════════════
//  Multer error handler wrapper
// ═══════════════════════════════════════════════════════════

/**
 * Wraps multer's single-file upload and converts Multer errors
 * into clean JSON responses instead of crashing the request.
 */
function handleMulterUpload(req, res, next) {
  const uploader = upload.single('file');

  uploader(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      // Multer-specific errors
      const messages = {
        LIMIT_FILE_SIZE: 'File is too large. Maximum size is 5 MB.',
        LIMIT_FILE_COUNT: 'Only one file can be uploaded at a time.',
        LIMIT_UNEXPECTED_FILE: 'Unexpected field name. Use "file" as the form field.',
      };
      return res.status(400).json({
        error: messages[err.code] || err.message,
        code: err.code,
      });
    }

    if (err instanceof MulterValidationError) {
      return res.status(400).json({ error: err.message });
    }

    if (err) {
      console.error('Upload error:', err);
      return res.status(500).json({ error: 'File upload failed' });
    }

    next();
  });
}


module.exports = router;
