import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const DistributorScorecard = () => {
  const navigate = useNavigate();
  const [scorecards, setScorecards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

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
    <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '56px 8%', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: '1300px', margin: '0 auto' }}>

        <button
          onClick={() => navigate('/dashboard')}
          style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontSize: '14px', fontWeight: 'bold' }}
        >
          &larr; Back to Dashboard
        </button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ color: '#1a3a5c', margin: '0 0 8px 0', fontSize: '28px' }}>Distributor Freshness Scorecard</h1>
            <p style={{ color: '#64748b', margin: 0, fontSize: '15px' }}>Live performance metrics — updated on every dispatch and return event</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '14px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e', animation: 'pulse 2s infinite' }}></div>
            Live &bull; Last updated: {lastRefreshed.toLocaleTimeString()}
          </div>
        </div>

        {/* REGION MOVEMENT SPEED BANNER */}
        {regionSpeeds.length > 0 && (
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{ color: '#1a3a5c', fontSize: '16px', marginBottom: '12px' }}>Region Movement Speeds</h3>
            <div style={{ display: 'flex', overflowX: 'auto', gap: '16px', paddingBottom: '8px' }}>
              {regionSpeeds.map((r, i) => {
                const score = parseFloat(r.avgMovementScore) || 0;
                return (
                  <div key={i} style={{ minWidth: '150px', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e293b', marginBottom: '4px' }}>{r.region}</div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>Avg Speed</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ flex: 1, height: '6px', backgroundColor: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
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
        <div style={{ backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading live scorecards...</div>
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
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    {['Distributor', 'Score', 'Trend', 'Avg FRS', 'Return Rate', 'Rejection Rate', 'Avg Delay'].map(col => (
                      <th key={col} style={{ padding: '18px 20px', color: '#64748b', fontSize: '12px', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {scorecards.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>No distributors found.</td>
                    </tr>
                  ) : (
                    scorecards.map((sc) => (
                      <tr
                        key={sc.distributorId}
                        onClick={() => navigate(`/dashboard/scorecard/${sc.distributorId}`)}
                        style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background-color 0.15s' }}
                        onMouseOver={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                        onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <td style={{ padding: '18px 20px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <div style={{ fontWeight: 'bold', color: '#1a3a5c', fontSize: '14px' }}>{sc.distributorName}</div>
                          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '3px' }}>{sc.region}</div>
                        </td>
                        <td style={{ padding: '18px 20px' }}>
                          <span style={{ fontSize: '22px', fontWeight: 'bold', color: getColor(sc.overallScore, 'overall') }}>
                            {sc.overallScore}
                          </span>
                        </td>
                        <td style={{ padding: '18px 20px', fontSize: '18px' }}>{renderTrend(sc.scoreTrend)}</td>
                        <td style={{ padding: '18px 20px', fontWeight: '600', color: getColor(sc.avgFrsAtDispatch, 'frs'), fontSize: '14px' }}>{sc.avgFrsAtDispatch}</td>
                        <td style={{ padding: '18px 20px', fontWeight: '600', color: getColor(sc.returnRate, 'return'), fontSize: '14px' }}>{sc.returnRate}%</td>
                        <td style={{ padding: '18px 20px', fontWeight: '600', color: getColor(sc.returnRejectionRate, 'rejection'), fontSize: '14px' }}>{sc.returnRejectionRate}%</td>
                        <td style={{ padding: '18px 20px', fontWeight: '600', color: getColor(sc.avgCollectionDelayDays, 'delay'), fontSize: '14px' }}>{sc.avgCollectionDelayDays}d</td>
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
