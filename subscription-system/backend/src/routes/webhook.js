const express = require('express');
const Stripe = require('stripe');
const User = require('../models/User');
const { planFromPriceId } = require('../config/plans');
const { sendSubscriptionAlert, sendEmail } = require('../services/emailService');

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ═══════════════════════════════════════════════════════════
//  Idempotency: track processed events to prevent duplicates
//  In production, use Redis or a DB collection instead.
// ═══════════════════════════════════════════════════════════

const processedEvents = new Set();
const MAX_PROCESSED = 10000;

function markProcessed(eventId) {
  processedEvents.add(eventId);
  // Prevent memory leak — evict old entries
  if (processedEvents.size > MAX_PROCESSED) {
    const first = processedEvents.values().next().value;
    processedEvents.delete(first);
  }
}


// ═══════════════════════════════════════════════════════════
//  POST /api/webhook — Stripe Webhook Handler
//
//  CRITICAL: This route receives a RAW body (not JSON-parsed).
//  server.js mounts express.raw() specifically for /api/webhook
//  BEFORE the global express.json() middleware.
//
//  Events handled:
//    ✅ checkout.session.completed  — new subscription activated
//    🔄 customer.subscription.updated — upgrade/downgrade/cancel-pending
//    ❌ customer.subscription.deleted — subscription expired/canceled
//    ⚠️ invoice.payment_failed       — payment method issue
//    💳 invoice.payment_succeeded    — renewal success
//    🎁 customer.subscription.trial_will_end — trial ending soon
// ═══════════════════════════════════════════════════════════

router.post('/', async (req, res) => {
  const sig = req.headers['stripe-signature'];

  // ── 1. Verify webhook signature ────────────────────────
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  // ── 2. Idempotency check ──────────────────────────────
  if (processedEvents.has(event.id)) {
    console.log(`⏭️  Skipping duplicate event: ${event.id}`);
    return res.json({ received: true, duplicate: true });
  }

  // ── 3. Process event ──────────────────────────────────
  try {
    switch (event.type) {

      // ─────────────────────────────────────────────────
      //  CHECKOUT COMPLETED — New subscription activated
      // ─────────────────────────────────────────────────
      case 'checkout.session.completed': {
        const session = event.data.object;

        if (session.mode !== 'subscription') break;

        const userId = session.metadata?.userId;
        if (!userId) {
          console.warn('⚠️ checkout.session.completed missing userId in metadata');
          break;
        }

        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        const priceId = subscription.items.data[0]?.price?.id;
        const plan = planFromPriceId(priceId);

        await User.findByIdAndUpdate(userId, {
          plan,
          stripeSubscriptionId: subscription.id,
          subscriptionStatus: 'active',
        });

        console.log(`✅ User ${userId} subscribed to ${plan}`);

        // Notify user (fire-and-forget)
        const user = await User.findById(userId).lean();
        if (user) {
          const amount = (subscription.items.data[0]?.price?.unit_amount || 0) / 100;
          sendSubscriptionAlert(user.email, {
            serviceName: `SubSaver AI ${plan.charAt(0).toUpperCase() + plan.slice(1)}`,
            amount,
            currency: (subscription.currency || 'usd').toUpperCase(),
            renewalDate: new Date(subscription.current_period_end * 1000).toISOString().split('T')[0],
            alertType: 'renewal',
          }).catch(err => console.error('Subscription alert email failed:', err.message));
        }
        break;
      }

      // ─────────────────────────────────────────────────
      //  SUBSCRIPTION UPDATED — Upgrade / Downgrade / Cancel-pending
      // ─────────────────────────────────────────────────
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        const priceId = subscription.items.data[0]?.price?.id;
        const plan = planFromPriceId(priceId);

        // Determine status: canceling, past_due, or active
        let status;
        if (subscription.cancel_at_period_end) {
          status = 'canceling';
        } else if (subscription.status === 'past_due') {
          status = 'past_due';
        } else if (subscription.status === 'trialing') {
          status = 'trialing';
        } else {
          status = subscription.status; // 'active', etc.
        }

        await User.findOneAndUpdate(
          { stripeCustomerId: customerId },
          { plan, subscriptionStatus: status }
        );

        console.log(`🔄 Subscription updated: customer ${customerId} → ${plan} (${status})`);
        break;
      }

      // ─────────────────────────────────────────────────
      //  SUBSCRIPTION DELETED — Expired or fully canceled
      // ─────────────────────────────────────────────────
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        // Get user info before downgrading (for email)
        const canceledUser = await User.findOne({ stripeCustomerId: customerId }).lean();

        await User.findOneAndUpdate(
          { stripeCustomerId: customerId },
          {
            plan: 'free',
            stripeSubscriptionId: null,
            subscriptionStatus: 'canceled',
          }
        );

        console.log(`❌ Subscription canceled: customer ${customerId} → free`);

        if (canceledUser) {
          sendEmail(
            canceledUser.email,
            '😢 Your SubSaver AI Subscription Has Been Canceled',
            `Your ${canceledUser.plan} plan has been canceled. You've been moved to the free tier. You can resubscribe anytime from your dashboard.`
          ).catch(err => console.error('Cancellation email failed:', err.message));
        }
        break;
      }

      // ─────────────────────────────────────────────────
      //  PAYMENT FAILED — Card declined / expired
      // ─────────────────────────────────────────────────
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const customerId = invoice.customer;

        const failedUser = await User.findOneAndUpdate(
          { stripeCustomerId: customerId },
          { subscriptionStatus: 'past_due' },
          { new: false } // return pre-update doc for the email
        );

        console.warn(`⚠️ Payment failed: customer ${customerId}`);

        if (failedUser) {
          sendEmail(
            failedUser.email,
            '⚠️ Payment Failed — Action Required',
            [
              `Your payment for the SubSaver AI ${failedUser.plan} plan failed.`,
              '',
              'Please update your payment method to avoid losing access:',
              `${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard`,
              '',
              'If this was unexpected, please check with your card issuer.',
            ].join('\n')
          ).catch(err => console.error('Payment failure email failed:', err.message));
        }
        break;
      }

      // ─────────────────────────────────────────────────
      //  PAYMENT SUCCEEDED — Renewal / first payment
      // ─────────────────────────────────────────────────
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        const customerId = invoice.customer;

        // Only process renewal payments (not initial subscription)
        if (invoice.billing_reason === 'subscription_cycle') {
          await User.findOneAndUpdate(
            { stripeCustomerId: customerId },
            { subscriptionStatus: 'active' }
          );
          console.log(`💳 Renewal succeeded: customer ${customerId}`);
        }

        // Re-activate from past_due on any successful payment
        if (invoice.billing_reason === 'subscription_update' || invoice.billing_reason === 'subscription_cycle') {
          await User.findOneAndUpdate(
            { stripeCustomerId: customerId, subscriptionStatus: 'past_due' },
            { subscriptionStatus: 'active' }
          );
        }
        break;
      }

      // ─────────────────────────────────────────────────
      //  TRIAL ENDING — Heads-up email 3 days before
      // ─────────────────────────────────────────────────
      case 'customer.subscription.trial_will_end': {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        const trialUser = await User.findOne({ stripeCustomerId: customerId }).lean();
        if (trialUser) {
          const trialEnd = new Date(subscription.trial_end * 1000).toISOString().split('T')[0];
          sendSubscriptionAlert(trialUser.email, {
            serviceName: `SubSaver AI ${trialUser.plan}`,
            amount: (subscription.items.data[0]?.price?.unit_amount || 0) / 100,
            currency: (subscription.currency || 'usd').toUpperCase(),
            renewalDate: trialEnd,
            alertType: 'trial_ending',
            suggestion: 'Your free trial ends soon. Add a payment method to continue uninterrupted access.',
          }).catch(err => console.error('Trial ending email failed:', err.message));

          console.log(`⏰ Trial ending soon: customer ${customerId} on ${trialEnd}`);
        }
        break;
      }

      // ─────────────────────────────────────────────────
      //  UNHANDLED — Log but acknowledge
      // ─────────────────────────────────────────────────
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Mark as processed for idempotency
    markProcessed(event.id);

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook processing error:', err);
    // Return 500 so Stripe retries the webhook
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});


module.exports = router;
