/**
 * Example Usage — MongoDB Models for Subscription Analyzer
 *
 * Run:  node src/examples/mongo-usage.js
 * Requires: MONGODB_URI in .env (or defaults to localhost:27017)
 */

require('dotenv').config();
const connectMongoDB = require('../config/mongodb');
const { User, Analysis } = require('../models');

async function main() {
  // ── 1. Connect to MongoDB ───────────────────────────────────
  await connectMongoDB();

  // ── 2. Create a user ────────────────────────────────────────
  // Password is auto-hashed via the pre-save hook
  const user = await User.create({
    email: 'demo@example.com',
    password: 'SecurePass123!',
    plan: 'premium',
  });
  console.log('\n📌 Created user:', user.toSafeJSON());

  // ── 3. Verify password comparison ──────────────────────────
  // Must re-fetch with +password since it's excluded by default
  const fetched = await User.findById(user._id).select('+password');
  const isValid = await fetched.comparePassword('SecurePass123!');
  console.log('🔐 Password valid:', isValid); // true

  const isInvalid = await fetched.comparePassword('wrongpassword');
  console.log('🔐 Wrong password:', isInvalid); // false

  // ── 4. Save an analysis result ─────────────────────────────
  const analysis = await Analysis.saveAnalysis({
    userId: user._id,
    transactions: [
      { date: '2026-01-05', description: 'Netflix', amount: -15.99 },
      { date: '2026-01-10', description: 'Spotify Premium', amount: -9.99 },
      { date: '2026-02-05', description: 'Netflix', amount: -15.99 },
      { date: '2026-02-10', description: 'Spotify Premium', amount: -9.99 },
      { date: '2026-03-05', description: 'Netflix', amount: -15.99 },
      { date: '2026-03-10', description: 'Apple Music', amount: -10.99 },
    ],
    result: {
      subscriptions: [
        {
          name: 'Netflix',
          category: 'streaming',
          amount: 15.99,
          currency: 'USD',
          frequency: 'monthly',
          confidence: 0.98,
          firstSeen: '2026-01-05',
          lastSeen: '2026-03-05',
          occurrences: 3,
        },
        {
          name: 'Spotify Premium',
          category: 'music',
          amount: 9.99,
          currency: 'USD',
          frequency: 'monthly',
          confidence: 0.95,
          firstSeen: '2026-01-10',
          lastSeen: '2026-02-10',
          occurrences: 2,
        },
        {
          name: 'Apple Music',
          category: 'music',
          amount: 10.99,
          currency: 'USD',
          frequency: 'monthly',
          confidence: 0.7,
          firstSeen: '2026-03-10',
          lastSeen: '2026-03-10',
          occurrences: 1,
        },
      ],
      duplicates: [
        {
          services: ['Spotify Premium', 'Apple Music'],
          category: 'music',
          combinedMonthlyCost: 20.98,
          suggestion: 'Consider keeping only one music streaming service',
        },
      ],
      savings: {
        monthly: 10.99,
        yearly: 131.88,
        actionItems: [
          {
            action: 'Cancel Apple Music',
            monthlySaving: 10.99,
            priority: 'high',
            reason: 'Duplicate music streaming — you already have Spotify',
          },
        ],
      },
      summary: {
        totalSubscriptions: 3,
        totalMonthlyCost: 36.97,
        totalYearlyCost: 443.64,
        duplicateCount: 1,
        riskLevel: 'medium',
      },
    },
    model: 'gpt-4o-mini',
    tokensUsed: { promptTokens: 320, completionTokens: 540, totalTokens: 860 },
  });
  console.log('\n📊 Saved analysis:', analysis._id);
  console.log('   Transactions count:', analysis.transactions.length);
  console.log('   Subscriptions found:', analysis.result.subscriptions.length);

  // ── 5. Save a second analysis (for pagination demo) ────────
  await Analysis.saveAnalysis({
    userId: user._id,
    transactions: [
      { date: '2026-04-01', description: 'Adobe Creative Cloud', amount: -54.99 },
      { date: '2026-04-05', description: 'Netflix', amount: -15.99 },
    ],
    result: {
      subscriptions: [
        {
          name: 'Adobe Creative Cloud',
          category: 'software',
          amount: 54.99,
          frequency: 'monthly',
          confidence: 0.85,
          occurrences: 1,
        },
      ],
      duplicates: [],
      savings: { monthly: 0, yearly: 0, actionItems: [] },
      summary: {
        totalSubscriptions: 2,
        totalMonthlyCost: 70.98,
        totalYearlyCost: 851.76,
        duplicateCount: 0,
        riskLevel: 'low',
      },
    },
    model: 'gpt-4o-mini',
  });

  // ── 6. Query user history (paginated) ──────────────────────
  const history = await Analysis.getUserHistory(user._id, { page: 1, limit: 5 });
  console.log('\n📜 User history:');
  console.log('   Page:', history.pagination.page, 'of', history.pagination.totalPages);
  console.log('   Total analyses:', history.pagination.total);
  history.analyses.forEach((a, i) => {
    console.log(`   [${i + 1}] ${a._id} — ${a.transactions.length} txns — ${a.createdAt}`);
  });

  // ── 7. Get single analysis by ID (with ownership check) ────
  const single = await Analysis.getByIdForUser(analysis._id, user._id);
  console.log('\n🔍 Single analysis lookup:');
  console.log('   Found:', !!single);
  console.log('   Savings:', single?.result?.savings?.yearly, '/year');

  // ── 8. Cleanup demo data ───────────────────────────────────
  await Analysis.deleteMany({ userId: user._id });
  await User.findByIdAndDelete(user._id);
  console.log('\n🧹 Demo data cleaned up.');

  process.exit(0);
}

main().catch((err) => {
  console.error('Example failed:', err);
  process.exit(1);
});
