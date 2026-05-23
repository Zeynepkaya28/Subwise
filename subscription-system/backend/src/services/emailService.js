const nodemailer = require('nodemailer');

// ═══════════════════════════════════════════════════════════
//  TRANSPORTER SETUP
// ═══════════════════════════════════════════════════════════

/**
 * Create and cache the nodemailer transporter.
 * Supports SMTP (production) and Ethereal (development/testing).
 */
let transporter = null;

async function getTransporter() {
  if (transporter) return transporter;

  // Production: use real SMTP credentials from env
  if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',     // true for 465, false for 587
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      pool: true,                  // reuse connections
      maxConnections: 5,
      maxMessages: 100,
      rateDelta: 1000,             // 1 second between messages
      rateLimit: 5,                // max 5 messages per rateDelta
    });

    // Verify connection on first use
    try {
      await transporter.verify();
      console.log('✅ SMTP connection verified');
    } catch (err) {
      console.error('❌ SMTP connection failed:', err.message);
      transporter = null;
      throw new Error('Email service is not available');
    }

    return transporter;
  }

  // Development: use Ethereal fake SMTP (emails are captured, not sent)
  const testAccount = await nodemailer.createTestAccount();
  transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });

  console.log('📧 Ethereal test account created:', testAccount.user);
  console.log('   View sent emails at: https://ethereal.email/login');

  return transporter;
}


// ═══════════════════════════════════════════════════════════
//  CORE: sendEmail
// ═══════════════════════════════════════════════════════════

/**
 * Send an email to a user.
 *
 * @param {string} userEmail  — recipient email address
 * @param {string} subject    — email subject line
 * @param {string} message    — plain text or HTML message body
 * @param {Object} [options]  — optional overrides
 * @param {string} [options.from]      — sender address override
 * @param {string} [options.html]      — HTML body (if provided, `message` becomes plain text fallback)
 * @param {Array}  [options.attachments] — nodemailer attachment array
 * @returns {Promise<{ messageId, previewUrl }>}
 */
async function sendEmail(userEmail, subject, message, options = {}) {
  if (!userEmail || !subject || !message) {
    throw new Error('sendEmail requires userEmail, subject, and message');
  }

  const transport = await getTransporter();

  const from = options.from || process.env.EMAIL_FROM || 'SubSaver AI <noreply@subsaver.app>';

  const mailOptions = {
    from,
    to: userEmail,
    subject,
    text: message,
  };

  // If HTML provided, use it; otherwise wrap plain text in the base template
  if (options.html) {
    mailOptions.html = options.html;
  }

  if (options.attachments) {
    mailOptions.attachments = options.attachments;
  }

  try {
    const info = await transport.sendMail(mailOptions);

    // In dev (Ethereal), generate a preview URL
    const previewUrl = nodemailer.getTestMessageUrl(info) || null;

    if (previewUrl) {
      console.log(`📧 Preview email: ${previewUrl}`);
    }

    return {
      messageId: info.messageId,
      previewUrl,
      accepted: info.accepted,
    };
  } catch (err) {
    console.error(`❌ Failed to send email to ${userEmail}:`, err.message);
    throw new Error('Email delivery failed');
  }
}


// ═══════════════════════════════════════════════════════════
//  HTML EMAIL TEMPLATES
// ═══════════════════════════════════════════════════════════

/**
 * Base HTML wrapper with consistent styling.
 */
function baseTemplate(title, bodyContent) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0; padding:0; background-color:#0f172a; font-family:'Segoe UI',Roboto,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a; padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#1e293b; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.3);">
          
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6,#a855f7); padding:32px 40px; text-align:center;">
              <h1 style="margin:0; color:#ffffff; font-size:24px; font-weight:700; letter-spacing:-0.5px;">
                💰 SubSaver AI
              </h1>
              <p style="margin:8px 0 0; color:rgba(255,255,255,0.85); font-size:14px;">
                Smart Subscription Management
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 40px; color:#e2e8f0; font-size:15px; line-height:1.7;">
              ${bodyContent}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px; background-color:#0f172a; border-top:1px solid #334155; text-align:center;">
              <p style="margin:0; color:#64748b; font-size:12px;">
                © ${new Date().getFullYear()} SubSaver AI — You received this because you're subscribed to alerts.
              </p>
              <p style="margin:8px 0 0; color:#64748b; font-size:12px;">
                <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/settings" style="color:#818cf8; text-decoration:none;">Manage Preferences</a>
                &nbsp;·&nbsp;
                <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/unsubscribe" style="color:#818cf8; text-decoration:none;">Unsubscribe</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}


// ═══════════════════════════════════════════════════════════
//  SUBSCRIPTION ALERT EMAIL
// ═══════════════════════════════════════════════════════════

/**
 * Send a subscription alert email.
 *
 * @param {string} userEmail
 * @param {Object} alert
 * @param {string} alert.serviceName    — e.g. "Netflix"
 * @param {number} alert.amount         — e.g. 15.99
 * @param {string} alert.currency       — e.g. "USD"
 * @param {string} alert.renewalDate    — e.g. "2026-05-15"
 * @param {string} alert.alertType      — "renewal" | "price_increase" | "duplicate" | "trial_ending"
 * @param {string} [alert.suggestion]   — optional action suggestion
 */
async function sendSubscriptionAlert(userEmail, alert) {
  const {
    serviceName,
    amount,
    currency = 'USD',
    renewalDate,
    alertType,
    suggestion,
  } = alert;

  const alertLabels = {
    renewal:        { icon: '🔄', title: 'Upcoming Renewal', color: '#3b82f6' },
    price_increase: { icon: '📈', title: 'Price Increase Detected', color: '#ef4444' },
    duplicate:      { icon: '⚠️', title: 'Duplicate Subscription', color: '#f59e0b' },
    trial_ending:   { icon: '⏰', title: 'Free Trial Ending Soon', color: '#f97316' },
  };

  const label = alertLabels[alertType] || alertLabels.renewal;

  const bodyContent = `
    <div style="background-color:${label.color}15; border:1px solid ${label.color}40; border-radius:12px; padding:20px; margin-bottom:24px;">
      <h2 style="margin:0 0 8px; color:${label.color}; font-size:18px;">
        ${label.icon} ${label.title}
      </h2>
      <p style="margin:0; color:#cbd5e1; font-size:14px;">
        We detected an important update for one of your subscriptions.
      </p>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td style="padding:12px 0; border-bottom:1px solid #334155; color:#94a3b8; width:140px;">Service</td>
        <td style="padding:12px 0; border-bottom:1px solid #334155; color:#f1f5f9; font-weight:600;">${serviceName}</td>
      </tr>
      <tr>
        <td style="padding:12px 0; border-bottom:1px solid #334155; color:#94a3b8;">Amount</td>
        <td style="padding:12px 0; border-bottom:1px solid #334155; color:#f1f5f9; font-weight:600;">${currency} ${amount.toFixed(2)}</td>
      </tr>
      <tr>
        <td style="padding:12px 0; border-bottom:1px solid #334155; color:#94a3b8;">Date</td>
        <td style="padding:12px 0; border-bottom:1px solid #334155; color:#f1f5f9;">${renewalDate}</td>
      </tr>
      <tr>
        <td style="padding:12px 0; color:#94a3b8;">Type</td>
        <td style="padding:12px 0; color:${label.color}; font-weight:600;">${label.title}</td>
      </tr>
    </table>

    ${suggestion ? `
    <div style="background-color:#1e3a5f; border-left:4px solid #3b82f6; padding:16px 20px; border-radius:0 8px 8px 0; margin-bottom:24px;">
      <p style="margin:0; color:#93c5fd; font-size:13px; font-weight:600;">💡 Suggestion</p>
      <p style="margin:8px 0 0; color:#e2e8f0; font-size:14px;">${suggestion}</p>
    </div>
    ` : ''}

    <div style="text-align:center; margin-top:32px;">
      <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard"
         style="display:inline-block; background:linear-gradient(135deg,#6366f1,#8b5cf6); color:#fff; text-decoration:none; padding:14px 32px; border-radius:8px; font-weight:600; font-size:14px;">
        View Dashboard →
      </a>
    </div>`;

  const subject = `${label.icon} ${label.title}: ${serviceName} — ${currency} ${amount.toFixed(2)}`;
  const plainText = `${label.title}: ${serviceName}\nAmount: ${currency} ${amount.toFixed(2)}\nDate: ${renewalDate}\n${suggestion ? `\nSuggestion: ${suggestion}` : ''}`;

  return sendEmail(userEmail, subject, plainText, {
    html: baseTemplate(label.title, bodyContent),
  });
}


// ═══════════════════════════════════════════════════════════
//  MONTHLY REPORT EMAIL
// ═══════════════════════════════════════════════════════════

/**
 * Send a monthly subscription report email.
 *
 * @param {string} userEmail
 * @param {Object} report
 * @param {string}   report.month             — e.g. "May 2026"
 * @param {number}   report.totalMonthlyCost  — e.g. 65.94
 * @param {number}   report.totalYearlyCost   — e.g. 791.28
 * @param {number}   report.subscriptionCount — e.g. 5
 * @param {number}   report.duplicateCount    — e.g. 1
 * @param {number}   report.potentialSavings  — e.g. 131.88
 * @param {string}   report.currency          — e.g. "USD"
 * @param {Array}    report.topSubscriptions  — [{ name, amount }]
 * @param {Array}    [report.actionItems]     — [{ action, saving }]
 */
async function sendMonthlyReport(userEmail, report) {
  const {
    month,
    totalMonthlyCost,
    totalYearlyCost,
    subscriptionCount,
    duplicateCount = 0,
    potentialSavings = 0,
    currency = 'USD',
    topSubscriptions = [],
    actionItems = [],
  } = report;

  // Stat cards
  const statCard = (label, value, color) => `
    <td style="width:33%; padding:16px; text-align:center; background-color:#0f172a; border-radius:12px;">
      <p style="margin:0; color:#64748b; font-size:11px; text-transform:uppercase; letter-spacing:1px;">${label}</p>
      <p style="margin:8px 0 0; color:${color}; font-size:22px; font-weight:700;">${value}</p>
    </td>`;

  // Top subscriptions list
  const subsRows = topSubscriptions.slice(0, 5).map((sub, i) => `
    <tr>
      <td style="padding:10px 0; border-bottom:1px solid #334155; color:#94a3b8; width:30px;">${i + 1}.</td>
      <td style="padding:10px 0; border-bottom:1px solid #334155; color:#f1f5f9;">${sub.name}</td>
      <td style="padding:10px 0; border-bottom:1px solid #334155; color:#f1f5f9; text-align:right; font-weight:600;">${currency} ${sub.amount.toFixed(2)}</td>
    </tr>`).join('');

  // Action items list
  const actionRows = actionItems.slice(0, 5).map(item => `
    <tr>
      <td style="padding:10px 16px; border-bottom:1px solid #334155;">
        <p style="margin:0; color:#f1f5f9; font-size:14px;">✂️ ${item.action}</p>
        <p style="margin:4px 0 0; color:#4ade80; font-size:13px; font-weight:600;">Save ${currency} ${item.saving.toFixed(2)}/mo</p>
      </td>
    </tr>`).join('');

  const bodyContent = `
    <h2 style="margin:0 0 8px; color:#f1f5f9; font-size:20px;">📊 Monthly Report — ${month}</h2>
    <p style="margin:0 0 24px; color:#94a3b8; font-size:14px;">
      Here's your subscription spending summary for ${month}.
    </p>

    <!-- Stat Cards -->
    <table width="100%" cellpadding="0" cellspacing="8" style="margin-bottom:28px;">
      <tr>
        ${statCard('Monthly', `${currency} ${totalMonthlyCost.toFixed(2)}`, '#60a5fa')}
        ${statCard('Yearly', `${currency} ${totalYearlyCost.toFixed(2)}`, '#a78bfa')}
        ${statCard('Active', `${subscriptionCount}`, '#34d399')}
      </tr>
    </table>

    ${duplicateCount > 0 ? `
    <div style="background-color:#7f1d1d20; border:1px solid #ef444440; border-radius:12px; padding:16px 20px; margin-bottom:24px;">
      <p style="margin:0; color:#fca5a5; font-size:14px;">
        ⚠️ <strong>${duplicateCount} duplicate(s)</strong> detected — you could save up to 
        <strong style="color:#4ade80;">${currency} ${potentialSavings.toFixed(2)}/year</strong>
      </p>
    </div>
    ` : `
    <div style="background-color:#064e3b20; border:1px solid #10b98140; border-radius:12px; padding:16px 20px; margin-bottom:24px;">
      <p style="margin:0; color:#6ee7b7; font-size:14px;">
        ✅ No duplicate subscriptions found — your spending looks clean!
      </p>
    </div>
    `}

    ${topSubscriptions.length > 0 ? `
    <h3 style="margin:0 0 12px; color:#e2e8f0; font-size:16px;">Top Subscriptions</h3>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      ${subsRows}
    </table>
    ` : ''}

    ${actionItems.length > 0 ? `
    <h3 style="margin:0 0 12px; color:#e2e8f0; font-size:16px;">💡 Recommended Actions</h3>
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a; border-radius:12px; overflow:hidden; margin-bottom:28px;">
      ${actionRows}
    </table>
    ` : ''}

    <div style="text-align:center; margin-top:32px;">
      <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard"
         style="display:inline-block; background:linear-gradient(135deg,#6366f1,#8b5cf6); color:#fff; text-decoration:none; padding:14px 32px; border-radius:8px; font-weight:600; font-size:14px;">
        View Full Report →
      </a>
    </div>`;

  const subject = `📊 Your ${month} Subscription Report — ${currency} ${totalMonthlyCost.toFixed(2)}/mo`;

  const plainText = [
    `Monthly Subscription Report — ${month}`,
    ``,
    `Monthly Cost:  ${currency} ${totalMonthlyCost.toFixed(2)}`,
    `Yearly Cost:   ${currency} ${totalYearlyCost.toFixed(2)}`,
    `Subscriptions: ${subscriptionCount}`,
    `Duplicates:    ${duplicateCount}`,
    potentialSavings > 0 ? `Potential Savings: ${currency} ${potentialSavings.toFixed(2)}/year` : '',
    ``,
    topSubscriptions.length > 0 ? 'Top Subscriptions:' : '',
    ...topSubscriptions.slice(0, 5).map((s, i) => `  ${i + 1}. ${s.name} — ${currency} ${s.amount.toFixed(2)}`),
    ``,
    actionItems.length > 0 ? 'Recommended Actions:' : '',
    ...actionItems.slice(0, 5).map(a => `  • ${a.action} (save ${currency} ${a.saving.toFixed(2)}/mo)`),
  ].filter(Boolean).join('\n');

  return sendEmail(userEmail, subject, plainText, {
    html: baseTemplate(`Monthly Report — ${month}`, bodyContent),
  });
}


// ═══════════════════════════════════════════════════════════
//  WELCOME EMAIL
// ═══════════════════════════════════════════════════════════

/**
 * Send a welcome email after registration.
 *
 * @param {string} userEmail
 * @param {string} [userName]
 */
async function sendWelcomeEmail(userEmail, userName = '') {
  const greeting = userName ? `Hi ${userName}` : 'Welcome';

  const bodyContent = `
    <h2 style="margin:0 0 16px; color:#f1f5f9; font-size:20px;">
      🎉 ${greeting}!
    </h2>
    <p style="margin:0 0 16px; color:#cbd5e1;">
      Thanks for joining <strong>SubSaver AI</strong>. We'll help you track your subscriptions,
      find duplicates, and save money every month.
    </p>

    <h3 style="margin:24px 0 12px; color:#e2e8f0; font-size:16px;">Getting Started</h3>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:12px 0; border-bottom:1px solid #334155; color:#e2e8f0;">
          <strong style="color:#818cf8;">1.</strong>&nbsp; Upload your bank CSV or paste transaction data
        </td>
      </tr>
      <tr>
        <td style="padding:12px 0; border-bottom:1px solid #334155; color:#e2e8f0;">
          <strong style="color:#818cf8;">2.</strong>&nbsp; Our AI detects subscriptions and duplicates
        </td>
      </tr>
      <tr>
        <td style="padding:12px 0; color:#e2e8f0;">
          <strong style="color:#818cf8;">3.</strong>&nbsp; Get actionable savings recommendations
        </td>
      </tr>
    </table>

    <div style="text-align:center; margin-top:32px;">
      <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard"
         style="display:inline-block; background:linear-gradient(135deg,#6366f1,#8b5cf6); color:#fff; text-decoration:none; padding:14px 32px; border-radius:8px; font-weight:600; font-size:14px;">
        Go to Dashboard →
      </a>
    </div>`;

  const subject = '🎉 Welcome to SubSaver AI — Start Saving Today';
  const plainText = `${greeting}!\n\nThanks for joining SubSaver AI.\n\n1. Upload your bank CSV\n2. Our AI detects subscriptions\n3. Get savings recommendations\n\nVisit your dashboard to get started.`;

  return sendEmail(userEmail, subject, plainText, {
    html: baseTemplate('Welcome', bodyContent),
  });
}


module.exports = {
  sendEmail,
  sendSubscriptionAlert,
  sendMonthlyReport,
  sendWelcomeEmail,
  getTransporter,
};
