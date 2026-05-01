import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css'; 

const MarketIntelligenceReports = () => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMarketPulse = async () => {
    try {
      setLoading(true);
      const token = sessionStorage.getItem('token');
      const response = await fetch('/api/market-pulse', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const json = await response.json();
        setData(json);
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

  const getSpeedFill = (speed) => {
    if (speed === 'fast') return '#22c55e';
    if (speed === 'normal') return '#f59e0b';
    if (speed === 'slow') return '#ef4444';
    return '#e2e8f0';
  };

  const getSpeedLabel = (speed) => {
    if (speed === 'fast') return 'Fast';
    if (speed === 'normal') return 'Normal';
    if (speed === 'slow') return 'Slow';
    return 'No data';
  };

  if (loading && !data) {
    return (
      <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#1e293b' }}>
        <p>Loading Regional Market Pulse...</p>
      </div>
    );
  }

  const { regionOverview = [], stockWithVelocity = [], highDemandNotInStock = [], lastUpdated } = data || {};
  const lastUpdateDate = lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : new Date().toLocaleTimeString();

  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '40px 5%', fontFamily: 'sans-serif', color: '#1e293b' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
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
            <p style={{ color: '#64748b', margin: 0, fontSize: '15px' }}>Where your stock is needed most</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#64748b', fontSize: '13px', marginBottom: '4px' }}>
              Last updated: {lastUpdateDate}
            </div>
            <button 
              onClick={fetchMarketPulse}
              style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', color: '#1e293b', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}
            >
              <span style={{ fontSize: '16px' }}>↻</span> Refresh
            </button>
          </div>
        </div>

        {/* SECTION 1: QUICK REGION SNAPSHOT */}
        <div style={{ marginBottom: '40px' }}>
          <h2 style={{ fontSize: '14px', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px', marginBottom: '12px' }}>Region Overview</h2>
          <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              {regionOverview.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px' }}>
                  <span style={{ width: '80px', fontWeight: 'bold', color: '#1e293b' }}>{r.region}</span>
                  <span style={{ fontSize: '16px' }}>{r.icon}</span>
                  <span style={{ color: '#475569' }}>{r.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* SECTION 2: YOUR STOCK - WHERE TO SEND IT */}
        <div style={{ marginBottom: '40px' }}>
          <h2 style={{ fontSize: '20px', color: '#1a3a5c', margin: '0 0 4px 0' }}>Your Current Stock — Where to Send It</h2>
          <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 20px 0' }}>Based on field reports from the last 30 days</p>

          {stockWithVelocity.length === 0 ? (
            <div style={{ backgroundColor: '#fff', padding: '30px', textAlign: 'center', borderRadius: '12px', border: '1px solid #e2e8f0', color: '#64748b' }}>
              No active batches in the warehouse right now.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '24px' }}>
              {stockWithVelocity.map(product => (
                <div key={product.sku} style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                  
                  {/* Card Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                    <div style={{ flex: 1, paddingRight: '12px' }}>
                      <h3 style={{ margin: 0, fontSize: '22px', color: '#1e293b', lineHeight: '1.2' }}>{product.productName}</h3>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>in warehouse</div>
                    </div>
                    <div style={{ backgroundColor: '#f1f5f9', color: '#475569', padding: '6px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                      {product.batchCount} batches
                    </div>
                  </div>

                  {/* Demand by Region Label */}
                  <div style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#94a3b8', marginBottom: '12px' }}>
                    Demand By Region:
                  </div>

                  {/* Region Rows */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
                    {product.regions.map(r => (
                      <div key={r.region} style={{ display: 'flex', alignItems: 'center', height: '36px' }}>
                        <div style={{ width: '100px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: '500', color: '#334155' }}>
                          <span style={{ fontSize: '16px', width: '20px', textAlign: 'center' }}>{r.icon}</span>
                          {r.region}
                        </div>
                        
                        <div style={{ flex: 1, margin: '0 16px', backgroundColor: '#f1f5f9', height: '10px', borderRadius: '5px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${r.barWidth}%`, backgroundColor: getSpeedFill(r.speed), transition: 'width 0.5s ease-in-out' }}></div>
                        </div>

                        <div style={{ width: '85px', display: 'flex', justifyContent: 'flex-end', alignItems: 'baseline', gap: '6px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569', textAlign: 'right' }}>
                            {getSpeedLabel(r.speed)}
                          </span>
                          <span style={{ fontSize: '11px', color: '#94a3b8', width: '20px', textAlign: 'right' }}>
                            {r.avgScore !== null ? r.avgScore : '—'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Recommendation Box */}
                  <div style={{ backgroundColor: '#1e3a5f', color: '#ffffff', borderRadius: '6px', padding: '12px 16px', fontSize: '13px', lineHeight: '1.4', display: 'flex', gap: '10px' }}>
                    <span style={{ fontSize: '16px' }}>💡</span>
                    <div>{product.recommendation}</div>
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>

        {/* SECTION 3: PRODUCTS WITH NO WAREHOUSE STOCK */}
        {highDemandNotInStock && highDemandNotInStock.length > 0 && (
          <div>
            <h2 style={{ fontSize: '20px', color: '#1a3a5c', margin: '0 0 4px 0' }}>High Demand — Not in Stock</h2>
            <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 16px 0' }}>These products are moving fast but you have no batches to send</p>

            <div style={{ backgroundColor: '#fef9c3', border: '1px solid #f59e0b', borderRadius: '12px', overflow: 'hidden' }}>
              {highDemandNotInStock.map((item, i) => (
                <div key={item.sku} style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  padding: '16px 20px', 
                  borderBottom: i < highDemandNotInStock.length - 1 ? '1px solid #fde047' : 'none' 
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#854d0e', width: '200px' }}>
                      {item.productName}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#9a3412', fontSize: '14px' }}>
                      <span style={{ fontSize: '16px' }}>🔥</span>
                      Fast in {item.fastRegions.join(', ')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span style={{ fontSize: '13px', color: '#854d0e', fontStyle: 'italic' }}>
                      Consider flagging to procurement
                    </span>
                    <div style={{ backgroundColor: '#fffbeb', color: '#b45309', padding: '4px 12px', borderRadius: '16px', fontSize: '12px', fontWeight: 'bold', border: '1px solid #fde68a' }}>
                      0 batches
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default MarketIntelligenceReports;
