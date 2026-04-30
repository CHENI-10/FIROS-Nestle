import React, { useState } from 'react';
import BarcodeScanner from '../components/BarcodeScanner';

const IdentityVerification = ({ token, onVerified, onLogout }) => {
  const [workId, setWorkId] = useState('');
  const [name, setName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  // Auto-fetch name when Work ID loses focus
  const handleWorkIdBlur = async () => {
    if (!workId || workId.length < 3) return;

    try {
      const response = await fetch(`/api/auth/rep/${workId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setName(data.name);
        setErrorMsg(''); // clear error if found
      }
    } catch (err) {
      console.error("Error auto-fetching rep:", err);
    }
  };

  const handleScan = (decodedText) => {
    // Expected format: "WORK_ID|Full Name"
    if (decodedText.includes('|')) {
      const parts = decodedText.split('|');
      setWorkId(parts[0]);
      setName(parts[1]);
      setShowScanner(false);
      setErrorMsg('');
    } else {
      // Fallback if just work ID is encoded
      setWorkId(decodedText);
      setShowScanner(false);
      // Let the blur or submit logic fetch the name
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!workId || !name) {
      setErrorMsg('Please provide both Work ID and Name');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      const response = await fetch('/api/auth/verify-rep', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ workId, name })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        onVerified(data.rep);
      } else {
        setErrorMsg(data.message || 'Verification failed. Please check your details.');
      }
    } catch (err) {
      console.error('Verification error:', err);
      setErrorMsg('Server error during verification. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h2 style={{ margin: 0, color: '#1a3a5c' }}>Verify Your Identity</h2>
          <p style={{ margin: '8px 0 0 0', color: '#64748b', fontSize: '14px' }}>
            Please verify your individual identity before submitting field reports.
          </p>
        </div>

        {errorMsg && (
          <div style={styles.errorBanner}>
            {errorMsg}
          </div>
        )}

        {showScanner ? (
          <div style={{ marginBottom: '20px' }}>
            <BarcodeScanner onScan={handleScan} />
            <div style={{ textAlign: 'center', marginTop: '10px' }}>
              <button
                type="button"
                onClick={() => setShowScanner(false)}
                style={styles.linkBtn}
              >
                Cancel Scanning
              </button>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <button
              type="button"
              onClick={() => setShowScanner(true)}
              style={styles.scanBtn}
            >
              <span style={{ fontSize: '20px' }}>📷</span> Scan ID Card
            </button>

            <div style={styles.divider}>
              <span style={styles.dividerText}>OR MANUAL ENTRY</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={styles.label}>Work ID</label>
            <input
              type="text"
              value={workId}
              onChange={(e) => setWorkId(e.target.value.toUpperCase())}
              onBlur={handleWorkIdBlur}
              placeholder="e.g. REP001"
              style={styles.input}
              required
            />
          </div>

          <div>
            <label style={styles.label}>Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Auto-fills from Work ID"
              style={styles.input}
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !workId || !name}
            style={{ ...styles.submitBtn, opacity: (isLoading || !workId || !name) ? 0.7 : 1 }}
          >
            {isLoading ? 'Verifying...' : 'Verify & Continue'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <button type="button" onClick={onLogout} style={{ ...styles.linkBtn, color: '#94a3b8', textDecoration: 'none', fontSize: '13px' }}>
            <span style={{ textDecoration: 'underline' }}>Log out</span>
          </button>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    padding: '20px'
  },
  card: {
    backgroundColor: '#fff',
    padding: '32px',
    borderRadius: '12px',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
    width: '100%',
    maxWidth: '450px'
  },
  header: {
    textAlign: 'center',
    marginBottom: '24px'
  },
  errorBanner: {
    backgroundColor: '#fef2f2',
    color: '#b91c1c',
    padding: '12px',
    borderRadius: '8px',
    borderLeft: '4px solid #ef4444',
    marginBottom: '20px',
    fontSize: '14px',
    fontWeight: '500'
  },
  scanBtn: {
    backgroundColor: '#1a3a5c',
    color: 'white',
    border: 'none',
    padding: '12px 24px',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    justifyContent: 'center'
  },
  divider: {
    marginTop: '24px',
    borderTop: '1px solid #e2e8f0',
    position: 'relative',
    textAlign: 'center'
  },
  dividerText: {
    backgroundColor: '#fff',
    padding: '0 12px',
    color: '#94a3b8',
    fontSize: '12px',
    fontWeight: 'bold',
    position: 'relative',
    top: '-8px'
  },
  label: {
    display: 'block',
    marginBottom: '6px',
    color: '#475569',
    fontSize: '14px',
    fontWeight: '600'
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    fontSize: '15px',
    boxSizing: 'border-box'
  },
  submitBtn: {
    backgroundColor: '#22c55e',
    color: 'white',
    border: 'none',
    padding: '12px',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
    marginTop: '8px'
  },
  linkBtn: {
    background: 'none',
    border: 'none',
    color: '#64748b',
    textDecoration: 'underline',
    cursor: 'pointer',
    fontSize: '14px'
  }
};

export default IdentityVerification;
