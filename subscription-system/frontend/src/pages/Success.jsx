import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Success() {
  const { refreshUser } = useAuth();

  // Refresh user data to pick up the new plan from webhook
  useEffect(() => {
    const timer = setTimeout(() => refreshUser(), 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="success-page">
      <div className="card success-card">
        <div className="success-icon">🎉</div>
        <h2>Payment Successful!</h2>
        <p>
          Your subscription is now active. It may take a few seconds for your plan to update.
        </p>
        <Link to="/dashboard" className="btn btn-primary" style={{ textDecoration: 'none' }}>
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
