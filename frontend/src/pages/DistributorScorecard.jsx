import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const DistributorScorecard = () => {
  const navigate = useNavigate();
  const [scorecards, setScorecards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const [theme, setTheme] = useState(sessionStorage.getItem('theme') || 'light');
  const isDark = theme === 'dark';

  useEffect(() => {
    const syncTheme = () => setTheme(sessionStorage.getItem('theme') || 'light');
    window.addEventListener('theme-changed', syncTheme);
    return () => window.removeEventListener('theme-changed', syncTheme);
  }, []);

  const toggleTheme = () => {
    const nt = theme === 'dark' ? 'light' : 'dark';
    setTheme(nt);
    sessionStorage.setItem('theme', nt);
    window.dispatchEvent(new Event('theme-changed'));
  };

  const fetchScorecards = async () => {
    try {
      const token = sessionStorage.getItem('token');
      const response = await fetch('/api/scorecard', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setScorecards(data);
        setLastRefreshed(new Date());
      }
    } catch (error) {
      console.error('Error fetching scorecards:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScorecards();
    const intervalId = setInterval(fetchScorecards, 60000);
    return () => clearInterval(intervalId);
  }, []);

  const getColor = (value, type) => {
    const v = parseFloat(value);
    if (type === 'frs') {
      if (v >= 75) return '#22c55e';
      if (v >= 50) return '#f59e0b';
      return '#ef4444';
    }
    if (type === 'return') {
      if (v < 10) return '#22c55e';
      if (v <= 25) return '#f59e0b';
      return '#ef4444';
    }
    if (type === 'rejection') {
      if (v < 15) return '#22c55e';
      if (v <= 35) return '#f59e0b';
      return '#ef4444';
    }
    if (type === 'delay') {
      if (v < 2) return '#22c55e';
      if (v <= 5) return '#f59e0b';
      return '#ef4444';
    }
    if (type === 'overall') {
      if (v >= 80) return '#22c55e';
      if (v >= 60) return '#f59e0b';
      return '#ef4444';
    }
    return '#1e293b';
  };

  const getMovementColor = (v) => {
    if (v > 2.5) return '#22c55e';
    if (v >= 1.5) return '#f59e0b';
    return '#ef4444';
  };

  const renderTrend = (trend) => {
    if (trend === 'up') return <span style={{ color: '#22c55e', fontWeight: 'bold' }}>↑</span>;
    if (trend === 'down') return <span style={{ color: '#ef4444', fontWeight: 'bold' }}>↓</span>;
    return <span style={{ color: '#94a3b8', fontWeight: 'bold' }}>→</span>;
  };

  const regionSpeeds = scorecards.length > 0 && scorecards[0].regionMovementSpeeds
    ? scorecards[0].regionMovementSpeeds
    : [];

  return (
    <div style={{ backgroundColor: isDark ? '#0f172a' : '#faf7f2', minHeight: '100vh', fontFamily: "'Outfit', sans-serif", color: isDark ? '#f1f5f9' : '#1e293b' }}>
      <nav style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          padding: '20px 40px',
          background: 'transparent',
          position: 'sticky',
          top: 0,
          zIndex: 100
      }}>
          <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '15px',
              background: isDark ? 'rgba(30, 41, 59, 0.4)' : 'rgba(255, 255, 255, 0.4)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              padding: '8px 15px',
              borderRadius: '20px',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              boxShadow: '0 4px 15px rgba(0,0,0,0.05)'
          }}>
              <button onClick={toggleTheme} style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  fontSize: '16px',
                  cursor: 'pointer',
                  borderRadius: '50%',
                  width: '34px',
                  height: '34px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isDark ? '#f8fafc' : '#1e293b'
              }}>
                  {isDark ? '☀️' : '🌙'}
              </button>
              <button onClick={() => { sessionStorage.clear(); navigate('/login'); }} style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  color: '#ef4444',
                  fontWeight: '700',
                  padding: '6px 14px',
                  fontSize: '13px',
                  borderRadius: '12px',
                  cursor: 'pointer'
              }}>Logout</button>
          </div>
      </nav>

      <div style={{ maxWidth: '1300px', margin: '0 auto', padding: '16px 8% 56px 8%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ color: isDark ? '#f8fafc' : '#1a3a5c', margin: '0 0 8px 0', fontSize: '28px', fontWeight: '900' }}>Distributor Freshness Scorecard</h1>
            <p style={{ color: isDark ? '#94a3b8' : '#64748b', margin: 0, fontSize: '15px' }}>Live performance metrics — updated on every dispatch and return event</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: isDark ? '#94a3b8' : '#64748b', fontSize: '14px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e', animation: 'pulse 2s infinite' }}></div>
            Live &bull; Last updated: {lastRefreshed.toLocaleTimeString()}
          </div>
        </div>

        {/* REGION MOVEMENT SPEED BANNER */}
        {regionSpeeds.length > 0 && (
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{ color: isDark ? '#f8fafc' : '#1a3a5c', fontSize: '16px', marginBottom: '12px' }}>Region Movement Speeds</h3>
            <div style={{ display: 'flex', overflowX: 'auto', gap: '16px', paddingBottom: '8px' }}>
              {regionSpeeds.map((r, i) => {
                const score = parseFloat(r.avgMovementScore) || 0;
                return (
                  <div key={i} style={{ minWidth: '150px', backgroundColor: isDark ? '#1e293b' : '#fff', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, borderRadius: '8px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: isDark ? '#f1f5f9' : '#1e293b', marginBottom: '4px' }}>{r.region}</div>
                    <div style={{ fontSize: '12px', color: isDark ? '#94a3b8' : '#64748b', marginBottom: '8px' }}>Avg Speed</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ flex: 1, height: '6px', backgroundColor: isDark ? '#334155' : '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${(score / 5) * 100}%`, height: '100%', backgroundColor: getMovementColor(score) }}></div>
                      </div>
                      <span style={{ fontSize: '16px', fontWeight: 'bold', color: getMovementColor(score) }}>{score.toFixed(1)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SCORECARD TABLE */}
        <div style={{ backgroundColor: isDark ? '#1e293b' : 'rgba(255, 255, 255, 0.5)', borderRadius: '24px', boxShadow: '0 10px 30px rgba(0,0,0,0.03)', overflow: 'hidden', border: `1px solid ${isDark ? '#334155' : 'rgba(200, 169, 110, 0.2)'}` }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center' }}>
                <style>{`
                    @keyframes pulseSkeleton { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
                    .skeleton-item { animation: pulseSkeleton 1.5s infinite ease-in-out; }
                    .loading-msg {
                        background: linear-gradient(135deg, #1a3a5c 0%, #295380 100%);
                        color: #f8fafc; padding: 12px 24px; border-radius: 30px; display: inline-block;
                        font-weight: 800; font-size: 16px; box-shadow: 0 4px 15px rgba(26, 58, 92, 0.4);
                        letter-spacing: 0.5px; border: 1px solid rgba(200, 169, 110, 0.3);
                        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 9999;
                    }
                `}</style>
                <div className="skeleton-item">
                    <div className="loading-msg">📊 Compiling Live Scorecards...</div>
                </div>
                <div style={{ maxWidth: '100%', margin: '0 auto' }}>
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="skeleton-item" style={{ height: '60px', backgroundColor: isDark ? '#334155' : '#fdfaf5', borderRadius: '8px', marginBottom: '12px', border: `1px solid ${isDark ? '#475569' : '#e8dfd0'}` }} />
                    ))}
                </div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '28%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '13%' }} />
                  <col style={{ width: '13%' }} />
                  <col style={{ width: '13%' }} />
                  <col style={{ width: '13%' }} />
                </colgroup>
                <thead>
                  <tr style={{ backgroundColor: isDark ? '#334155' : '#f8fafc', borderBottom: `2px solid ${isDark ? '#475569' : '#e2e8f0'}` }}>
                    {['Distributor', 'Score', 'Trend', 'Avg FRS', 'Returns', 'Delays', 'Misses'].map(col => (
                      <th key={col} style={{ padding: '18px 20px', color: isDark ? '#94a3b8' : '#64748b', fontSize: '12px', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {scorecards.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ padding: '40px', textAlign: 'center', color: isDark ? '#94a3b8' : '#64748b' }}>No distributors found.</td>
                    </tr>
                  ) : (
                    scorecards.map((sc) => (
                      <tr
                        key={sc.distributorId}
                        onClick={() => navigate(`/dashboard/scorecard/${sc.distributorId}`)}
                        style={{ borderBottom: `1px solid ${isDark ? '#334155' : '#f1f5f9'}`, cursor: 'pointer', transition: 'background-color 0.15s' }}
                        onMouseOver={e => e.currentTarget.style.backgroundColor = isDark ? '#334155' : '#f8fafc'}
                        onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <td style={{ padding: '18px 20px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <div style={{ fontWeight: 'bold', color: isDark ? '#f1f5f9' : '#1a3a5c', fontSize: '14px' }}>{sc.distributorName}</div>
                          <div style={{ fontSize: '12px', color: isDark ? '#94a3b8' : '#64748b', marginTop: '3px' }}>{sc.region}</div>
                        </td>
                        <td style={{ padding: '18px 20px' }}>
                          <span style={{ fontSize: '22px', fontWeight: 'bold', color: getColor(sc.overallScore, 'overall') }}>
                            {sc.overallScore}
                          </span>
                        </td>
                        <td style={{ padding: '18px 20px', fontSize: '18px' }}>{renderTrend(sc.scoreTrend)}</td>
                        <td style={{ padding: '18px 20px', fontWeight: '600', color: getColor(sc.avgFrsAtDispatch, 'frs'), fontSize: '14px' }}>{sc.avgFrsAtDispatch}</td>
                        <td style={{ padding: '18px 20px', fontWeight: '600', color: getColor(sc.returnRate, 'return'), fontSize: '14px' }}>{sc.returnRate}%</td>
                        <td style={{ padding: '18px 20px', fontWeight: '600', color: getColor(sc.avgCollectionDelayDays, 'delay'), fontSize: '14px' }}>{sc.avgCollectionDelayDays}d</td>
                        <td style={{ padding: '18px 20px', fontWeight: '700', color: sc.missCount > 0 ? '#ef4444' : (isDark ? '#94a3b8' : '#64748b'), fontSize: '15px' }}>{sc.missCount || 0}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <style>{`
          @keyframes pulse {
            0% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(1.2); }
            100% { opacity: 1; transform: scale(1); }
          }
        `}</style>
      </div>
    </div>
  );
};

export default DistributorScorecard;
