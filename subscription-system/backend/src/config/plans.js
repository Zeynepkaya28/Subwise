/**
 * ═══════════════════════════════════════════════════════════
 *  SUBSCRIPTION PLAN DEFINITIONS
 *  Central config for plan tiers, features, limits, and Stripe IDs.
 * ═══════════════════════════════════════════════════════════
 */

// ── Plan hierarchy (lower index = lower tier) ───────────────
const PLAN_HIERARCHY = ['free', 'premium', 'pro'];

// ── Plan definitions ────────────────────────────────────────
const PLANS = {
  free: {
    name: 'Free',
    tier: 0,
    price: 0,
    stripePriceId: null,
    description: 'Basic subscription tracking',
    features: {
      csvUpload:          true,
      basicAnalysis:      true,
      duplicateDetection: false,
      savingsReport:      false,
      advancedAnalysis:   false,
      bankSync:           false,
      exportPdf:          false,
      exportCsv:          false,
      emailAlerts:        false,
      monthlyReport:      false,
      prioritySupport:    false,
      apiAccess:          false,
      teamMembers:        false,
      customCategories:   false,
    },
    limits: {
      maxTransactions:     50,     // per analysis
      maxAnalysesPerDay:   3,
      maxUploadsPerDay:    5,
      maxHistoryDays:      30,     // query history retention
    },
  },

  premium: {
    name: 'Premium',
    tier: 1,
    price: 5,
    stripePriceId: process.env.STRIPE_PRICE_PREMIUM,
    description: 'Full analysis with savings insights',
    features: {
      csvUpload:          true,
      basicAnalysis:      true,
      duplicateDetection: true,
      savingsReport:      true,
      advancedAnalysis:   false,
      bankSync:           true,
      exportPdf:          false,
      exportCsv:          true,
      emailAlerts:        true,
      monthlyReport:      true,
      prioritySupport:    false,
      apiAccess:          false,
      teamMembers:        false,
      customCategories:   true,
    },
    limits: {
      maxTransactions:     500,
      maxAnalysesPerDay:   20,
      maxUploadsPerDay:    30,
      maxHistoryDays:      365,
    },
  },

  pro: {
    name: 'Pro',
    tier: 2,
    price: 10,
    stripePriceId: process.env.STRIPE_PRICE_PRO,
    description: 'Everything — unlimited access',
    features: {
      csvUpload:          true,
      basicAnalysis:      true,
      duplicateDetection: true,
      savingsReport:      true,
      advancedAnalysis:   true,
      bankSync:           true,
      exportPdf:          true,
      exportCsv:          true,
      emailAlerts:        true,
      monthlyReport:      true,
      prioritySupport:    true,
      apiAccess:          true,
      teamMembers:        true,
      customCategories:   true,
    },
    limits: {
      maxTransactions:     Infinity,
      maxAnalysesPerDay:   Infinity,
      maxUploadsPerDay:    Infinity,
      maxHistoryDays:      Infinity,
    },
  },
};


// ═══════════════════════════════════════════════════════════
//  HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════

/** Resolve plan tier from Stripe price ID */
function planFromPriceId(priceId) {
  for (const [key, plan] of Object.entries(PLANS)) {
    if (plan.stripePriceId === priceId) return key;
  }
  return 'free';
}

/** Get the plan config by name (defaults to free) */
function getPlan(planName) {
  return PLANS[planName] || PLANS.free;
}

/** Get the numeric tier for a plan name */
function getPlanTier(planName) {
  return (PLANS[planName]?.tier) ?? 0;
}

/** Check if planA is at least as high as planB */
function isPlanAtLeast(userPlan, requiredPlan) {
  return getPlanTier(userPlan) >= getPlanTier(requiredPlan);
}

/** Find the cheapest plan that includes a given feature */
function getMinPlanForFeature(featureKey) {
  for (const planName of PLAN_HIERARCHY) {
    if (PLANS[planName]?.features[featureKey]) return planName;
  }
  return 'pro';
}

/** Find the cheapest plan that meets a given limit */
function getMinPlanForLimit(limitKey, requiredValue) {
  for (const planName of PLAN_HIERARCHY) {
    const limit = PLANS[planName]?.limits[limitKey];
    if (limit !== undefined && limit >= requiredValue) return planName;
  }
  return 'pro';
}

/** Check if a feature is enabled for a plan */
function hasFeature(planName, featureKey) {
  return (PLANS[planName]?.features[featureKey]) ?? false;
}

/** Get a limit value for a plan */
function getLimit(planName, limitKey) {
  return (PLANS[planName]?.limits[limitKey]) ?? 0;
}

/** Get all features for a plan as a flat object */
function getPlanFeatures(planName) {
  return { ...(PLANS[planName]?.features || PLANS.free.features) };
}

/** Get all limits for a plan as a flat object */
function getPlanLimits(planName) {
  return { ...(PLANS[planName]?.limits || PLANS.free.limits) };
}


module.exports = {
  PLANS,
  PLAN_HIERARCHY,
  planFromPriceId,
  getPlan,
  getPlanTier,
  isPlanAtLeast,
  getMinPlanForFeature,
  getMinPlanForLimit,
  hasFeature,
  getLimit,
  getPlanFeatures,
  getPlanLimits,
};
