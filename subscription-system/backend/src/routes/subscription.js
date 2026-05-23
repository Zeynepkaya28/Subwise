const express = require('express');
const Stripe = require('stripe');
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');
const { PLANS } = require('../config/plans');

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// All subscription routes require authentication
router.use(authenticate);


// ═══════════════════════════════════════════════════════════
//  GET /api/subscription/plans
//  Public plan listing (behind auth so we can highlight current)
// ═══════════════════════════════════════════════════════════

router.get('/plans', async (req, res) => {
  const user = await User.findById(req.user.id).lean();

  const plans = Object.entries(PLANS).map(([key, plan]) => ({
    id: key,
    name: plan.name,
    price: plan.price,
    description: plan.description,
    features: plan.features,
    limits: {
      ...plan.limits,
      maxTransactions: plan.limits.maxTransactions === Infinity ? 'unlimited' : plan.limits.maxTransactions,
      maxAnalysesPerDay: plan.limits.maxAnalysesPerDay === Infinity ? 'unlimited' : plan.limits.maxAnalysesPerDay,
      maxUploadsPerDay: plan.limits.maxUploadsPerDay === Infinity ? 'unlimited' : plan.limits.maxUploadsPerDay,
    },
    isCurrent: user?.plan === key,
  }));

  res.json({ plans, currentPlan: user?.plan || 'free' });
});


// ═══════════════════════════════════════════════════════════
//  POST /api/subscription/create-checkout
//  Creates a Stripe Checkout session for subscription purchase
// ═══════════════════════════════════════════════════════════

/**
 * Body: { planId: "premium" | "pro" }
 *
 * Returns: { sessionId, url }
 *
 * Flow:
 *   1. Validate plan
 *   2. Create/reuse Stripe customer
 *   3. Check for existing active subscription (→ upgrade instead)
 *   4. Create Checkout session
 *   5. Return session URL for redirect
 */
router.post('/create-checkout', async (req, res) => {
  try {
    const { planId } = req.body;

    // ── Validate plan ─────────────────────────────────────
    if (!planId || !PLANS[planId]) {
      return res.status(400).json({
        error: 'Invalid plan',
        validPlans: Object.keys(PLANS).filter(k => k !== 'free'),
      });
    }
    if (planId === 'free') {
      return res.status(400).json({ error: 'Free plan does not require payment' });
    }

    const plan = PLANS[planId];
    if (!plan.stripePriceId) {
      return res.status(400).json({ error: 'Stripe price not configured for this plan' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // ── Prevent duplicate checkout if already on this plan ─
    if (user.plan === planId && user.subscriptionStatus === 'active') {
      return res.status(400).json({ error: `You are already on the ${plan.name} plan` });
    }

    // ── Create or reuse Stripe customer ──────────────────
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: String(user._id) },
      });
      customerId = customer.id;
      user.stripeCustomerId = customerId;
      await user.save();
    }

    // ── If user has active sub, use Stripe portal for upgrade ─
    if (user.stripeSubscriptionId && user.subscriptionStatus === 'active') {
      // Upgrade/downgrade via prorated swap
      const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
      await stripe.subscriptions.update(user.stripeSubscriptionId, {
        items: [{
          id: subscription.items.data[0].id,
          price: plan.stripePriceId,
        }],
        proration_behavior: 'create_prorations',
      });

      user.plan = planId;
      await user.save();

      return res.json({
        upgraded: true,
        plan: planId,
        message: `Upgraded to ${plan.name} — prorated charges applied`,
      });
    }

    // ── Create new Checkout session ──────────────────────
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{
        price: plan.stripePriceId,
        quantity: 1,
      }],
      success_url: `${process.env.CLIENT_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/pricing`,
      metadata: { userId: String(user._id), planId },
      subscription_data: {
        metadata: { userId: String(user._id), planId },
      },
      allow_promotion_codes: true,
    });

    res.json({ sessionId: session.id, url: session.url });
  } catch (err) {
    console.error('Checkout error:', err);

    // Stripe-specific error handling
    if (err.type === 'StripeCardError') {
      return res.status(400).json({ error: 'Card was declined' });
    }
    if (err.type === 'StripeInvalidRequestError') {
      return res.status(400).json({ error: 'Invalid payment request' });
    }

    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});


// ═══════════════════════════════════════════════════════════
//  GET /api/subscription/status
//  Current subscription details + Stripe live data
// ═══════════════════════════════════════════════════════════

router.get('/status', async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const planConfig = PLANS[user.plan] || PLANS.free;
    const response = {
      plan: user.plan,
      planName: planConfig.name,
      price: planConfig.price,
      status: user.subscriptionStatus,
      features: planConfig.features,
      limits: planConfig.limits,
    };

    // Fetch live data from Stripe if active subscription exists
    if (user.stripeSubscriptionId) {
      try {
        const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
        response.stripe = {
          currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          cancelAt: subscription.cancel_at
            ? new Date(subscription.cancel_at * 1000).toISOString()
            : null,
          trialEnd: subscription.trial_end
            ? new Date(subscription.trial_end * 1000).toISOString()
            : null,
        };
      } catch {
        // Stripe subscription may have been deleted externally
        response.stripe = null;
      }
    }

    res.json(response);
  } catch (err) {
    console.error('Status error:', err);
    res.status(500).json({ error: 'Failed to fetch subscription status' });
  }
});


// ═══════════════════════════════════════════════════════════
//  POST /api/subscription/portal
//  Stripe Customer Portal (manage payment method, invoices)
// ═══════════════════════════════════════════════════════════

router.post('/portal', async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user?.stripeCustomerId) {
      return res.status(400).json({ error: 'No billing account found' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${process.env.CLIENT_URL}/dashboard`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Portal error:', err);
    res.status(500).json({ error: 'Failed to create billing portal session' });
  }
});


// ═══════════════════════════════════════════════════════════
//  POST /api/subscription/cancel
//  Cancel at period end (keeps access until billing cycle ends)
// ═══════════════════════════════════════════════════════════

router.post('/cancel', async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user?.stripeSubscriptionId) {
      return res.status(400).json({ error: 'No active subscription to cancel' });
    }
    if (user.subscriptionStatus === 'canceled') {
      return res.status(400).json({ error: 'Subscription is already canceled' });
    }
    if (user.subscriptionStatus === 'canceling') {
      return res.status(400).json({ error: 'Subscription is already scheduled for cancellation' });
    }

    // Cancel at period end — user keeps access until then
    const subscription = await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    user.subscriptionStatus = 'canceling';
    await user.save();

    const periodEnd = new Date(subscription.current_period_end * 1000).toISOString();

    res.json({
      message: 'Subscription will cancel at end of billing period',
      accessUntil: periodEnd,
    });
  } catch (err) {
    console.error('Cancel error:', err);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});


// ═══════════════════════════════════════════════════════════
//  POST /api/subscription/reactivate
//  Undo a pending cancellation (before period end)
// ═══════════════════════════════════════════════════════════

router.post('/reactivate', async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user?.stripeSubscriptionId) {
      return res.status(400).json({ error: 'No subscription to reactivate' });
    }
    if (user.subscriptionStatus !== 'canceling') {
      return res.status(400).json({ error: 'Subscription is not pending cancellation' });
    }

    // Remove cancel_at_period_end flag
    await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: false,
    });

    user.subscriptionStatus = 'active';
    await user.save();

    res.json({ message: 'Subscription reactivated — cancellation has been undone' });
  } catch (err) {
    console.error('Reactivate error:', err);
    res.status(500).json({ error: 'Failed to reactivate subscription' });
  }
});


module.exports = router;
