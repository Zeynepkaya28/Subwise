import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';

const FEATURE_META = [
  { key: 'csvUpload', label: 'CSV Upload', icon: '📄' },
  { key: 'bankSync', label: 'Bank Sync', icon: '🏦' },
  { key: 'duplicateDetection', label: 'Duplicate Detection', icon: '🔍' },
  { key: 'savingsReport', label: 'Savings Report', icon: '💰' },
  { key: 'exportPdf', label: 'PDF Export', icon: '📑' },
  { key: 'prioritySupport', label: 'Priority Support', icon: '⚡' },
];

export default function Dashboard() {
  const { user, refreshUser } = useAuth();
  const [status, setStatus] = useState(null);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    refreshUser();
    api.getStatus().then(setStatus).catch(() => {});
  }, []);

  const handleManageBilling = async () => {
    setPortalLoading(true);
    try {
      const data = await api.openPortal();
      window.location.href = data.url;
    } catch (err) {
      alert(err.message);
    } finally {
      setPortalLoading(false);
    }
  };

  const features = status?.features || {};
  const planLabel = (user?.plan || 'free').charAt(0).toUpperCase() + (user?.plan || 'free').slice(1);

  return (
    <div className="page">
      <div className="dashboard-header">
        <h1>Dashboard</h1>
        <p>Welcome back, {user?.email}</p>
      </div>

      <div className="dashboard-grid">
        <div className="card stat-card">
          <div className="stat-label">Current Plan</div>
          <div className="stat-value accent">{planLabel}</div>
        </div>
        <div className="card stat-card">
          <div className="stat-label">Status</div>
          <div className="stat-value green">
            {status?.status === 'active' ? '● Active' : status?.status || '● Free'}
          </div>
        </div>
        <div className="card stat-card">
          <div className="stat-label">Transaction Limit</div>
          <div className="stat-value">
            {features.maxTransactions === Infinity ? '∞' : features.maxTransactions || 50}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Your Features</h3>
        <div className="feature-grid">
          {FEATURE_META.map(({ key, label, icon }) => {
            const enabled = features[key];
            return (
              <div key={key} className="card feature-item">
                <div className={`feature-icon ${enabled ? 'enabled' : 'disabled'}`}>{icon}</div>
                <div className="feature-info">
                  <div className="feature-name">{label}</div>
                  <div className={`feature-status ${enabled ? 'enabled' : ''}`}>
                    {enabled ? 'Available' : 'Upgrade to unlock'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        {user?.plan === 'free' ? (
          <Link to="/pricing" className="btn btn-primary" style={{ textDecoration: 'none' }}>
            Upgrade Plan
          </Link>
        ) : (
          <button
            className="btn btn-secondary"
            onClick={handleManageBilling}
            disabled={portalLoading}
          >
            {portalLoading ? 'Opening...' : 'Manage Billing'}
          </button>
        )}
      </div>
    </div>
  );
}
