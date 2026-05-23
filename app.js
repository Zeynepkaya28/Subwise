// ===== SAMPLE DATA =====
const SAMPLES = {
  basic: `2026-01-05, Netflix, -15.99
2026-01-10, Spotify Premium, -9.99
2026-01-15, Adobe Creative Cloud, -54.99
2026-01-20, Amazon Prime, -14.99
2026-01-25, iCloud Storage, -2.99
2026-02-05, Netflix, -15.99
2026-02-10, Spotify Premium, -9.99
2026-02-15, Adobe Creative Cloud, -54.99
2026-02-20, Amazon Prime, -14.99
2026-02-25, iCloud Storage, -2.99
2026-03-05, Netflix, -15.99
2026-03-10, Spotify Premium, -9.99`,
  heavy: `2026-01-03, Netflix Premium, -22.99
2026-01-03, Hulu, -17.99
2026-01-05, Disney Plus, -13.99
2026-01-05, HBO Max, -15.99
2026-01-07, Spotify Premium, -10.99
2026-01-07, Apple Music, -10.99
2026-01-10, YouTube Premium, -13.99
2026-01-12, Adobe Creative Cloud, -59.99
2026-01-12, Canva Pro, -12.99
2026-01-15, Dropbox Plus, -11.99
2026-01-15, Google One, -2.99
2026-01-18, NordVPN, -12.99
2026-01-20, ChatGPT Plus, -20.00
2026-01-22, LinkedIn Premium, -29.99
2026-01-25, Grammarly Premium, -12.00
2026-02-03, Netflix Premium, -22.99
2026-02-03, Hulu, -17.99
2026-02-05, Disney Plus, -13.99
2026-02-05, HBO Max, -15.99
2026-02-07, Spotify Premium, -10.99
2026-02-07, Apple Music, -10.99
2026-02-10, YouTube Premium, -13.99
2026-02-12, Adobe Creative Cloud, -59.99
2026-02-12, Canva Pro, -12.99
2026-02-15, Dropbox Plus, -11.99
2026-02-15, Google One, -2.99
2026-02-18, NordVPN, -12.99
2026-02-20, ChatGPT Plus, -20.00
2026-02-22, LinkedIn Premium, -29.99
2026-02-25, Grammarly Premium, -12.00`,
  duplicate: `2026-01-05, Netflix, -15.99
2026-01-06, NETFLIX, -15.99
2026-01-10, Spotify Premium, -9.99
2026-01-11, Spotify, -9.99
2026-01-15, Dropbox Plus, -11.99
2026-01-16, Google Drive Storage, -9.99
2026-01-18, NordVPN, -12.99
2026-01-19, ExpressVPN, -12.95
2026-01-20, Microsoft 365, -9.99
2026-01-22, Google Workspace, -7.99
2026-02-05, Netflix, -15.99
2026-02-06, NETFLIX, -15.99
2026-02-10, Spotify Premium, -9.99
2026-02-11, Spotify, -9.99
2026-02-15, Dropbox Plus, -11.99
2026-02-16, Google Drive Storage, -9.99
2026-02-18, NordVPN, -12.99
2026-02-19, ExpressVPN, -12.95
2026-02-20, Microsoft 365, -9.99
2026-02-22, Google Workspace, -7.99`
};

// ===== SERVICE DATABASE =====
const SERVICE_DB = {
  netflix: { category: 'Streaming', cancelUrl: 'https://netflix.com/cancelplan', alternatives: [{name:'Standard plan',save:7},{name:'Ad-supported',save:9}] },
  'netflix premium': { category: 'Streaming', cancelUrl: 'https://netflix.com/cancelplan', alternatives: [{name:'Standard plan',save:7},{name:'Ad-supported',save:13}] },
  hulu: { category: 'Streaming', cancelUrl: 'https://help.hulu.com/cancel', alternatives: [{name:'Ad-supported plan',save:4}] },
  'disney plus': { category: 'Streaming', cancelUrl: 'https://disneyplus.com/account', alternatives: [{name:'Ad-supported',save:5}] },
  'hbo max': { category: 'Streaming', cancelUrl: 'https://help.max.com', alternatives: [{name:'Ad plan',save:6}] },
  'spotify premium': { category: 'Music', cancelUrl: 'https://spotify.com/account', alternatives: [{name:'Spotify Free',save:10.99},{name:'Duo plan (split)',save:5}] },
  spotify: { category: 'Music', cancelUrl: 'https://spotify.com/account', alternatives: [{name:'Free tier',save:9.99}] },
  'apple music': { category: 'Music', cancelUrl: 'https://support.apple.com/subscriptions', alternatives: [{name:'Spotify Free',save:10.99}] },
  'youtube premium': { category: 'Streaming', cancelUrl: 'https://youtube.com/paid_memberships', alternatives: [{name:'Free with ads',save:13.99}] },
  'adobe creative cloud': { category: 'Software', cancelUrl: 'https://account.adobe.com/plans', alternatives: [{name:'Photography plan',save:35},{name:'Affinity Suite (one-time)',save:50}] },
  'canva pro': { category: 'Software', cancelUrl: 'https://canva.com/account', alternatives: [{name:'Free tier',save:12.99}] },
  'amazon prime': { category: 'Shopping', cancelUrl: 'https://amazon.com/manageprime', alternatives: [{name:'Monthly when needed',save:5}] },
  'icloud storage': { category: 'Cloud Storage', cancelUrl: 'https://support.apple.com/icloud', alternatives: [{name:'Google One (cheaper)',save:1}] },
  'dropbox plus': { category: 'Cloud Storage', cancelUrl: 'https://dropbox.com/account', alternatives: [{name:'Google Drive Free',save:11.99}] },
  'google one': { category: 'Cloud Storage', cancelUrl: 'https://one.google.com', alternatives: [] },
  'google drive storage': { category: 'Cloud Storage', cancelUrl: 'https://one.google.com', alternatives: [] },
  nordvpn: { category: 'VPN', cancelUrl: 'https://my.nordaccount.com', alternatives: [{name:'2-year plan',save:7}] },
  expressvpn: { category: 'VPN', cancelUrl: 'https://expressvpn.com/subscriptions', alternatives: [{name:'Annual plan',save:5}] },
  'chatgpt plus': { category: 'AI Tools', cancelUrl: 'https://chat.openai.com/settings', alternatives: [{name:'Free tier',save:20}] },
  'linkedin premium': { category: 'Professional', cancelUrl: 'https://linkedin.com/psettings/cancel-premium', alternatives: [{name:'Free LinkedIn',save:29.99}] },
  'grammarly premium': { category: 'Software', cancelUrl: 'https://account.grammarly.com', alternatives: [{name:'Free tier',save:12}] },
  'microsoft 365': { category: 'Software', cancelUrl: 'https://account.microsoft.com/services', alternatives: [{name:'Google Workspace',save:2},{name:'LibreOffice (free)',save:9.99}] },
  'google workspace': { category: 'Software', cancelUrl: 'https://admin.google.com/billing', alternatives: [{name:'Free Gmail',save:7.99}] }
};

// ===== DUPLICATE GROUPS =====
const DUPLICATE_GROUPS = {
  streaming: ['netflix','netflix premium','hulu','disney plus','hbo max','youtube premium'],
  music: ['spotify','spotify premium','apple music','youtube premium'],
  cloud: ['dropbox plus','google one','google drive storage','icloud storage'],
  vpn: ['nordvpn','expressvpn'],
  office: ['microsoft 365','google workspace'],
  design: ['adobe creative cloud','canva pro']
};

// ===== PARSER =====
function parseTransactions(raw) {
  const lines = raw.trim().split('\n').filter(l => l.trim());
  const txns = [];
  for (const line of lines) {
    const parts = line.split(',').map(s => s.trim());
    if (parts.length < 3) continue;
    const date = parts[0];
    const desc = parts.slice(1, -1).join(',').trim();
    const amount = Math.abs(parseFloat(parts[parts.length - 1]));
    if (!isNaN(amount) && desc) {
      txns.push({ date, description: desc, amount, key: desc.toLowerCase().trim() });
    }
  }
  return txns;
}

function getManualEntries() {
  const rows = document.querySelectorAll('.manual-entry-row');
  const txns = [];
  rows.forEach(row => {
    const date = row.querySelector('.entry-date')?.value;
    const desc = row.querySelector('.entry-desc')?.value?.trim();
    const amount = parseFloat(row.querySelector('.entry-amount')?.value);
    if (date && desc && !isNaN(amount)) {
      txns.push({ date, description: desc, amount: Math.abs(amount), key: desc.toLowerCase().trim() });
    }
  });
  return txns;
}

// ===== ANALYSIS ENGINE =====
const LIFESTYLE_MAP = {
  Streaming: 'entertainment',
  Music: 'entertainment',
  Gaming: 'entertainment',
  Software: 'productivity',
  Professional: 'productivity',
  'AI Tools': 'productivity',
  'Cloud Storage': 'infrastructure',
  VPN: 'security',
  Shopping: 'lifestyle',
  Unknown: 'other'
};

const CATEGORY_NECESSITY_BASE = {
  'Cloud Storage': 72,
  Software: 64,
  Professional: 70,
  'AI Tools': 58,
  Shopping: 45,
  VPN: 62,
  Streaming: 35,
  Music: 33,
  Unknown: 45
};

function normalizeText(s) {
  return (s || '')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\b(www|com|inc|llc|ltd|co|corp|corporation|subscription|plan|membership)\b/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeMerchant(description) {
  const cleaned = normalizeText(description);
  if (!cleaned) return { key: '', label: '', confidence: 0 };

  const aliases = [
    { pattern: /netflix/, key: 'netflix', label: 'Netflix' },
    { pattern: /spotify/, key: 'spotify premium', label: 'Spotify' },
    { pattern: /apple music/, key: 'apple music', label: 'Apple Music' },
    { pattern: /youtube premium|youtube/, key: 'youtube premium', label: 'YouTube Premium' },
    { pattern: /adobe/, key: 'adobe creative cloud', label: 'Adobe Creative Cloud' },
    { pattern: /canva/, key: 'canva pro', label: 'Canva Pro' },
    { pattern: /amazon prime|prime/, key: 'amazon prime', label: 'Amazon Prime' },
    { pattern: /icloud/, key: 'icloud storage', label: 'iCloud Storage' },
    { pattern: /dropbox/, key: 'dropbox plus', label: 'Dropbox Plus' },
    { pattern: /google one|google drive storage|gdrive/, key: 'google one', label: 'Google One' },
    { pattern: /nordvpn/, key: 'nordvpn', label: 'NordVPN' },
    { pattern: /expressvpn/, key: 'expressvpn', label: 'ExpressVPN' },
    { pattern: /chatgpt|openai/, key: 'chatgpt plus', label: 'ChatGPT Plus' },
    { pattern: /linkedin/, key: 'linkedin premium', label: 'LinkedIn Premium' },
    { pattern: /grammarly/, key: 'grammarly premium', label: 'Grammarly Premium' },
    { pattern: /microsoft 365|office 365/, key: 'microsoft 365', label: 'Microsoft 365' },
    { pattern: /google workspace/, key: 'google workspace', label: 'Google Workspace' },
    { pattern: /hulu/, key: 'hulu', label: 'Hulu' },
    { pattern: /disney/, key: 'disney plus', label: 'Disney Plus' },
    { pattern: /hbo|max/, key: 'hbo max', label: 'HBO Max' }
  ];

  for (const a of aliases) {
    if (a.pattern.test(cleaned)) return { key: a.key, label: a.label, confidence: 0.95 };
  }

  // Fallback: fuzzy-ish token overlap over known services
  let bestKey = null;
  let bestScore = 0;
  const tokens = cleaned.split(' ').filter(Boolean);
  for (const key of Object.keys(SERVICE_DB)) {
    const keyTokens = key.split(' ');
    const overlap = keyTokens.filter(t => tokens.includes(t)).length;
    const score = overlap / Math.max(keyTokens.length, 1);
    if (score > bestScore) {
      bestScore = score;
      bestKey = key;
    }
  }
  if (bestKey && bestScore >= 0.5) {
    return {
      key: bestKey,
      label: bestKey.split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join(' '),
      confidence: Math.min(0.9, 0.55 + bestScore * 0.35)
    };
  }
  return {
    key: cleaned,
    label: description.trim(),
    confidence: 0.45
  };
}

function daysBetween(a, b) {
  const ms = Math.abs(new Date(a).getTime() - new Date(b).getTime());
  return ms / (1000 * 60 * 60 * 24);
}

function detectFrequency(txns) {
  if (txns.length < 2) return 'irregular';
  const sorted = [...txns].sort((a, b) => new Date(a.date) - new Date(b.date));
  const gaps = [];
  for (let i = 1; i < sorted.length; i++) gaps.push(daysBetween(sorted[i - 1].date, sorted[i].date));
  const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;
  if (avgGap >= 25 && avgGap <= 35) return 'monthly';
  if (avgGap >= 330 && avgGap <= 390) return 'yearly';
  return 'irregular';
}

function detectPriceIncrease(txns) {
  if (txns.length < 2) return { hasIncrease: false, percent: 0 };
  const sorted = [...txns].sort((a, b) => new Date(a.date) - new Date(b.date));
  const start = sorted[0].amount;
  const end = sorted[sorted.length - 1].amount;
  const percent = start > 0 ? ((end - start) / start) * 100 : 0;
  return { hasIncrease: end > start * 1.03, percent: Math.round(percent * 100) / 100 };
}

function scoreSubscription(sub, duplicateCategoriesSet) {
  const base = CATEGORY_NECESSITY_BASE[sub.category] ?? 45;
  const isDuplicate = duplicateCategoriesSet.has(sub.category_group);
  const trial = sub.active_months < 2;
  const highCost = sub.monthly_cost >= 20;
  const lowUsageLikelihood = sub.usage_likelihood === 'low';

  let necessity = base;
  if (isDuplicate) necessity -= 22;
  if (trial) necessity -= 8;
  if (highCost) necessity -= 6;
  if (sub.price_increase.hasIncrease) necessity -= 5;
  necessity = Math.max(0, Math.min(100, Math.round(necessity)));

  let risk = 25;
  if (isDuplicate) risk += 28;
  if (trial) risk += 16;
  if (lowUsageLikelihood) risk += 14;
  if (highCost) risk += 10;
  if (sub.price_increase.hasIncrease) risk += 12;
  risk = Math.max(0, Math.min(100, Math.round(risk)));

  return { necessity_score: necessity, waste_risk: risk };
}

function analyzeSubscriptions(transactions) {
  // 1) Normalize and group recurring payments
  const groups = {};
  for (const t of transactions) {
    const norm = normalizeMerchant(t.description);
    const nKey = norm.key || t.key;
    if (!groups[nKey]) groups[nKey] = { txns: [], raw: new Set(), confidence: norm.confidence, label: norm.label };
    groups[nKey].txns.push(t);
    groups[nKey].raw.add(t.description);
    groups[nKey].confidence = Math.max(groups[nKey].confidence, norm.confidence);
  }

  const subscriptions = [];
  for (const [key, grouped] of Object.entries(groups)) {
    const txns = grouped.txns;
    const avgAmount = txns.reduce((s, t) => s + t.amount, 0) / txns.length;
    const info = SERVICE_DB[key] || { category: 'Unknown', cancelUrl: null, alternatives: [] };
    const frequency = detectFrequency(txns);
    if (txns.length < 2 && !SERVICE_DB[key]) continue;

    const sortedDates = [...txns].sort((a, b) => new Date(a.date) - new Date(b.date));
    const firstDate = sortedDates[0].date;
    const lastDate = sortedDates[sortedDates.length - 1].date;
    const activeMonths = Math.max(1, daysBetween(firstDate, lastDate) / 30);
    const priceIncrease = detectPriceIncrease(txns);
    const usageLikelihood = txns.length >= 4 ? 'high' : txns.length >= 2 ? 'medium' : 'low';
    const lifestyleCategory = LIFESTYLE_MAP[info.category] || 'other';

    subscriptions.push({
      name: grouped.label || txns[0].description,
      merchant_normalized: grouped.label || txns[0].description,
      merchant_raw_examples: Array.from(grouped.raw).slice(0, 4),
      category: info.category,
      lifestyle_category: lifestyleCategory,
      frequency,
      monthly_cost: Math.round(avgAmount * 100) / 100,
      yearly_cost: Math.round(avgAmount * 12 * 100) / 100,
      occurrences: txns.length,
      active_months: Math.round(activeMonths * 10) / 10,
      trial_behavior: activeMonths < 2,
      usage_likelihood: usageLikelihood,
      price_increase: priceIncrease,
      cancel_url: info.cancelUrl,
      alternatives: info.alternatives || [],
      confidence: grouped.confidence,
      status: 'active',
      category_group: Object.entries(DUPLICATE_GROUPS).find(([, members]) => members.includes(key))?.[0] || info.category.toLowerCase()
    });
  }

  // Sort by cost desc
  subscriptions.sort((a, b) => b.monthly_cost - a.monthly_cost);

  // 2) Duplicates by curated group
  const duplicates = [];
  for (const [groupName, members] of Object.entries(DUPLICATE_GROUPS)) {
    const found = subscriptions.filter(s => members.includes(normalizeMerchant(s.name).key));
    if (found.length >= 2) {
      const cheapest = found.reduce((a, b) => a.monthly_cost < b.monthly_cost ? a : b);
      const others = found.filter(f => f !== cheapest);
      const wasteAmt = others.reduce((s, o) => s + o.monthly_cost, 0);
      others.forEach(o => o.status = 'wasteful');
      duplicates.push({
        category: groupName,
        services: found.map(f => f.name),
        keep: cheapest.name,
        reason: `Ayni kategoride birden fazla servis tespit edildi (${groupName}).`,
        estimated_monthly_total: Math.round(found.reduce((s, f) => s + f.monthly_cost, 0) * 100) / 100,
        monthly_waste: Math.round(wasteAmt * 100) / 100,
        yearly_waste: Math.round(wasteAmt * 12 * 100) / 100,
        severity: wasteAmt >= 15 ? 'high' : 'medium'
      });
    }
  }

  const duplicateCategories = new Set(duplicates.map(d => d.category));

  // 3) Score and explain waste reasons
  subscriptions.forEach(s => {
    const { necessity_score, waste_risk } = scoreSubscription(s, duplicateCategories);
    s.necessity_score = necessity_score;
    s.waste_risk = waste_risk;

    const reasons = [];
    if (s.status === 'wasteful') reasons.push('Ayni kategoride alternatif aboneliklerle cakisiyor.');
    if (s.trial_behavior) reasons.push('2 aydan kisa suredir aktif, deneme davranisina benziyor.');
    if (s.price_increase.hasIncrease) reasons.push(`Fiyat artis trendi var (%${s.price_increase.percent}).`);
    if (s.usage_likelihood === 'low') reasons.push('Odeme duzeni duzgun ama sinirli gecmis nedeniyle kullanim olasiligi dusuk.');
    if (s.monthly_cost > 25) reasons.push('Aylik maliyet yuksek.');
    s.waste_reason = reasons.length ? reasons.join(' ') : 'Belirgin israf sinyali yok.';

    if (s.status === 'active' && (waste_risk >= 65 || s.monthly_cost > 25)) s.status = 'review';
  });

  // 4) Savings opportunities
  const savings = [];
  for (const sub of subscriptions) {
    if (sub.status === 'wasteful') {
      savings.push({
        type: 'cancel_duplicate',
        service: sub.name,
        current_cost: sub.monthly_cost,
        suggestion: 'Cancel duplicate subscription',
        monthly_saving: sub.monthly_cost,
        yearly_saving: Math.round(sub.monthly_cost * 12 * 100) / 100,
        cancel_url: sub.cancel_url,
        reason: sub.waste_reason
      });
    }
    if (sub.alternatives && sub.alternatives.length > 0) {
      const best = sub.alternatives.reduce((a, b) => a.save > b.save ? a : b);
      savings.push({
        type: 'downgrade',
        service: sub.name,
        current_cost: sub.monthly_cost,
        suggestion: `Switch to ${best.name}`,
        monthly_saving: best.save,
        yearly_saving: Math.round(best.save * 12 * 100) / 100,
        cancel_url: sub.cancel_url,
        difficulty: sub.monthly_cost > 20 ? 'easy - high impact' : 'easy',
        reason: sub.price_increase.hasIncrease
          ? `Recent price increase (%${sub.price_increase.percent}) makes downgrade more valuable.`
          : 'Lower-cost alternative available.'
      });
    }
  }
  savings.sort((a, b) => b.monthly_saving - a.monthly_saving);

  // 5) Monthly waste
  const monthlyWaste = duplicates.reduce((s, w) => s + w.monthly_waste, 0);

  // 6) Action plan with cancel steps
  const actionPlan = [];
  let priority = 1;

  // First: cancel duplicates
  for (const w of duplicates) {
    const others = w.services.filter(s => s !== w.keep);
    actionPlan.push({
      step: priority++,
      priority: 'high',
      action: `Cancel duplicate ${w.category} services: ${others.join(', ')}`,
      detail: `Keep "${w.keep}" and remove higher-overlap services.`,
      monthly_savings: w.monthly_waste,
      steps: others.map(name => {
        const info = SERVICE_DB[name.toLowerCase().trim()];
        return info?.cancelUrl
          ? `Go to ${info.cancelUrl} → Account → Cancel Subscription`
          : `Search "${name} cancel subscription" for steps`;
      })
    });
  }

  // Then: downgrade expensive ones
  for (const s of savings.slice(0, 5)) {
    if (s.monthly_saving >= 5) {
      actionPlan.push({
        step: priority++,
        priority: s.monthly_saving >= 15 ? 'high' : 'medium',
        action: `Downgrade ${s.service}: ${s.suggestion}`,
        detail: `Save $${s.monthly_saving}/mo ($${s.yearly_saving}/yr)`,
        monthly_savings: s.monthly_saving,
        steps: [
          s.cancel_url ? `Visit ${s.cancel_url}` : `Go to ${s.service} account settings`,
          'Navigate to subscription/plan settings',
          `Switch to ${s.suggestion.replace('Switch to ', '')}`,
          'Confirm the change'
        ]
      });
    }
  }

  const totalMonthly = subscriptions.reduce((s, sub) => s + sub.monthly_cost, 0);
  const insights = [
    `${subscriptions.length} subscription(s) detected from ${transactions.length} transaction(s).`,
    `Estimated monthly total: $${totalMonthly.toFixed(2)}, yearly total: $${(totalMonthly * 12).toFixed(2)}.`,
    `${duplicates.length} duplicate cluster(s) found, with $${monthlyWaste.toFixed(2)}/mo potential duplicate waste.`,
    `${subscriptions.filter(s => s.trial_behavior).length} service(s) look like trial behavior (<2 months).`,
    `${subscriptions.filter(s => s.price_increase.hasIncrease).length} service(s) show price increases over time.`,
    'Waste scoring considers overlap, tenure, pricing trend, and usage-likelihood proxy signals.'
  ].join(' ');

  return {
    subscriptions: subscriptions.map(s => ({
      name: s.name,
      merchant_raw_examples: s.merchant_raw_examples,
      merchant_normalized: s.merchant_normalized,
      category: s.category,
      lifestyle_category: s.lifestyle_category,
      frequency: s.frequency,
      monthly_cost: s.monthly_cost,
      yearly_cost: s.yearly_cost,
      status: s.status,
      active_months: s.active_months,
      trial_behavior: s.trial_behavior,
      usage_likelihood: s.usage_likelihood,
      necessity_score: s.necessity_score,
      waste_risk: s.waste_risk,
      price_increase: s.price_increase,
      waste_reason: s.waste_reason
    })),
    duplicates,
    wasteful_expenses: duplicates,
    savings_opportunities: savings,
    insights,
    monthly_waste_estimate: Math.round(monthlyWaste * 100) / 100,
    monthly_total: Math.round(totalMonthly * 100) / 100,
    yearly_total: Math.round(totalMonthly * 12 * 100) / 100,
    potential_yearly_savings: Math.round((monthlyWaste + savings.reduce((s, o) => s + o.monthly_saving, 0)) * 12 * 100) / 100,
    action_plan: actionPlan
  };
}

// ===== UI RENDERING =====
function renderResults(result) {
  // Summary
  document.getElementById('val-total-subs').textContent = result.subscriptions.length;
  document.getElementById('val-monthly-cost').textContent = '$' + result.monthly_total.toFixed(2);
  document.getElementById('val-yearly-cost').textContent = '$' + result.yearly_total.toFixed(2);
  document.getElementById('val-potential-savings').textContent = '$' + result.potential_yearly_savings.toFixed(2);

  // Subscriptions table
  const tbody = document.getElementById('subscriptions-body');
  tbody.innerHTML = result.subscriptions.map(s => `
    <tr>
      <td><strong>${s.name}</strong></td>
      <td>${s.category}</td>
      <td>${s.frequency}</td>
      <td>$${s.monthly_cost.toFixed(2)}/mo</td>
      <td><span class="status-badge status-${s.status}">${s.status}</span></td>
    </tr>`).join('');

  // Wasteful
  const wl = document.getElementById('wasteful-list');
  if (result.wasteful_expenses.length === 0) {
    wl.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px;">No duplicate services detected ✓</p>';
  } else {
    wl.innerHTML = result.wasteful_expenses.map(w => `
      <div class="alert-item">
        <div class="alert-icon">⚠️</div>
        <div>
          <strong>Duplicate ${w.category}: ${w.services.join(' & ')}</strong>
          <p>Keep "${w.keep}" and cancel overlapping alternatives.</p>
          <div class="waste-amount">-$${w.monthly_waste.toFixed(2)}/mo · -$${w.yearly_waste.toFixed(2)}/yr wasted</div>
        </div>
      </div>`).join('');
  }

  // Savings
  const sl = document.getElementById('savings-list');
  if (result.savings_opportunities.length === 0) {
    sl.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px;">No savings opportunities found</p>';
  } else {
    sl.innerHTML = result.savings_opportunities.map(s => `
      <div class="opp-item">
        <div class="opp-icon">💡</div>
        <div>
          <strong>${s.service}: ${s.suggestion}</strong>
          <p>Current: $${s.current_cost.toFixed(2)}/mo${s.cancel_url ? ' · <a href="'+s.cancel_url+'" target="_blank" style="color:var(--accent-blue)">Manage →</a>' : ''}</p>
          <div class="save-amount">Save $${s.monthly_saving.toFixed(2)}/mo · $${s.yearly_saving.toFixed(2)}/yr</div>
        </div>
      </div>`).join('');
  }

  // Action plan
  const al = document.getElementById('action-list');
  if (result.action_plan.length === 0) {
    al.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px;">No immediate actions needed ✓</p>';
  } else {
    al.innerHTML = result.action_plan.map(a => `
      <div class="action-item">
        <div class="action-num">${a.step}</div>
        <div>
          <strong>${a.action}</strong>
          <p>${a.detail}</p>
          ${a.steps ? '<ul style="margin-top:8px;padding-left:18px;font-size:0.82rem;color:var(--text-secondary)">' + a.steps.map(s => '<li style="margin-bottom:4px">'+s+'</li>').join('') + '</ul>' : ''}
          <span class="action-priority priority-${a.priority}">${a.priority} priority</span>
        </div>
      </div>`).join('');
  }

  // JSON output
  document.getElementById('json-output').textContent = JSON.stringify(result, null, 2);

  // User Report
  renderUserReport(result);
}

// ===== USER REPORT GENERATOR =====
function renderUserReport(r) {
  const topCancel = r.subscriptions
    .filter(s => s.status === 'wasteful' || s.status === 'review')
    .sort((a, b) => b.monthly_cost - a.monthly_cost)
    .slice(0, 3);

  const quickWins = r.savings_opportunities
    .filter(s => s.cancel_url)
    .sort((a, b) => b.monthly_saving - a.monthly_saving)
    .slice(0, 3);

  const yearlyTotal = r.yearly_total;
  const yearlySavings = r.potential_yearly_savings;
  const afterSavings = yearlyTotal - yearlySavings;

  let html = '';

  // Section 1: Total money wasted
  html += `<div class="report-section report-section-waste">
    <h4><span class="emoji">🔥</span> Money You're Losing Every Month</h4>
    <div class="report-big-number red">$${r.monthly_waste_estimate.toFixed(2)}/mo</div>
    <p>That's <strong>$${(r.monthly_waste_estimate * 12).toFixed(2)} per year</strong> spent on subscriptions you don't need or that overlap with each other.</p>
  </div>`;

  // Section 2: Top 3 to cancel
  html += `<div class="report-section report-section-cancel">
    <h4><span class="emoji">✂️</span> Top ${topCancel.length} Subscriptions to Cancel</h4>`;
  if (topCancel.length === 0) {
    html += '<p>No obvious cancellations found. Your subscriptions look reasonable.</p>';
  } else {
    html += '<ul class="report-list">';
    topCancel.forEach((s, i) => {
      const info = SERVICE_DB[s.name.toLowerCase().trim()];
      const alt = info?.alternatives?.[0];
      html += `<li>
        <span class="service-name">${i + 1}. ${s.name}</span>
        <span class="service-cost">$${s.monthly_cost.toFixed(2)}/mo</span>
        ${alt ? '<span class="service-alt">→ Try "' + alt.name + '" instead and save $' + alt.save.toFixed(2) + '/mo</span>' : ''}
      </li>`;
    });
    html += '</ul>';
  }
  html += '</div>';

  // Section 3: Quick wins
  html += `<div class="report-section report-section-quick">
    <h4><span class="emoji">⚡</span> Quick Wins (Do These in 2 Minutes)</h4>`;
  if (quickWins.length === 0) {
    html += '<p>No quick actions available right now.</p>';
  } else {
    quickWins.forEach(s => {
      html += `<div class="report-quick-item">
        <strong>${s.service}: ${s.suggestion}</strong>
        <span>Save $${s.monthly_saving.toFixed(2)}/mo → <a href="${s.cancel_url}" target="_blank">Click here to manage</a></span>
      </div>`;
    });
  }
  html += '</div>';

  // Section 4: Long-term savings plan
  html += `<div class="report-section report-section-longterm">
    <h4><span class="emoji">📈</span> Your Long-Term Savings Plan</h4>
    <p>Right now you spend <strong>$${r.monthly_total.toFixed(2)}/mo</strong> ($${yearlyTotal.toFixed(2)}/yr) on subscriptions.</p>
    <p>If you follow all the steps above, you could bring it down to:</p>
    <div class="report-big-number green">$${afterSavings.toFixed(2)}/yr</div>
    <p>That's <strong>$${yearlySavings.toFixed(2)} saved per year</strong> — money back in your pocket.</p>
  </div>`;

  document.getElementById('report-body').innerHTML = html;
}

// ===== LOADING ANIMATION =====
async function showLoading() {
  const steps = ['step-parse','step-detect','step-duplicates','step-savings'];
  for (let i = 0; i < steps.length; i++) {
    await new Promise(r => setTimeout(r, 400));
    if (i > 0) document.getElementById(steps[i-1]).classList.replace('active','done');
    document.getElementById(steps[i]).classList.add('active');
  }
  await new Promise(r => setTimeout(r, 400));
  document.getElementById(steps[3]).classList.replace('active','done');
  await new Promise(r => setTimeout(r, 200));
}

// ===== EVENT HANDLERS =====
document.addEventListener('DOMContentLoaded', () => {
  const csvInput = document.getElementById('csv-input');
  const btnAnalyze = document.getElementById('btn-analyze');
  const charCount = document.getElementById('char-count');
  let activeTab = 'csv';
  let selectedSample = null;

  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      activeTab = btn.dataset.tab;
      document.getElementById('content-' + activeTab).classList.add('active');
      updateAnalyzeBtn();
    });
  });

  // CSV input
  csvInput.addEventListener('input', () => {
    charCount.textContent = csvInput.value.length + ' characters';
    updateAnalyzeBtn();
  });

  // Clear
  document.getElementById('btn-clear-csv').addEventListener('click', () => {
    csvInput.value = '';
    charCount.textContent = '0 characters';
    updateAnalyzeBtn();
  });

  // Sample cards
  document.querySelectorAll('.sample-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.sample-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedSample = card.dataset.sample;
      updateAnalyzeBtn();
    });
  });

  // Add manual entry
  let entryIdx = 1;
  document.getElementById('btn-add-entry').addEventListener('click', () => {
    const container = document.getElementById('manual-entries');
    const row = document.createElement('div');
    row.className = 'manual-entry-row';
    row.innerHTML = `
      <input type="date" class="input-field entry-date" id="entry-date-${entryIdx}">
      <input type="text" class="input-field entry-desc" placeholder="Description" id="entry-desc-${entryIdx}">
      <input type="number" class="input-field entry-amount" placeholder="Amount" step="0.01" id="entry-amount-${entryIdx}">
      <select class="input-field entry-freq" id="entry-freq-${entryIdx}">
        <option value="monthly">Monthly</option>
        <option value="yearly">Yearly</option>
        <option value="weekly">Weekly</option>
      </select>`;
    container.appendChild(row);
    entryIdx++;
    updateAnalyzeBtn();
    row.querySelector('.entry-desc').addEventListener('input', updateAnalyzeBtn);
  });

  // Listen for manual input changes
  document.getElementById('manual-entries').addEventListener('input', updateAnalyzeBtn);

  function updateAnalyzeBtn() {
    let hasData = false;
    if (activeTab === 'csv') hasData = csvInput.value.trim().length > 10;
    else if (activeTab === 'manual') hasData = getManualEntries().length > 0;
    else if (activeTab === 'sample') hasData = !!selectedSample;
    btnAnalyze.disabled = !hasData;
  }

  // ANALYZE
  btnAnalyze.addEventListener('click', async () => {
    let transactions = [];
    if (activeTab === 'csv') transactions = parseTransactions(csvInput.value);
    else if (activeTab === 'manual') transactions = getManualEntries();
    else if (activeTab === 'sample') transactions = parseTransactions(SAMPLES[selectedSample]);

    if (transactions.length === 0) return;

    // Show loading
    document.getElementById('input-section').classList.add('hidden');
    document.getElementById('hero-section').classList.add('hidden');
    document.getElementById('loading-section').classList.remove('hidden');
    document.querySelectorAll('.step').forEach(s => { s.classList.remove('active','done'); });

    await showLoading();

    const result = analyzeSubscriptions(transactions);

    document.getElementById('loading-section').classList.add('hidden');
    document.getElementById('results-section').classList.remove('hidden');
    renderResults(result);
  });

  // Reset
  document.getElementById('btn-reset').addEventListener('click', () => {
    document.getElementById('results-section').classList.add('hidden');
    document.getElementById('hero-section').classList.remove('hidden');
    document.getElementById('input-section').classList.remove('hidden');
  });

  // Copy Report
  document.getElementById('btn-copy-report').addEventListener('click', () => {
    const el = document.getElementById('report-body');
    const text = el.innerText;
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById('btn-copy-report');
      btn.innerHTML = '✓ Copied';
      setTimeout(() => {
        btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy';
      }, 2000);
    });
  });

  // Copy JSON
  document.getElementById('btn-copy-json').addEventListener('click', () => {
    const text = document.getElementById('json-output').textContent;
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById('btn-copy-json');
      btn.innerHTML = '✓ Copied';
      setTimeout(() => {
        btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy';
      }, 2000);
    });
  });

  // Theme toggle
  document.getElementById('btn-theme-toggle').addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
  });
});
