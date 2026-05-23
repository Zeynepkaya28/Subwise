const mongoose = require('mongoose');

// ── Transaction sub-schema ──────────────────────────────────
const transactionSchema = new mongoose.Schema(
  {
    date: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: 'USD',
      uppercase: true,
    },
  },
  { _id: false } // no separate _id for sub-documents
);

// ── Analysis Schema ─────────────────────────────────────────
const analysisSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'userId is required'],
      index: true,
    },
    transactions: {
      type: [transactionSchema],
      validate: {
        validator: (arr) => arr.length > 0,
        message: 'At least one transaction is required',
      },
    },
    result: {
      type: mongoose.Schema.Types.Mixed, // flexible JSON result from AI
      required: [true, 'Analysis result is required'],
    },
    model: {
      type: String,
      default: null, // AI model used (e.g. gpt-4o-mini)
    },
    tokensUsed: {
      promptTokens: { type: Number, default: 0 },
      completionTokens: { type: Number, default: 0 },
      totalTokens: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true, // adds createdAt & updatedAt
  }
);

// ── Indexes ─────────────────────────────────────────────────
// Fast lookup: all analyses for a user, newest first
analysisSchema.index({ userId: 1, createdAt: -1 });

// ── Static: save a full analysis result ─────────────────────
analysisSchema.statics.saveAnalysis = async function ({
  userId,
  transactions,
  result,
  model,
  tokensUsed,
}) {
  return this.create({
    userId,
    transactions,
    result,
    model: model || null,
    tokensUsed: tokensUsed || {},
  });
};

// ── Static: query user history (paginated) ──────────────────
analysisSchema.statics.getUserHistory = async function (
  userId,
  { page = 1, limit = 10 } = {}
) {
  const skip = (page - 1) * limit;

  const [analyses, total] = await Promise.all([
    this.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    this.countDocuments({ userId }),
  ]);

  return {
    analyses,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// ── Static: get single analysis by id (with ownership check) ─
analysisSchema.statics.getByIdForUser = async function (analysisId, userId) {
  return this.findOne({
    _id: analysisId,
    userId,
  }).lean();
};

const Analysis = mongoose.model('Analysis', analysisSchema);

module.exports = Analysis;
