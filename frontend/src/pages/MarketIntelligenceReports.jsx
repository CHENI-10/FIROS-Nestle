import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css'; // Reuse existing dashboard theme classes

const MarketIntelligenceReports = () => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  const fetchMarketPulse = async () => {
    try {
      const token = sessionStorage.getItem('token');
      const response = await fetch('/api/market-pulse', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const json = await response.json();
        setData(json);
        setLastRefreshed(new Date());
      }
    } catch (error) {
      console.error('Error fetching market pulse:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarketPulse();
    const interval = setInterval(fetchMarketPulse, 300000); // 5 minutes
    return () => clearInterval(interval);
  }, []);

  const timeAgo = (date) => {
    const diffMs = new Date() - new Date(date);
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}m ago`;
    return `${Math.floor(diffMins / 60)}h ago`;
  };

  if (loading && !data) {
    return (
      <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#1e293b' }}>
        <p>Loading Regional Market Pulse...</p>
      </div>
    );
  }

  const regions = ['Colombo', 'Kandy', 'Galle', 'Jaffna', 'Kurunegala'];

  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '40px 5%', fontFamily: 'sans-serif', color: '#1e293b' }}>
      <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
        
        <button 
          onClick={() => navigate('/dashboard')}
          style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', fontSize: '14px', fontWeight: 'bold' }}
        >
          &larr; Back to Dashboard
        </button>

        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ color: '#1a3a5c', margin: '0 0 8px 0', fontSize: '28px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              Regional Market Pulse
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', backgroundColor: '#e2e8f0', padding: '4px 10px', borderRadius: '16px', border: '1px solid #cbd5e1', color: '#334155' }}>
                <span style={{ width: '8px', height: '8px', backgroundColor: '#22c55e', borderRadius: '50%', display: 'inline-block', boxShadow: '0 0 8px #22c55e' }}></span>
                LIVE
              </span>
            </h1>
            <p style={{ color: '#64748b', margin: 0, fontSize: '15px' }}>Strategic demand identification based on real-time field reports</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#64748b', fontSize: '13px', marginBottom: '4px' }}>
              Last updated: {lastRefreshed.toLocaleTimeString()}
            </div>
            <button 
              onClick={fetchMarketPulse}
              style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', color: '#1e293b', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
            >
              ↻ Refresh
            </button>
          </div>
        </div>

        {/* REGIONAL CARDS GRID */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '24px' }}>
          {regions.map(region => {
            const regionData = data?.byRegion[region] || { products: [], activities: [] };
            
            const fast = regionData.products.filter(p => p.speed === 'fast');
            const normal = regionData.products.filter(p => p.speed === 'normal');
            const slow = regionData.products.filter(p => p.speed === 'slow');
            const emptyShelves = regionData.products.filter(p => p.emptyShelfCount > 0).sort((a,b) => b.emptyShelfCount - a.emptyShelfCount);
            
            let lastUpdate = null;
            if (regionData.activities.length > 0) {
              lastUpdate = regionData.activities[0].last_submission;
            }

            return (
              <div key={region} style={{ 
                backgroundColor: '#ffffff', 
                borderRadius: '12px', 
                border: '1px solid #e2e8f0',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
              }}>
                {/* Card Header */}
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc' }}>
                  <h2 style={{ margin: 0, fontSize: '20px', color: '#1a3a5c' }}>{region}</h2>
                  {lastUpdate && (
                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                      Updated {timeAgo(lastUpdate)}
                    </span>
                  )}
                </div>

                <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  
                  {/* FAST MOVERS */}
                  <div>
                    <h3 style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      🔥 Fast Moving
                    </h3>
                    {fast.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {fast.map(p => (
                          <div key={p.sku} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f1f5f9', padding: '10px 12px', borderRadius: '8px', borderLeft: '3px solid #22c55e' }}>
                            <span style={{ fontSize: '14px', fontWeight: '500', color: '#1e293b' }}>{p.productName}</span>
                            <span style={{ fontSize: '12px', backgroundColor: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>{p.avgScore} score</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', fontStyle: 'italic' }}>No fast moving products identified.</p>
                    )}
                  </div>

                  {/* NORMAL MOVERS */}
                  <div>
                    <h3 style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      ⚡ Normal
                    </h3>
                    {normal.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {normal.map(p => (
                          <div key={p.sku} style={{ fontSize: '13px', backgroundColor: '#f1f5f9', padding: '6px 12px', borderRadius: '6px', borderLeft: '3px solid #f59e0b', color: '#475569' }}>
                            {p.productName}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', fontStyle: 'italic' }}>None currently.</p>
                    )}
                  </div>

                  {/* SLOW MOVERS */}
                  <div>
                    <h3 style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      🐢 Slow Moving
                    </h3>
                    {slow.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {slow.map(p => (
                          <div key={p.sku} style={{ fontSize: '13px', backgroundColor: '#f1f5f9', padding: '6px 12px', borderRadius: '6px', borderLeft: '3px solid #ef4444', color: '#475569' }}>
                            {p.productName}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', fontStyle: 'italic' }}>None currently.</p>
                    )}
                  </div>

                  {/* EMPTY SHELF ALERTS */}
                  {emptyShelves.length > 0 && (
                    <div style={{ backgroundColor: '#fef2f2', padding: '12px', borderRadius: '8px', border: '1px solid #fecaca' }}>
                      <h3 style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        🚨 Empty Shelf Alerts
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {emptyShelves.map(p => (
                          <div key={p.sku} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#1e293b' }}>
                            <span>{p.productName}</span>
                            <span style={{ color: '#b91c1c', fontWeight: 'bold' }}>{p.emptyShelfCount} reports</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>

                {/* Card Footer - Rep Activity */}
                <div style={{ padding: '16px 20px', borderTop: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' }}>Recent Field Activity</h4>
                  {regionData.activities.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {regionData.activities.slice(0, 3).map((act, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                          <span style={{ color: '#475569', fontWeight: '500' }}>{act.rep_name}</span>
                          <span style={{ color: '#94a3b8' }}>{timeAgo(act.last_submission)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>No recent activity.</p>
                  )}
                </div>

              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
};

export default MarketIntelligenceReports;
