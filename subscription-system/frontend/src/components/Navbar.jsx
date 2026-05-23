import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand" style={{ textDecoration: 'none' }}>
        SubSaver<span>AI</span>
      </Link>

      <div className="navbar-links">
        <Link to="/pricing" className="nav-link">Pricing</Link>

        {user ? (
          <>
            <Link to="/dashboard" className="nav-link">Dashboard</Link>
            <span className={`nav-plan-badge ${user.plan === 'pro' ? 'pro' : ''}`}>
              {user.plan?.toUpperCase()}
            </span>
            <button className="btn btn-sm btn-secondary" onClick={handleLogout}>
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="nav-link">Login</Link>
            <Link to="/register" className="btn btn-sm btn-primary" style={{ textDecoration: 'none' }}>
              Sign Up
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
