import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const DistributorScorecardDetail = () => {
  const { distributorId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('performance');
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

  const fetchData = async () => {
    try {
      const token = sessionStorage.getItem('token');
      const response = await fetch(`/api/scorecard/${distributorId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setData(await response.json());
      }
    } catch (error) {
      console.error('Error fetching scorecard detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const userRole = JSON.parse(atob(sessionStorage.getItem('token').split('.')[1])).role;

  useEffect(() => {
    fetchData();
    // AC8: If admin, force insights tab
    if (userRole === 'admin') {
      setActiveTab('insights');
    }
    const intervalId = setInterval(fetchData, 60000);
    return () => clearInterval(intervalId);
  }, [distributorId, userRole]);

  if (loading) {
      return (
          <div style={{ minHeight: '100vh', backgroundColor: isDark ? '#0f172a' : '#faf7f2', padding: '40px' }}>
              <style>{`
                  @keyframes pulseSkeleton { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
                  .skeleton-item { animation: pulseSkeleton 1.5s infinite ease-in-out; }
                  .loading-msg {
                      background: linear-gradient(135deg, #1a3a5c 0%, #295380 100%);
                      color: #faf7f2; padding: 12px 24px; border-radius: 30px; display: inline-block;
                      font-weight: 800; font-size: 16px; box-shadow: 0 4px 15px rgba(26, 58, 92, 0.4);
                      letter-spacing: 0.5px; border: 1px solid rgba(200, 169, 110, 0.3);
                      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 9999;
                  }
              `}</style>
              <div style={{ textAlign: 'center' }} className="skeleton-item">
                  <div className="loading-msg">📈 Compiling Distributor Scorecard...</div>
              </div>
              <div style={{ maxWidth: '900px', margin: '0 auto' }}>
                  <div className="skeleton-item" style={{ height: '100px', backgroundColor: isDark ? '#1e293b' : '#fdfaf5', borderRadius: '12px', marginBottom: '32px', border: `1px solid ${isDark ? '#334155' : '#e8dfd0'}` }} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '32px' }}>
                      {[1, 2, 3, 4].map(i => <div key={i} className="skeleton-item" style={{ height: '120px', backgroundColor: isDark ? '#1e293b' : '#fdfaf5', borderRadius: '12px', border: `1px solid ${isDark ? '#334155' : '#e8dfd0'}` }} />)}
                  </div>
                  <div className="skeleton-item" style={{ height: '300px', backgroundColor: 'white', borderRadius: '12px' }} />
              </div>
          </div>
      );
  }
  if (!data) return <div style={{ padding: '60px', textAlign: 'center', fontFamily: 'sans-serif', color: '#64748b' }}>Distributor not found.</div>;

  const { distributorName, region, metrics, historicalTrend, recentDispatches, recentReturns, regionMovementSpeeds, localMovementScore } = data;

  // Safe fallbacks for counts to prevent NaN
  const safeTotalDispatches = parseInt(metrics.totalDispatches) || 0;
  const safeTotalReturns = parseInt(metrics.totalReturns) || 0;
  const successfullySent = safeTotalDispatches - safeTotalReturns;

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

  const getClassification = () => {
    if (metrics.scoreTrend === 'up') return { label: 'IMPROVING', color: '#22c55e', bg: '#f0fdf4' };
    if (metrics.scoreTrend === 'down') return { label: 'DECLINING', color: '#ef4444', bg: '#fef2f2' };
    return { label: 'STABLE', color: '#64748b', bg: '#faf7f2' };
  };

  const getRecommendation = () => {
    const score = parseFloat(metrics.overallScore);
    if (score >= 80) return { title: 'Prioritise Renewal', color: '#22c55e', bg: '#f0fdf4', icon: '✅', text: 'Distributor is maintaining high freshness standards and low return rates. Recommend long-term contract extension.' };
    if (score >= 60) return { title: 'Delay Notice', color: '#f59e0b', bg: '#fffbeb', icon: '⚠️', text: 'Performance is stable but requires minor adjustments in collection delay and storage practices before renewal.' };
    return { title: 'Flag for Review', color: '#ef4444', bg: '#fef2f2', icon: '🚨', text: 'Significant performance risks detected. Recommend detailed operational audit or procurement review before contract expiration.' };
  };

  const renderTrendArrow = (trend) => {
    if (trend === 'up') return <span style={{ color: '#22c55e' }}>▲</span>;
    if (trend === 'down') return <span style={{ color: '#ef4444' }}>▼</span>;
    return <span style={{ color: '#94a3b8' }}>▶</span>;
  };

  const chartData = [
    ...historicalTrend.map(h => ({ period: h.period_label, score: parseFloat(h.overall_score) })),
    { period: 'Live', score: parseFloat(metrics.overallScore) }
  ];

  const renderPerformanceTab = () => (
    <div style={{ animation: 'fadeIn 0.4s ease' }}>
      {/* 2x2 GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '32px' }}>
        {[
          { label: 'Avg FRS at Dispatch', value: metrics.avgFrsAtDispatch, type: 'frs', icon: '🎯' },
          { label: 'Return Rate %', value: metrics.returnRate, type: 'return', icon: '🔄' },
          { label: 'Avg Collection Delay', value: metrics.avgCollectionDelayDays + 'd', type: 'delay', icon: '🕒' },
          { label: 'Return Rejection Rate', value: metrics.rejectionRate || '0%', type: 'rejection', icon: '🚫' }
        ].map((m, i) => (
          <div key={i} style={{ backgroundColor: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.7)', padding: '24px', borderRadius: '12px', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>{m.label}</span>
              <span>{m.icon}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <div style={{ fontSize: '32px', fontWeight: '900', color: isDark ? '#f1f5f9' : '#1e293b' }}>{m.value}</div>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: getColor(m.value, m.type) }} />
            </div>
          </div>
        ))}
      </div>

      {/* VOLUME HISTORY CHART */}
      <div style={{ backgroundColor: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.7)', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, borderRadius: '12px', padding: '24px', marginBottom: '32px' }}>
        <h3 style={{ margin: '0 0 24px 0', fontSize: '15px', color: isDark ? '#f1f5f9' : '#1e293b' }}>Your History With Them</h3>
        <div style={{ height: '300px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={historicalTrend} barCategoryGap="35%" margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="period_label" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                cursor={{ fill: '#faf7f2' }}
              />
              <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '20px', fontSize: '12px' }} iconType="circle" />
              <Bar name="Dispatches" dataKey="dispatched_count" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={50} />
              <Bar name="Returns" dataKey="returned_count" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={50} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );

  const getMovementLabel = (score) => {
    const s = parseFloat(score);
    if (isNaN(s)) return 'N/A';
    if (s >= 2.5) return 'FAST 🚀';
    if (s >= 1.5) return 'STABLE 📊';
    return 'SLOW 📉';
  };

  const renderInsightsTab = () => {
    const classification = getClassification();
    const recommendation = getRecommendation();
    const insights = [];
    if (parseFloat(metrics.returnRate) > 20) insights.push("Return rate above acceptable threshold — investigate root cause.");
    if (parseFloat(metrics.avgCollectionDelayDays) > 5) insights.push("Collection delays are impacting freshness scores.");
    if (parseFloat(metrics.avgFrsAtDispatch) < 70) insights.push("Batches arriving at below-average FRS — review dispatch prioritisation.");
    if (parseFloat(metrics.lossContributionPercent) > 15) insights.push("High loss contribution detected — investigate handling quality.");
    if (insights.length === 0) insights.push("Distributor is consistently meeting freshness and efficiency targets.");

    return (
      <div style={{ animation: 'fadeIn 0.4s ease' }}>
        {/* AC7: STRATEGIC INSIGHTS GRID */}
        <div style={{ marginBottom: '24px' }}>
          {/* AC7: REGIONAL MOVEMENT */}
          <div style={{ backgroundColor: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.7)', padding: '24px', borderRadius: '12px', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.5px' }}>Regional Market Pulse</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
              <div style={{ fontSize: '24px', fontWeight: '900', color: isDark ? '#C8A96E' : '#5c3a21' }}>{getMovementLabel(localMovementScore)}</div>
              <div style={{ fontSize: '14px', color: '#64748b', fontWeight: 'bold' }}>({localMovementScore})</div>
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '8px' }}>Latest demand context for {region}</div>
          </div>
        </div>


        {/* IMPACT SUMMARY */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
          <div style={{ backgroundColor: isDark ? '#1e293b' : '#fff', padding: '20px', borderRadius: '12px', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, textAlign: 'center' }}>
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Total Dispatches</div>
            <div style={{ fontSize: '28px', fontWeight: '900', color: isDark ? '#f1f5f9' : '#1e293b' }}>{safeTotalDispatches}</div>
          </div>
          <div style={{ backgroundColor: isDark ? '#1e293b' : '#fff', padding: '20px', borderRadius: '12px', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, textAlign: 'center' }}>
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Batches Returned</div>
            <div style={{ fontSize: '28px', fontWeight: '900', color: '#ef4444' }}>{safeTotalReturns}</div>
          </div>
        </div>

        {/* STATUS & DATA AGE */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div style={{ backgroundColor: classification.bg, color: classification.color, padding: '8px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: '900', border: `1px solid ${classification.color}` }}>
            {classification.label}
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
            {metrics.totalDispatches < 10 ? `Limited data — based on ${metrics.totalDispatches} dispatches` : 'Based on all available dispatch history'}
          </div>
        </div>

        {/* RECOMMENDED ACTION */}
        <div style={{ backgroundColor: recommendation.bg, border: `1px solid ${recommendation.color}`, borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <span style={{ fontSize: '24px' }}>{recommendation.icon}</span>
            <h4 style={{ margin: 0, color: recommendation.color, fontSize: '18px', fontWeight: '900' }}>{recommendation.title}</h4>
          </div>
          <p style={{ margin: 0, color: isDark ? '#94a3b8' : '#475569', fontSize: '14px', lineHeight: 1.6 }}>{recommendation.text}</p>
        </div>
        
        {/* WHY THIS MATTERS */}
        <div style={{ backgroundColor: isDark ? '#1e293b' : '#fff', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, borderRadius: '12px', padding: '24px' }}>
          <h4 style={{ margin: '0 0 16px 0', fontSize: '15px', color: isDark ? '#f1f5f9' : '#1e293b' }}>Why this matters</h4>
          <ul style={{ paddingLeft: '20px', margin: 0 }}>
            {insights.map((ins, i) => (
              <li key={i} style={{ fontSize: '14px', color: '#64748b', marginBottom: '10px', lineHeight: 1.5 }}>{ins}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  };

  return (
    <div style={{ backgroundColor: isDark ? '#0f172a' : '#faf7f2', minHeight: '100vh', color: isDark ? '#f1f5f9' : '#1e293b' }}>
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
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '16px 5% 40px 5%', fontFamily: 'sans-serif' }}>
        <style>{`
          @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
        `}</style>

        <button onClick={() => navigate('/dashboard/my-distributors')} style={{ background: 'none', border: 'none', color: isDark ? '#94a3b8' : '#64748b', cursor: 'pointer', marginBottom: '24px', fontSize: '14px', fontWeight: 'bold' }}>
          &larr; Back to Fleet
        </button>

        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '40px' }}>
          <div>
            <h1 style={{ color: isDark ? '#f1f5f9' : '#1a3a5c', margin: '0 0 4px 0', fontSize: '32px', fontWeight: '900' }}>{distributorName}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ backgroundColor: '#e2e8f0', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', color: '#475569' }}>{region}</span>
              <span style={{ fontSize: '18px' }}>{renderTrendArrow(metrics.scoreTrend)}</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', border: `6px solid ${getColor(metrics.overallScore, 'overall')}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: '900', color: '#1a3a5c' }}>
              {metrics.overallScore}
            </div>
            <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#94a3b8', marginTop: '8px', textTransform: 'uppercase' }}>Overall Rating</div>
          </div>
        </div>

        {/* ROLE-BASED LAYOUT ENGINE */}
        {userRole === 'admin' ? (
          <>
            {/* ADMIN TABS: To prevent scrolling for senior management */}
            <div style={{ display: 'flex', gap: '32px', borderBottom: '1px solid #e2e8f0', marginBottom: '32px' }}>
              <button
                onClick={() => setActiveTab('insights')}
                style={{
                  background: 'none', border: 'none', padding: '12px 0', cursor: 'pointer',
                  fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px',
                  color: activeTab === 'insights' ? '#5c3a21' : '#94a3b8',
                  borderBottom: activeTab === 'insights' ? '3px solid #5c3a21' : '3px solid transparent'
                }}
              >
                Contract Review
              </button>
              <button
                onClick={() => setActiveTab('performance')}
                style={{
                  background: 'none', border: 'none', padding: '12px 0', cursor: 'pointer',
                  fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px',
                  color: activeTab === 'performance' ? '#5c3a21' : '#94a3b8',
                  borderBottom: activeTab === 'performance' ? '3px solid #5c3a21' : '3px solid transparent'
                }}
              >
                Performance Evidence
              </button>
            </div>

            <div style={{ animation: 'fadeIn 0.3s ease' }}>
              {activeTab === 'insights' ? renderInsightsTab() : renderPerformanceTab()}
            </div>
          </>
        ) : (
          <>
            {/* MANAGER VIEW: Pure Operational One-Pager */}
            <div style={{ marginBottom: '40px' }}>
              <h2 style={{ fontSize: '14px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '20px', borderBottom: '2px solid #e2e8f0', paddingBottom: '8px' }}>
                Operational Fleet Performance
              </h2>
              {renderPerformanceTab()}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DistributorScorecardDetail;
