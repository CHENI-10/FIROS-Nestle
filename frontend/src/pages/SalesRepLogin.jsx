import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Login.css';

const SalesRepLogin = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    if (!email || !password) {
      alert('Please enter your email and password.');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/salesrep-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();

      if (!response.ok) {
        alert(data.message || 'Invalid email or password! Please try again.');
        setIsLoading(false);
        return;
      }

      // Check if role is sales_rep
      const role = data.user?.role || data.role;
      if (role !== 'sales_rep') {
        alert('Access Restricted! This portal is for Sales Representatives only.');
        setIsLoading(false);
        return;
      }

      // Instead of storing in sessionStorage, we pass it to the parent state
      // AC5: store JWT in memory only
      onLoginSuccess(data.token, data.user);
      navigate('/market-intelligence');

    } catch (err) {
      alert('Server error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-wrapper" style={{ overflow: 'hidden' }}>
      <div className="gold-accent-bar"></div>

      <div className="login-split-container" style={{ display: 'flex', flexDirection: 'column' }}>

        {/* Form Panel optimized for Mobile width */}
        <div className="login-form-panel" style={{ width: '100%', maxWidth: '375px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="login-card-inner" style={{ padding: '24px' }}>
            <div className="login-header">
              <h1 className="logo-text">FIROS</h1>
              <p className="logo-subtext">MARKET INTELLIGENCE</p>
              <h2>Sales Rep Portal</h2>
            </div>

            <form onSubmit={handleLogin} className="login-form">
              <div className="input-group">
                <label htmlFor="email">Work Email</label>
                <div className="input-wrapper">
                  <svg className="input-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3 8L10.8906 13.2604C11.5624 13.7083 12.4376 13.7083 13.1094 13.2604L21 8M5 19H19C20.1046 19 21 18.1046 21 17V7C21 5.89543 20.1046 5 19 5H5C3.89543 5 3 5.89543 3 7V17C3 18.1046 3.89543 19 5 19Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <input
                    type="email"
                    id="email"
                    placeholder="name@nestle.lk"
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
                    <path d="M12 15V17M6 11V9C6 5.68629 8.68629 3 12 3C15.3137 3 18 5.68629 18 9V11M7 21H17C18.1046 21 19 20.1046 19 19V13C19 11.8954 18.1046 11 17 11H7C5.89543 11 5 11.8954 5 13V19C5 20.1046 5.89543 21 7 21Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M1 1l22 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M10.73 10.73A3 3 0 0 0 12 15a3 3 0 0 0 2.12-.88" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button type="submit" className={`submit-btn ${isLoading ? 'loading' : ''}`} disabled={isLoading}>
                {isLoading ? (
                  <span className="spinner"></span>
                ) : (
                  'Login'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesRepLogin;
