/**
 * Example Usage — Email Notification System
 *
 * Run:  node src/examples/email-usage.js
 *
 * Uses Ethereal (fake SMTP) by default — no real emails are sent.
 * Each run prints a preview URL where you can view the email.
 */

require('dotenv').config();
const {
  sendEmail,
  sendSubscriptionAlert,
  sendMonthlyReport,
  sendWelcomeEmail,
} = require('../services/emailService');


async function main() {
  const testEmail = 'user@example.com';

  console.log('═══════════════════════════════════════════');
  console.log('  Email Notification System — Demo');
  console.log('═══════════════════════════════════════════\n');


  // ── 1. Basic sendEmail ──────────────────────────────────────
  console.log('1️⃣  Sending basic email...');
  const basic = await sendEmail(
    testEmail,
    'Test Notification',
    'This is a plain text test email from SubSaver AI.'
  );
  console.log('   Message ID:', basic.messageId);
  console.log('   Preview:', basic.previewUrl || '(production — no preview)');


  // ── 2. Welcome email ───────────────────────────────────────
  console.log('\n2️⃣  Sending welcome email...');
  const welcome = await sendWelcomeEmail(testEmail, 'Zeynep');
  console.log('   Message ID:', welcome.messageId);
  console.log('   Preview:', welcome.previewUrl || '(production — no preview)');


  // ── 3. Subscription alert — renewal ────────────────────────
  console.log('\n3️⃣  Sending renewal alert...');
  const renewal = await sendSubscriptionAlert(testEmail, {
    serviceName: 'Netflix Premium',
    amount: 22.99,
    currency: 'USD',
    renewalDate: '2026-05-15',
    alertType: 'renewal',
  });
  console.log('   Message ID:', renewal.messageId);
  console.log('   Preview:', renewal.previewUrl || '(production — no preview)');


  // ── 4. Subscription alert — duplicate detected ─────────────
  console.log('\n4️⃣  Sending duplicate alert...');
  const duplicate = await sendSubscriptionAlert(testEmail, {
    serviceName: 'Apple Music',
    amount: 10.99,
    currency: 'USD',
    renewalDate: '2026-05-20',
    alertType: 'duplicate',
    suggestion: 'You already have Spotify Premium. Consider canceling one of your music streaming services to save $10.99/month.',
  });
  console.log('   Message ID:', duplicate.messageId);
  console.log('   Preview:', duplicate.previewUrl || '(production — no preview)');


  // ── 5. Subscription alert — price increase ─────────────────
  console.log('\n5️⃣  Sending price increase alert...');
  const priceAlert = await sendSubscriptionAlert(testEmail, {
    serviceName: 'Adobe Creative Cloud',
    amount: 59.99,
    currency: 'USD',
    renewalDate: '2026-06-01',
    alertType: 'price_increase',
    suggestion: 'Adobe increased the price from $54.99 to $59.99/mo. Consider switching to the Photography plan ($9.99/mo) if you only use Photoshop and Lightroom.',
  });
  console.log('   Message ID:', priceAlert.messageId);
  console.log('   Preview:', priceAlert.previewUrl || '(production — no preview)');


  // ── 6. Monthly report ──────────────────────────────────────
  console.log('\n6️⃣  Sending monthly report...');
  const report = await sendMonthlyReport(testEmail, {
    month: 'April 2026',
    totalMonthlyCost: 87.95,
    totalYearlyCost: 1055.40,
    subscriptionCount: 6,
    duplicateCount: 1,
    potentialSavings: 131.88,
    currency: 'USD',
    topSubscriptions: [
      { name: 'Adobe Creative Cloud', amount: 54.99 },
      { name: 'Netflix Premium', amount: 22.99 },
      { name: 'Spotify Premium', amount: 9.99 },
      { name: 'Apple Music', amount: 10.99 },
      { name: 'iCloud+ 200GB', amount: 2.99 },
    ],
    actionItems: [
      { action: 'Cancel Apple Music (duplicate with Spotify)', saving: 10.99 },
      { action: 'Downgrade Netflix Premium to Standard', saving: 7.00 },
    ],
  });
  console.log('   Message ID:', report.messageId);
  console.log('   Preview:', report.previewUrl || '(production — no preview)');


  console.log('\n═══════════════════════════════════════════');
  console.log('  ✅ All emails sent successfully!');
  console.log('  Open the preview URLs above to view them.');
  console.log('═══════════════════════════════════════════\n');

  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Example failed:', err);
  process.exit(1);
});
