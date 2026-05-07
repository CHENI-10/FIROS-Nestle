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

  // COMMAND METRICS (Pivoted to Procurement Gap)
  const { regionOverview = [], highDemandNotInStock = [], lastUpdated, recentReportsCount = 0 } = data || {};
  const urgentProcurementCount = highDemandNotInStock.filter(p => p.urgency_tier === 'high' || p.urgency_tier === 'medium').length;
  const oosRegionsCount = new Set(highDemandNotInStock.flatMap(p => p.fast_regions.split(',').map(r => r.trim()))).size;
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
            <h1 style={{ color: '#1a3a5c', margin: '0 0 8px 0', fontSize: '28px', display: 'flex', alignItems: 'center', gap: '12px', fontWeight: '900' }}>
              Market Supply Intelligence
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', backgroundColor: '#e2e8f0', padding: '4px 10px', borderRadius: '16px', border: '1px solid #cbd5e1', color: '#334155', fontWeight: 'bold' }}>
                <span style={{ width: '8px', height: '8px', backgroundColor: '#22c55e', borderRadius: '50%', display: 'inline-block', boxShadow: '0 0 8px #22c55e' }}></span>
                STRATEGIC PULSE
              </span>
            </h1>
            <p style={{ color: '#64748b', margin: 0, fontSize: '15px' }}>Identifying critical supply gaps and procurement needs</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#64748b', fontSize: '13px', marginBottom: '4px' }}>
              Sync Status: {lastUpdateDate}
            </div>
            <button 
              onClick={fetchMarketPulse}
              style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', color: '#1e293b', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto', fontWeight: 'bold' }}
            >
              <span style={{ fontSize: '16px' }}>↻</span> Refresh Intelligence
            </button>
          </div>
        </div>

        {/* COMMAND SUMMARY CARDS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '32px' }}>
          <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', borderTop: '4px solid #ef4444' }}>
            <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.5px' }}>Urgent Procurement Flags</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <div style={{ fontSize: '32px', fontWeight: '900', color: '#1e293b' }}>{urgentProcurementCount}</div>
              <div style={{ fontSize: '14px', color: '#ef4444', fontWeight: 'bold' }}>Items</div>
            </div>
            <p style={{ fontSize: '12px', color: '#94a3b8', margin: '8px 0 0 0' }}>High demand but zero stock</p>
          </div>

          <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', borderTop: '4px solid #f59e0b' }}>
            <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.5px' }}>Stock-Out Territories</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <div style={{ fontSize: '32px', fontWeight: '900', color: '#1e293b' }}>{oosRegionsCount}</div>
              <div style={{ fontSize: '14px', color: '#f59e0b', fontWeight: 'bold' }}>Regions</div>
            </div>
            <p style={{ fontSize: '12px', color: '#94a3b8', margin: '8px 0 0 0' }}>Reporting lost sales opportunities</p>
          </div>

          <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', borderTop: '4px solid #3b82f6' }}>
            <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.5px' }}>Intelligence Pulse</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <div style={{ fontSize: '32px', fontWeight: '900', color: '#1e293b' }}>{recentReportsCount}</div>
              <div style={{ fontSize: '14px', color: '#3b82f6', fontWeight: 'bold' }}>Reports</div>
            </div>
            <p style={{ fontSize: '12px', color: '#94a3b8', margin: '8px 0 0 0' }}>Field data received in last 7 days</p>
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
