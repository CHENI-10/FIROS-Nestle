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
    if (speed === 'out_of_stock') return '#dc2626'; // High-alert red
    if (speed === 'fast') return '#22c55e';
    if (speed === 'moderate') return '#f59e0b';
    if (speed === 'slow') return '#ef4444';
    return '#e2e8f0';
  };

  const getSpeedLabel = (speed) => {
    if (speed === 'fast') return 'Fast';
    if (speed === 'moderate') return 'Moderate';
    if (speed === 'slow') return 'Slow';
    return 'No data';
  };

  const exportProcurementList = () => {
    const { highDemandNotInStock = [] } = data || {};
    if (highDemandNotInStock.length === 0) return;

    const reportTitle = "MARKET INTELLIGENCE: URGENT PROCUREMENT REPLENISHMENT REPORT";
    const generatedAt = `Generated on: ${new Date().toLocaleString()}`;
    const period = "Analysis Period: Last 30 Days of Field Reports";
    
    const headers = ['PRODUCT NAME', 'SKU ID', 'URGENT REGIONS', 'DAYS OUT OF STOCK', 'URGENCY LEVEL'];
    const rows = highDemandNotInStock.map(p => [
      p.productName.toUpperCase() || 'UNKNOWN',
      p.sku || 'N/A',
      p.fast_regions || 'None',
      (p.days_out_of_stock !== null && !isNaN(p.days_out_of_stock)) ? `${Math.round(p.days_out_of_stock)} Days` : 'N/A (Critical)',
      (p.urgency_tier || 'low').toUpperCase()
    ]);

    // Build professional CSV structure
    const csvRows = [
      [reportTitle],
      [generatedAt],
      [period],
      [], // Spacing
      headers,
      ...rows,
      [], // Spacing
      ["--- END OF REPORT ---"]
    ];

    const csvContent = csvRows.map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    const date = new Date().toISOString().split('T')[0];
    
    link.setAttribute("href", url);
    link.setAttribute("download", `Procurement_Flag_Report_${date}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

        {/* CRITICAL STOCK-OUT ALERT BANNER */}
        {stockWithVelocity.some(p => p.regions.some(r => r.speed === 'out_of_stock')) && (
          <div style={{ backgroundColor: '#fee2e2', border: '1px solid #ef4444', borderRadius: '12px', padding: '16px 20px', marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 4px 6px -1px rgba(220, 38, 38, 0.1)' }}>
            <div style={{ fontSize: '24px' }}>🚨</div>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#991b1b', fontWeight: 'bold' }}>CRITICAL STOCK-OUT ALERTS</h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#b91c1c' }}>
                Sales Reps are reporting empty shelves for: 
                {stockWithVelocity
                  .filter(p => p.regions.some(r => r.speed === 'out_of_stock'))
                  .map(p => {
                    const oosR = p.regions.filter(r => r.speed === 'out_of_stock').map(r => r.region);
                    return ` ${p.productName} (${oosR.join(', ')})`;
                  }).join(', ')}
              </p>
            </div>
            <button 
              onClick={() => {
                const firstOos = stockWithVelocity.find(p => p.regions.some(r => r.speed === 'out_of_stock'));
                if (firstOos) document.getElementById(`product-card-${firstOos.sku}`)?.scrollIntoView({ behavior: 'smooth' });
              }}
              style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              View Alerts
            </button>
          </div>
        )}

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
              {stockWithVelocity.map(product => {
                const noDataRegions = product.regions.filter(r => r.speed === 'no_data').map(r => r.region);
                const dataRegions = product.regions.filter(r => r.speed !== 'no_data');

                return (
                  <div 
                    key={product.sku} 
                    id={`product-card-${product.sku}`}
                    style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', position: 'relative' }}
                  >
                    {/* A) Dispatch Priority Badge */}
                    <div style={{ 
                      display: 'inline-block', 
                      padding: '4px 8px', 
                      borderRadius: '4px', 
                      fontSize: '11px', 
                      fontWeight: 'bold', 
                      marginBottom: '12px',
                      backgroundColor: product.dispatch_priority === 'critical' ? '#fef2f2' : product.dispatch_priority === 'high' ? '#fef9c3' : '#f1f5f9',
                      color: product.dispatch_priority === 'critical' ? '#991b1b' : product.dispatch_priority === 'high' ? '#854d0e' : '#64748b',
                      border: `1px solid ${product.dispatch_priority === 'critical' ? '#ef4444' : product.dispatch_priority === 'high' ? '#f59e0b' : '#e2e8f0'}`
                    }}>
                      {product.dispatch_priority === 'critical' ? '🚨 CRITICAL' : product.dispatch_priority === 'high' ? '⚡ HIGH PRIORITY' : '→ NORMAL'}
                    </div>
                    
                    {/* Card Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                      <div style={{ flex: 1, paddingRight: '12px' }}>
                        <h3 style={{ margin: 0, fontSize: '22px', color: '#1e293b', lineHeight: '1.2' }}>{product.productName}</h3>
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>SKU: {product.sku}</div>
                      </div>
                      <div style={{ backgroundColor: '#f1f5f9', color: '#475569', padding: '6px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                        {product.batchCount} batches
                      </div>
                    </div>

                    {/* Demand by Region Label */}
                    <div style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#94a3b8', marginBottom: '12px' }}>
                      Market Demand Signal:
                    </div>

                    {/* Region Rows */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                      {dataRegions.map(r => (
                        <div key={r.region}>
                          <div style={{ display: 'flex', alignItems: 'center', height: '24px' }}>
                            <div style={{ width: '100px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: '500', color: '#334155' }}>
                              <span style={{ fontSize: '16px', width: '20px', textAlign: 'center' }}>{r.icon}</span>
                              {r.region}
                            </div>
                            
                            <div style={{ flex: 1, margin: '0 16px', backgroundColor: '#f1f5f9', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${r.barWidth}%`, backgroundColor: getSpeedFill(r.speed), transition: 'width 0.5s ease-in-out' }}></div>
                            </div>

                            <div style={{ width: '100px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-end', gap: '2px' }}>
                              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'baseline', gap: '6px' }}>
                                <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569', textAlign: 'right' }}>
                                  {getSpeedLabel(r.speed)}
                                </span>
                                <span style={{ fontSize: '11px', color: '#94a3b8', minWidth: '20px', textAlign: 'right' }}>
                                  · {r.avgScore !== null ? r.avgScore : '—'}
                                </span>
                              </div>
                            </div>
                          </div>
                          {r.empty_shelf_count > 0 && (
                            <div style={{ marginLeft: '124px', color: '#ef4444', fontSize: '11px', marginTop: '2px' }}>
                              ⚠ Empty shelf reported at {r.empty_shelf_count} outlets
                            </div>
                          )}
                        </div>
                      ))}

                      {/* D) Collapse No Data Regions */}
                      {noDataRegions.length > 0 && (
                        <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '8px', fontStyle: 'italic' }}>
                          No field data: {noDataRegions.join(', ')}
                        </p>
                      )}
                    </div>

                    {/* E) Specific Alert Text */}
                    <div style={{ backgroundColor: '#1e3a5f', color: '#ffffff', borderRadius: '6px', padding: '12px 16px', fontSize: '13px', lineHeight: '1.4', display: 'flex', gap: '10px' }}>
                      <span style={{ fontSize: '16px' }}>💡</span>
                      <div>{product.alert_text}</div>
                    </div>

                    {/* F) Dispatch Action Button */}
                    {(product.dispatch_priority === 'critical' || product.dispatch_priority === 'high') && (
                      <button
                        onClick={() => {
                          const targetUrl = `/dashboard/dispatch?sku=${product.sku}&region=${product.best_dispatch_region}`;
                          // For now, since dispatch page might not exist, we'll alert and mock navigate
                          console.log(`Navigating to ${targetUrl}`);
                          alert(`Recommendation copied: Dispatch ${product.productName} to ${product.best_dispatch_region}. Proceed to Clearance/Dispatch.`);
                        }}
                        style={{
                          width: '100%',
                          padding: '10px',
                          backgroundColor: '#22c55e',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          marginTop: '12px',
                          transition: 'background 0.2s'
                        }}
                        onMouseOver={(e) => e.target.style.backgroundColor = '#16a34a'}
                        onMouseOut={(e) => e.target.style.backgroundColor = '#22c55e'}
                      >
                        Dispatch to {product.best_dispatch_region} →
                      </button>
                    )}

                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* SECTION 3: PRODUCTS WITH NO WAREHOUSE STOCK */}
        {highDemandNotInStock && highDemandNotInStock.length > 0 && (
          <div style={{ marginTop: '60px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '8px' }}>
              <div>
                <h2 style={{ fontSize: '20px', color: '#1a3a5c', margin: '0' }}>High Demand — Not in Stock</h2>
                <p style={{ color: '#92400e', fontSize: '13px', margin: '4px 0 0 0' }}>
                  These products are moving fast but you have no stock to dispatch. Flag to your procurement team.
                </p>
              </div>
              <button
                onClick={exportProcurementList}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#f59e0b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                📋 Export for Procurement
              </button>
            </div>

            <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', marginTop: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              {highDemandNotInStock.map((item, i) => (
                <div key={item.sku} style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  padding: '16px 20px', 
                  borderBottom: i < highDemandNotInStock.length - 1 ? '1px solid #f1f5f9' : 'none' 
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    {/* Urgency Badge */}
                    <div style={{ 
                      padding: '4px 10px', 
                      borderRadius: '16px', 
                      fontSize: '11px', 
                      fontWeight: 'bold', 
                      backgroundColor: item.urgency_color, 
                      color: 'white',
                      minWidth: '60px',
                      textAlign: 'center'
                    }}>
                      {item.urgency_tier === 'high' ? '🔴 HIGH' : item.urgency_tier === 'medium' ? '🟡 MED' : '⚪ LOW'}
                    </div>

                    <div>
                      <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e293b' }}>
                        {item.productName}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                        {(item.days_out_of_stock !== null && !isNaN(item.days_out_of_stock)) ? (
                          <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: 'bold' }}>
                            No stock for {Math.round(item.days_out_of_stock)} days
                          </span>
                        ) : (
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                            Never dispatched
                          </span>
                        )}
                        <span style={{ fontSize: '11px', color: '#64748b' }}>
                          🔥 Fast in: <span style={{ fontWeight: '600' }}>{item.fast_regions}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ backgroundColor: '#f1f5f9', color: '#475569', padding: '4px 12px', borderRadius: '16px', fontSize: '12px', fontWeight: 'bold', border: '1px solid #e2e8f0' }}>
                    0 batches
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
