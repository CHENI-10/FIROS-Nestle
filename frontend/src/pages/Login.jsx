import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Login.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await axios.post('http://localhost:5000/api/auth/login', {
        email,
        password
      });

      const { token, role } = response.data;
      
      // Store in sessionStorage
      sessionStorage.setItem('token', token);
      sessionStorage.setItem('role', role);

      // Redirect based on role
      if (role === 'staff') {
        navigate('/batch-registration');
      } else if (['manager', 'admin', 'sales_rep'].includes(role)) {
        navigate('/dashboard');
      } else {
        navigate('/dashboard'); // fallback
      }
    } catch (err) {
      setError(
        err.response && err.response.data && err.response.data.message
          ? err.response.data.message
          : 'Failed to login. Please check your credentials.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="gold-accent-bar"></div>
      
      <div className="login-split-container">
        
        {/* Left Side: Branding / Info */}
        <div className="login-brand-panel">
          <div className="brand-overlay-pattern"></div>
          <div className="brand-content">
            <div className="brand-header">
              <h1 className="brand-title-watermark">FIROS</h1>
              <p className="brand-tagline">Good Food, Good Life</p>
            </div>
            
            <div className="stat-cards-container">
              <div className="stat-card">
                <div className="stat-icon">📦</div>
                <div className="stat-text">27 Products Tracked</div>
              </div>
              <div className="stat-card" style={{animationDelay: '0.1s'}}>
                <div className="stat-icon">🏬</div>
                <div className="stat-text">4 Warehouse Zones</div>
              </div>
              <div className="stat-card" style={{animationDelay: '0.2s'}}>
                <div className="stat-icon">⏱️</div>
                <div className="stat-text">Real-time FRS Monitoring</div>
              </div>
              <div className="stat-card" style={{animationDelay: '0.3s'}}>
                <div className="stat-icon">📍</div>
                <div className="stat-text">Nestlé Lanka Kurunegala</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Login Form */}
        <div className="login-form-panel">
          <div className="login-card-inner">
            <div className="login-header">
              <h1 className="logo-text">FIROS</h1>
              <p className="logo-subtext">NESTLÉ LANKA FRESHNESS SYSTEM</p>
              <h2>Enterprise Portal</h2>
            </div>

            {error && (
              <div className="error-message">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22ZM12 20C16.4183 20 20 16.4183 20 12C20 7.58172 16.4183 4 12 4C7.58172 4 4 7.58172 4 12C4 16.4183 7.58172 20 12 20ZM11 15H13V17H11V15ZM11 7H13V13H11V7Z" fill="currentColor"/>
                </svg>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="login-form">
              <div className="input-group">
                <label htmlFor="email">Work Email</label>
                <div className="input-wrapper">
                  <svg className="input-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3 8L10.8906 13.2604C11.5624 13.7083 12.4376 13.7083 13.1094 13.2604L21 8M5 19H19C20.1046 19 21 18.1046 21 17V7C21 5.89543 20.1046 5 19 5H5C3.89543 5 3 5.89543 3 7V17C3 18.1046 3.89543 19 5 19Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <input
                    type="email"
                    id="email"
                    placeholder="name@nestle.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="input-group">
                <label htmlFor="password">Password</label>
                <div className="input-wrapper">
                  <svg className="input-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 15V17M6 11V9C6 5.68629 8.68629 3 12 3C15.3137 3 18 5.68629 18 9V11M7 21H17C18.1046 21 19 20.1046 19 19V13C19 11.8954 18.1046 11 17 11H7C5.89543 11 5 11.8954 5 13V19C5 20.1046 5.89543 21 7 21Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <input
                    type="password"
                    id="password"
                    placeholder="Enter your given password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button type="submit" className={`submit-btn ${isLoading ? 'loading' : ''}`} disabled={isLoading}>
                {isLoading ? (
                  <span className="spinner"></span>
                ) : (
                  'Sign In to Dashboard'
                )}
              </button>
            </form>
            
            <div className="login-footer">
              <p>Freshness Intelligence & Risk Optimization System</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
