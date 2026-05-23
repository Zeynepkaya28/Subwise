const {
  PLANS,
  isPlanAtLeast,
  getMinPlanForFeature,
  getMinPlanForLimit,
  hasFeature,
  getLimit,
  getPlanFeatures,
  getPlanLimits,
} = require('../config/plans');
const User = require('../models/User');

// ═══════════════════════════════════════════════════════════
//  In-memory usage counter (per user, per day)
//  In production, use Redis or a DB table instead.
// ═══════════════════════════════════════════════════════════

const usageStore = new Map();

function getUsageKey(userId, action) {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return `${userId}:${action}:${today}`;
}

function getUsageCount(userId, action) {
  return usageStore.get(getUsageKey(userId, action)) || 0;
}

function incrementUsage(userId, action) {
  const key = getUsageKey(userId, action);
  const current = usageStore.get(key) || 0;
  usageStore.set(key, current + 1);
  return current + 1;
}

// Clean up old entries at midnight (every hour check)
setInterval(() => {
  const today = new Date().toISOString().split('T')[0];
  for (const key of usageStore.keys()) {
    if (!key.includes(today)) {
      usageStore.delete(key);
    }
  }
}, 60 * 60 * 1000);


// ═══════════════════════════════════════════════════════════
//  1. requireFeature(featureKey)
//     Gate: blocks if user's plan doesn't have the feature flag
// ═══════════════════════════════════════════════════════════

function requireFeature(featureKey) {
  return async (req, res, next) => {
    const userPlan = await refreshPlan(req, res);
    if (!userPlan) return;

    if (!hasFeature(userPlan, featureKey)) {
      const minPlan = getMinPlanForFeature(featureKey);
      return res.status(403).json({
        error: 'Feature not available on your plan',
        feature: featureKey,
        currentPlan: userPlan,
        requiredPlan: minPlan,
        upgradeUrl: `${process.env.CLIENT_URL || ''}/pricing`,
      });
    }

    attachPlanInfo(req, userPlan);
    next();
  };
}


// ═══════════════════════════════════════════════════════════
//  2. requirePlan(minimumPlan)
//     Gate: blocks if user's plan tier is below the required level
// ═══════════════════════════════════════════════════════════

function requirePlan(minimumPlan) {
  return async (req, res, next) => {
    const userPlan = await refreshPlan(req, res);
    if (!userPlan) return;

    if (!isPlanAtLeast(userPlan, minimumPlan)) {
      return res.status(403).json({
        error: `This endpoint requires the ${minimumPlan} plan or higher`,
        currentPlan: userPlan,
        requiredPlan: minimumPlan,
        upgradeUrl: `${process.env.CLIENT_URL || ''}/pricing`,
      });
    }

    attachPlanInfo(req, userPlan);
    next();
  };
}


// ═══════════════════════════════════════════════════════════
//  3. requireLimit(limitKey, countAction?)
//     Gate: blocks if user has exceeded a daily usage limit
// ═══════════════════════════════════════════════════════════

function requireLimit(limitKey, countAction) {
  const action = countAction || limitKey;

  return async (req, res, next) => {
    const userPlan = await refreshPlan(req, res);
    if (!userPlan) return;

    const limit = getLimit(userPlan, limitKey);
    const current = getUsageCount(req.user.id, action);

    if (current >= limit) {
      const minPlan = getMinPlanForLimit(limitKey, current + 1);
      return res.status(429).json({
        error: 'Daily usage limit reached',
        limit: limitKey,
        currentUsage: current,
        maxAllowed: limit === Infinity ? 'unlimited' : limit,
        currentPlan: userPlan,
        suggestedPlan: minPlan !== userPlan ? minPlan : undefined,
        upgradeUrl: `${process.env.CLIENT_URL || ''}/pricing`,
      });
    }

    const newCount = incrementUsage(req.user.id, action);
    req.usageCount = newCount;
    req.usageLimit = limit;

    attachPlanInfo(req, userPlan);
    next();
  };
}


// ═══════════════════════════════════════════════════════════
//  4. requireTransactionLimit()
//     Gate: blocks if transactions array exceeds plan's maxTransactions
// ═══════════════════════════════════════════════════════════

function requireTransactionLimit() {
  return async (req, res, next) => {
    const userPlan = await refreshPlan(req, res);
    if (!userPlan) return;

    const limit = getLimit(userPlan, 'maxTransactions');
    const transactions = req.body?.transactions;

    let count = 0;
    if (Array.isArray(transactions)) {
      count = transactions.length;
    } else if (typeof transactions === 'string') {
      count = transactions.split('\n').filter(l => l.trim()).length - 1;
    }

    if (count > limit) {
      return res.status(413).json({
        error: 'Transaction count exceeds your plan limit',
        transactionCount: count,
        maxAllowed: limit === Infinity ? 'unlimited' : limit,
        currentPlan: userPlan,
        suggestedPlan: getMinPlanForLimit('maxTransactions', count),
        upgradeUrl: `${process.env.CLIENT_URL || ''}/pricing`,
      });
    }

    attachPlanInfo(req, userPlan);
    next();
  };
}


// ═══════════════════════════════════════════════════════════
//  5. checkFeatures(...featureKeys)
//     Non-blocking: attaches feature availability to req
// ═══════════════════════════════════════════════════════════

function checkFeatures(...featureKeys) {
  return async (req, res, next) => {
    const userPlan = await refreshPlan(req, res);
    if (!userPlan) return;

    req.availableFeatures = {};
    for (const key of featureKeys) {
      req.availableFeatures[key] = hasFeature(userPlan, key);
    }

    attachPlanInfo(req, userPlan);
    next();
  };
}


// ═══════════════════════════════════════════════════════════
//  INTERNAL HELPERS
// ═══════════════════════════════════════════════════════════

/**
 * Refresh user's plan from MongoDB (don't trust JWT alone — webhook may have updated it).
 * Returns the plan name or null (sends 401 response).
 */
async function refreshPlan(req, res) {
  const user = await User.findById(req.user?.id).select('plan').lean();
  if (!user) {
    res.status(401).json({ error: 'User not found' });
    return null;
  }
  return user.plan || 'free';
}

/**
 * Attach plan info to the request object for downstream handlers.
 */
function attachPlanInfo(req, planName) {
  req.userPlan = planName;
  req.planFeatures = getPlanFeatures(planName);
  req.planLimits = getPlanLimits(planName);
}


module.exports = {
  requireFeature,
  requirePlan,
  requireLimit,
  requireTransactionLimit,
  checkFeatures,
  getUsageCount,
  incrementUsage,
};
