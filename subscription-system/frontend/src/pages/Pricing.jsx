import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';

const FEATURE_LABELS = {
  csvUpload: 'CSV Upload',
  bankSync: 'Bank Sync',
  duplicateDetection: 'Duplicate Detection',
  savingsReport: 'Savings Report',
  exportPdf: 'PDF Export',
  prioritySupport: 'Priority Support',
};

const PLAN_DESCRIPTIONS = {
  free: 'For getting started — analyze up to 50 transactions',
  premium: 'For active budgeters — bank sync & smart detection',
  pro: 'Full power — unlimited analysis with PDF export & priority support',
};

export default function Pricing() {
  const { user } = useAuth();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(null); // planId being loaded

  useEffect(() => {
    api.getPlans()
      .then(data => setPlans(data.plans))
      .catch(() => {});
  }, []);

  const handleSubscribe = async (planId) => {
    if (!user) {
      window.location.href = '/register';
      return;
    }
    setLoading(planId);
    try {
      const data = await api.createCheckout(planId);
      window.location.href = data.url;
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="page">
      <div className="pricing-header">
        <h1>Simple, <span className="gradient-text">Transparent</span> Pricing</h1>
        <p>Choose the plan that fits your needs. Upgrade or cancel anytime.</p>
      </div>

      <div className="pricing-grid">
        {plans.map((plan) => {
          const isCurrent = user?.plan === plan.id;
          const isFeatured = plan.id === 'premium';

          return (
            <div key={plan.id} className={`pricing-card${isFeatured ? ' featured' : ''}`}>
              <div className="plan-name">{plan.name}</div>
              <div className="plan-price">
                {plan.price === 0 ? (
                  'Free'
                ) : (
                  <>
                    <span className="currency">$</span>
                    {plan.price}
                    <span className="period">/mo</span>
                  </>
                )}
              </div>
              <div className="plan-desc">{PLAN_DESCRIPTIONS[plan.id]}</div>

              <ul className="feature-list">
                <li>
                  <span className="check">✓</span>
                  {plan.features.maxTransactions === Infinity
                    ? 'Unlimited transactions'
                    : `Up to ${plan.features.maxTransactions} transactions`}
                </li>
                {Object.entries(FEATURE_LABELS).map(([key, label]) => (
                  <li key={key}>
                    <span className={plan.features[key] ? 'check' : 'cross'}>
                      {plan.features[key] ? '✓' : '✗'}
                    </span>
                    {label}
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <div className="current-badge">✓ Current Plan</div>
              ) : plan.id === 'free' ? (
                <button className="btn btn-secondary btn-full" disabled>
                  Default Plan
                </button>
              ) : (
                <button
                  className={`btn btn-full ${isFeatured ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={loading === plan.id}
                >
                  {loading === plan.id ? 'Redirecting...' : `Get ${plan.name}`}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
