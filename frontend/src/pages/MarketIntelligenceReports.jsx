import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css'; 

const AnimatedCounter = ({ value }) => {
    const [count, setCount] = React.useState(0);

    React.useEffect(() => {
        let startTimestamp = null;
        const totalDuration = 1000;
        const endValue = parseFloat(value);
        if (isNaN(endValue)) return;

        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / totalDuration, 1);
            const easeProgress = 1 - Math.pow(1 - progress, 4);
            setCount(easeProgress * endValue);
            
            if (progress < 1) {
                window.requestAnimationFrame(step);
            } else {
                setCount(endValue);
            }
        };
        window.requestAnimationFrame(step);
    }, [value]);

    const isDecimal = value.toString().includes('.');
    return <>{isDecimal ? count.toFixed(1) : Math.round(count)}</>;
};

const MarketIntelligenceReports = () => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(sessionStorage.getItem('theme') || 'light');
  useEffect(() => {
    const syncTheme = () => setTheme(sessionStorage.getItem('theme') || 'light');
    window.addEventListener('theme-changed', syncTheme);
    return () => window.removeEventListener('theme-changed', syncTheme);
  }, []);

  const [fadeClass, setFadeClass] = useState('fluid-transition');

  useEffect(() => {
    if (data) {
      setFadeClass('');
      const timer = setTimeout(() => setFadeClass('fluid-transition'), 10);
      return () => clearTimeout(timer);
    }
  }, [data]);

  const toggleTheme = () => {
    const nt = theme === 'dark' ? 'light' : 'dark';
    setTheme(nt);
    sessionStorage.setItem('theme', nt);
    window.dispatchEvent(new Event('theme-changed'));
  };

  const isDark = theme === 'dark';
  const bgColor = isDark ? '#0f172a' : '#faf7f2';
  const textColor = isDark ? '#f1f5f9' : '#1e293b';
  const mutedColor = isDark ? '#94a3b8' : '#64748b';
  const headerColor = isDark ? '#f8fafc' : '#1a3a5c';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const borderColor = isDark ? '#334155' : '#e2e8f0';

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
      <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '40px 5%' }}>
        <style>{`
          @keyframes pulseSkeleton {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
          .skeleton-item { animation: pulseSkeleton 1.5s infinite ease-in-out; }
        `}</style>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'left', color: '#64748b', fontWeight: 'bold', fontSize: '18px', padding: '20px 0', marginBottom: '20px' }} className="skeleton-item">Loading Regional Market Pulse...</div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '32px' }}>
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton-item" style={{ backgroundColor: isDark ? '#1e293b' : '#fdfaf5', padding: '24px', borderRadius: '16px', border: `1px solid ${isDark ? '#334155' : '#e8dfd0'}`, height: '140px' }}>
                <div style={{ width: '60%', height: '14px', backgroundColor: '#e2e8f0', borderRadius: '4px', marginBottom: '20px' }} />
                <div style={{ width: '40px', height: '32px', backgroundColor: '#e2e8f0', borderRadius: '4px', marginBottom: '16px' }} />
                <div style={{ width: '80%', height: '12px', backgroundColor: '#e2e8f0', borderRadius: '4px' }} />
              </div>
            ))}
          </div>

          <div style={{ marginBottom: '40px' }}>
            <div className="skeleton-item" style={{ width: '20%', height: '16px', backgroundColor: '#e2e8f0', borderRadius: '4px', marginBottom: '16px' }} />
            <div className="skeleton-item" style={{ backgroundColor: isDark ? '#1e293b' : '#fdfaf5', borderRadius: '12px', padding: '16px', height: '100px', border: `1px solid ${isDark ? '#334155' : '#e8dfd0'}` }} />
          </div>

          <div style={{ marginTop: '60px' }}>
            <div className="skeleton-item" style={{ width: '30%', height: '24px', backgroundColor: '#e2e8f0', borderRadius: '4px', marginBottom: '16px' }} />
            <div className="skeleton-item" style={{ backgroundColor: isDark ? '#1e293b' : '#fff', borderRadius: '12px', padding: '20px', height: '300px', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }} />
          </div>
        </div>
      </div>
    );
  }

  // COMMAND METRICS (Pivoted to Procurement Gap)
  const { regionOverview = [], highDemandNotInStock = [], lastUpdated, recentReportsCount = 0 } = data || {};
  const urgentProcurementCount = highDemandNotInStock.filter(p => p.urgency_tier === 'high' || p.urgency_tier === 'medium').length;
  const oosRegionsCount = new Set(highDemandNotInStock.flatMap(p => p.fast_regions.split(',').map(r => r.trim()))).size;
  const lastUpdateDate = lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : new Date().toLocaleTimeString();

  return (
    <div style={{ backgroundColor: isDark ? '#0f172a' : '#faf7f2', minHeight: '100vh', fontFamily: 'sans-serif', color: isDark ? '#f1f5f9' : '#1e293b' }}>
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
              <button onClick={() => {
                  sessionStorage.clear();
                  navigate('/login');
              }} style={{
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
      <div className={fadeClass} style={{ maxWidth: '1200px', margin: '0 auto', padding: '16px 5% 40px 5%' }}>
        <style>
            {`
            @keyframes fadeSlideIn {
                from { opacity: 0; transform: translateY(15px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .fluid-transition {
                animation: fadeSlideIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
            `}
        </style>
        


        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ color: headerColor, margin: '0 0 8px 0', fontSize: '28px', display: 'flex', alignItems: 'center', gap: '12px', fontWeight: '900' }}>
              Market Supply Intelligence
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', backgroundColor: isDark ? '#334155' : '#e2e8f0', padding: '4px 10px', borderRadius: '16px', border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`, color: isDark ? '#94a3b8' : '#334155', fontWeight: 'bold' }}>
                <span style={{ width: '8px', height: '8px', backgroundColor: '#22c55e', borderRadius: '50%', display: 'inline-block', boxShadow: '0 0 8px #22c55e' }}></span>
                STRATEGIC PULSE
              </span>
            </h1>
            <p style={{ color: mutedColor, margin: 0, fontSize: '15px' }}>Identifying critical supply gaps and procurement needs</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: mutedColor, fontSize: '13px', marginBottom: '4px' }}>
              Sync Status: {lastUpdateDate}
            </div>
            <button 
              onClick={fetchMarketPulse}
              style={{ backgroundColor: isDark ? '#334155' : '#fff', border: `1px solid ${borderColor}`, color: textColor, padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto', fontWeight: 'bold' }}
            >
              <span style={{ fontSize: '16px' }}>↻</span> Refresh Intelligence
            </button>
          </div>
        </div>

        {/* COMMAND SUMMARY CARDS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '32px' }}>
          <div style={{ backgroundColor: cardBg, padding: '24px', borderRadius: '16px', border: `1px solid ${borderColor}`, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', borderTop: '4px solid #ef4444' }}>
            <div style={{ fontSize: '12px', fontWeight: 'bold', color: mutedColor, textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.5px' }}>Urgent Procurement Flags</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <div style={{ fontSize: '32px', fontWeight: '900', color: textColor }}><AnimatedCounter value={urgentProcurementCount} /></div>
              <div style={{ fontSize: '14px', color: '#ef4444', fontWeight: 'bold' }}>Items</div>
            </div>
            <p style={{ fontSize: '12px', color: mutedColor, margin: '8px 0 0 0' }}>High demand but zero stock</p>
          </div>

          <div style={{ backgroundColor: cardBg, padding: '24px', borderRadius: '16px', border: `1px solid ${borderColor}`, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', borderTop: '4px solid #f59e0b' }}>
            <div style={{ fontSize: '12px', fontWeight: 'bold', color: mutedColor, textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.5px' }}>Stock-Out Territories</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <div style={{ fontSize: '32px', fontWeight: '900', color: textColor }}><AnimatedCounter value={oosRegionsCount} /></div>
              <div style={{ fontSize: '14px', color: '#f59e0b', fontWeight: 'bold' }}>Regions</div>
            </div>
            <p style={{ fontSize: '12px', color: mutedColor, margin: '8px 0 0 0' }}>Reporting lost sales opportunities</p>
          </div>

          <div style={{ backgroundColor: cardBg, padding: '24px', borderRadius: '16px', border: `1px solid ${borderColor}`, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', borderTop: '4px solid #3b82f6' }}>
            <div style={{ fontSize: '12px', fontWeight: 'bold', color: mutedColor, textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.5px' }}>Intelligence Pulse</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <div style={{ fontSize: '32px', fontWeight: '900', color: textColor }}><AnimatedCounter value={recentReportsCount} /></div>
              <div style={{ fontSize: '14px', color: '#3b82f6', fontWeight: 'bold' }}>Reports</div>
            </div>
            <p style={{ fontSize: '12px', color: mutedColor, margin: '8px 0 0 0' }}>Field data received in last 7 days</p>
          </div>
        </div>



        {/* SECTION 1: ENHANCED REGION SNAPSHOT */}
        <div style={{ marginBottom: '40px', backgroundColor: isDark ? 'rgba(30, 41, 59, 0.5)' : 'rgba(255, 255, 255, 0.5)', padding: '24px', borderRadius: '20px', border: `1px solid ${borderColor}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '14px', textTransform: 'uppercase', color: isDark ? '#C8A96E' : '#8B5E3C', letterSpacing: '1px', margin: 0, fontWeight: '800' }}>Regional Market Health Overview</h2>
            <div style={{ display: 'flex', gap: '12px', fontSize: '11px', fontWeight: 'bold' }}>
               <span style={{ color: '#10b981' }}>● High</span>
               <span style={{ color: '#f59e0b' }}>● Moderate</span>
               <span style={{ color: '#ef4444' }}>● Low</span>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
              {regionOverview.map((r, i) => {
                let statusColor = '#10b981';
                if (r.label.includes('Moderate')) statusColor = '#f59e0b';
                else if (r.label.includes('Low')) statusColor = '#ef4444';
                
                return (
                  <div key={i} style={{ 
                    display: 'flex', alignItems: 'center', gap: '16px', 
                    backgroundColor: cardBg, border: `1px solid ${borderColor}`, 
                    borderRadius: '16px', padding: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                    transition: 'all 0.3s ease', cursor: 'default',
                    borderLeft: `5px solid ${statusColor}`
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = isDark ? '0 8px 24px rgba(0,0,0,0.3)' : '0 8px 24px rgba(0,0,0,0.08)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.03)';
                  }}
                  >
                    <div style={{ fontSize: '24px', backgroundColor: isDark ? '#0f172a' : '#fdfcfb', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)' }}>
                      {r.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '800', color: textColor, fontSize: '15px' }}>{r.region}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '4px' }}>
                         <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: statusColor }}></span>
                         <span style={{ color: statusColor, fontSize: '11px', fontWeight: '900', textTransform: 'uppercase' }}>{r.label}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
        {/* SECTION 2: CRITICAL STOCK GAPS */}
        {highDemandNotInStock && highDemandNotInStock.length > 0 && (
          <div style={{ backgroundColor: cardBg, padding: '32px', borderRadius: '24px', border: `1px solid ${borderColor}`, boxShadow: '0 10px 30px rgba(0,0,0,0.04)' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                  <h2 style={{ fontSize: '20px', color: textColor, margin: 0, fontWeight: '900' }}>High Demand — Not in Stock</h2>
                  <p style={{ fontSize: '13px', color: isDark ? '#f59e0b' : '#A67956', margin: '4px 0 0 0', fontWeight: '600' }}>These products are moving fast but you have no stock to dispatch. Flag to your procurement team.</p>
                </div>
                <button 
                  onClick={exportProcurementList}
                  style={{ backgroundColor: '#f59e0b', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', fontSize: '12px', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '16px' }}>📄</span> Export for Procurement
                </button>
             </div>

             <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
               {highDemandNotInStock.map((item, i) => (
                  <div key={item.sku || i} style={{ 
                    display: 'flex', alignItems: 'center', gap: '20px', 
                    backgroundColor: isDark ? '#0f172a' : '#fdfaf5', 
                    padding: '20px', borderRadius: '16px', border: `1px solid ${borderColor}` 
                  }}>
                    <div style={{ 
                      padding: '4px 10px', 
                      borderRadius: '16px', 
                      fontSize: '11px', 
                      fontWeight: 'bold', 
                      backgroundColor: item.urgency_color || '#ef4444', 
                      color: 'white',
                      minWidth: '60px',
                      textAlign: 'center'
                    }}>
                      {item.urgency_tier === 'high' ? '🔴 HIGH' : item.urgency_tier === 'medium' ? '🟡 MED' : '⚪ LOW'}
                    </div>

                    <div>
                      <div style={{ fontSize: '16px', fontWeight: 'bold', color: textColor }}>
                        {item.productName}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                        {(item.days_out_of_stock !== null && !isNaN(item.days_out_of_stock)) ? (
                          <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: 'bold' }}>
                            No stock for {Math.round(item.days_out_of_stock)} days
                          </span>
                        ) : (
                          <span style={{ fontSize: '11px', color: mutedColor }}>
                            Never dispatched
                          </span>
                        )}
                        <span style={{ fontSize: '11px', color: mutedColor }}>
                          🔥 Fast in: <span style={{ fontWeight: '600', color: textColor }}>{item.fast_regions}</span>
                        </span>
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
