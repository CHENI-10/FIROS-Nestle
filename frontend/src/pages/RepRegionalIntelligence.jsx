import React, { useState, useEffect } from 'react';

// ── Helper: format "X days ago" ───────────────────────────────────────────────
const timeAgo = (dateStr) => {
  if (!dateStr) return '';
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  return `${diffDays} days ago`;
};

// ── Main component ────────────────────────────────────────────────────────────
const RepRegionalIntelligence = ({ token, verifiedRep, onProceed, onLogout }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const { repName, repWorkId, region: repRegion } = verifiedRep || {};

  // Greeting is computed immediately from the clock — no API needed
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' :
    hour < 17 ? 'Good afternoon' :
    'Good evening';

  useEffect(() => {
    if (!token || !repRegion || !repWorkId) return;

    const fetchIntelligence = async () => {
      try {
        const res = await fetch(
          `/api/rep-intelligence?region=${encodeURIComponent(repRegion)}&repWorkId=${encodeURIComponent(repWorkId)}`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        );
        if (!res.ok) throw new Error('API error');
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error('Failed to fetch regional intelligence:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchIntelligence();
  }, [token, repRegion, repWorkId]);

  // ── CTA button text ─────────────────────────────────────────────────────────
  const watchCount = data
    ? (data.slowMovers?.length || 0)
    : 0;

  const ctaText = (!loading && data?.hasAlerts && watchCount > 0)
    ? `Start Shelf Check — ${watchCount} item${watchCount !== 1 ? 's' : ''} to watch →`
    : 'Start Shelf Check →';

  const ctaDisabled = loading;

  // ── Submission status icon ──────────────────────────────────────────────────
  const subColor = data?.submissionHistory?.submissionColor || '#ef4444';
  const subIcon = subColor === '#22c55e' ? '✅' : subColor === '#f59e0b' ? '⏰' : '⚠️';

  return (
    <div style={s.outerWrap}>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .intel-section { animation: fadeSlideIn 0.35s ease both; }
      `}</style>

      <div style={s.appWrap}>

        <div style={s.header}>
          <div style={s.headerTop}>
            <span style={s.logo}>FIROS <span style={{ color: '#93c5fd' }}>MI</span></span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={s.regionPill}>{repRegion}</span>
              <button onClick={onLogout} style={s.logoutBtn}>Logout</button>
            </div>
          </div>
          <div style={s.greeting}>{greeting}, {repName} 👋</div>
          <div style={s.greetingSub}>Here's what's happening in your region today.</div>
        </div>

        {/* ── SCROLLABLE BODY ─────────────────────────────────────────────── */}
        <div style={s.body}>

          {/* ── SUBMISSION STATUS ─────────────────────────────────────────── */}
          {loading ? (
            <div style={{ padding: '0 16px 0 16px', marginBottom: '8px' }}>
              <div style={{ ...s.skeletonBase, height: '72px', borderRadius: '10px' }} />
            </div>
          ) : (
            <div className="intel-section" style={{
              ...s.submissionCard,
              borderLeftColor: data ? data.submissionHistory.submissionColor : '#ef4444'
            }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '18px', lineHeight: 1.3 }}>{subIcon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', color: '#1e293b', fontWeight: '500', lineHeight: 1.45 }}>
                    {error
                      ? "Could not load regional data. You can still proceed."
                      : data?.submissionHistory?.submissionStatus}
                  </div>
                  {!error && data?.submissionHistory?.totalThisMonth > 0 && (
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                      {data.submissionHistory.totalThisMonth} report(s) submitted this month
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── TODAY'S PULSE (PERSONALIZED FOCUS) ─────────────────────────── */}
          {!loading && !error && data?.focusItems?.length > 0 && (
            <div className="intel-section" style={s.section}>
              <div style={s.sectionTitle}>✨ Today's Strategic Focus</div>
              <div style={s.sectionSub}>Actionable priorities based on your history and warehouse needs</div>
              
              {data.focusItems.map((item, idx) => (
                <div key={idx} style={s.focusCard}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{ backgroundColor: '#22c55e', width: '8px', height: '8px', borderRadius: '50%' }} />
                    <div style={{ fontSize: '14px', color: '#1e293b', fontWeight: '600' }}>{item}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── WAREHOUSE SYNERGY ─────────────────────────────────────────── */}
          {!loading && !error && data?.warehouseSynergy?.length > 0 && (
            <div className="intel-section" style={s.section}>
              <div style={s.sectionTitle}>🚛 Warehouse-to-Field Sync</div>
              <div style={s.sectionSub}>High-priority stock arriving at your distributors now</div>

              {data.warehouseSynergy.map((alert, idx) => (
                <div key={idx} style={{
                  ...s.alertCard,
                  backgroundColor: alert.status?.includes('CRITICAL') ? '#fff1f0' : '#f0f9ff',
                  borderColor: alert.status?.includes('CRITICAL') ? '#ffa39e' : '#bae7ff'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '700', color: alert.status?.includes('CRITICAL') ? '#cf1322' : '#0050b3' }}>
                        {alert.product}
                      </div>
                      <div style={{ fontSize: '12px', color: alert.status?.includes('CRITICAL') ? '#f5222d' : '#096dd9' }}>
                        Arriving at {alert.distributor?.split(' ')[0]}
                      </div>
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: '900', color: alert.status?.includes('CRITICAL') ? '#cf1322' : '#0050b3' }}>
                      {alert.urgency}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── REGIONAL TRENDS ───────────────────────────────────────────── */}
          {!loading && !error && data?.regionalTrends && (
            <div className="intel-section" style={s.section}>
              <div style={s.sectionTitle}>📈 Regional Market Trends</div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                {data.regionalTrends.booming?.length > 0 && (
                  <div style={{ ...s.trendCard, backgroundColor: '#f6ffed', borderColor: '#b7eb8f' }}>
                    <div style={{ fontSize: '10px', color: '#389e0d', fontWeight: 'bold' }}>🔥 BOOMING</div>
                    <div style={{ fontSize: '13px', color: '#237804', fontWeight: '800' }}>{data.regionalTrends.booming[0]}</div>
                  </div>
                )}
                {data.regionalTrends.dipping?.length > 0 && (
                  <div style={{ ...s.trendCard, backgroundColor: '#fff7e6', borderColor: '#ffe7ba' }}>
                    <div style={{ fontSize: '10px', color: '#d46b08', fontWeight: 'bold' }}>📉 DIPPING</div>
                    <div style={{ fontSize: '13px', color: '#ad4e00', fontWeight: '800' }}>{data.regionalTrends.dipping[0]}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── PERSONAL REMINDERS ────────────────────────────────────────── */}
          {!loading && !error && data?.personalReminders?.length > 0 && (
            <div className="intel-section" style={s.section}>
              <div style={s.sectionTitle}>🕒 Audit Flashbacks</div>
              <div style={s.sectionSub}>Follow-up on stockouts you reported recently</div>

              {data.personalReminders.map((rem, idx) => (
                <div key={idx} style={s.remCard}>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>
                    {rem.product} was OOS at <span style={{ color: '#1a3a5c' }}>{rem.retailer}</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                    Reported {timeAgo(rem.date)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── ERROR STATE ───────────────────────────────────────────────── */}
          {!loading && error && (
            <div className="intel-section" style={s.section}>
              <div style={{
                backgroundColor: '#f8fafc',
                border: '1px dashed #cbd5e1',
                borderRadius: '10px',
                padding: '20px 16px',
                textAlign: 'center',
                color: '#64748b',
                fontSize: '13px',
                lineHeight: 1.6
              }}>
                Could not load regional data.<br />
                You can still proceed with your shelf check.
              </div>
            </div>
          )}

          {/* bottom spacer so content clears fixed button */}
          <div style={{ height: '88px' }} />
        </div>

        {/* ── FIXED CTA BUTTON ────────────────────────────────────────────── */}
        <div style={s.ctaWrap}>
          <button
            onClick={() => onProceed(verifiedRep)}
            disabled={ctaDisabled}
            style={{
              ...s.ctaBtn,
              backgroundColor: ctaDisabled ? '#94a3b8' : '#22c55e',
              cursor: ctaDisabled ? 'not-allowed' : 'pointer'
            }}
          >
            {ctaDisabled ? 'Loading your region data...' : ctaText}
          </button>
        </div>

      </div>
    </div>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const s = {
  outerWrap: {
    backgroundColor: '#e2e8f0',
    minHeight: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    fontFamily: "'Inter', system-ui, sans-serif"
  },
  appWrap: {
    width: '100%',
    maxWidth: '430px',
    backgroundColor: '#f8fafc',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    boxShadow: '0 0 40px rgba(0,0,0,0.1)'
  },
  header: {
    backgroundColor: '#1a3a5c',
    padding: '20px 16px 22px 16px',
    flexShrink: 0
  },
  headerTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '14px'
  },
  logo: {
    color: '#fff',
    fontWeight: '900',
    fontSize: '20px',
    letterSpacing: '1px'
  },
  regionPill: {
    backgroundColor: '#fff',
    color: '#1a3a5c',
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '800'
  },
  logoutBtn: {
    background: 'none',
    border: '1px solid rgba(255,255,255,0.35)',
    color: '#cbd5e1',
    fontSize: '11px',
    padding: '4px 10px',
    borderRadius: '16px',
    cursor: 'pointer',
    fontWeight: '600'
  },
  greeting: {
    color: '#fff',
    fontSize: '22px',
    fontWeight: '800',
    lineHeight: 1.3,
    marginBottom: '6px'
  },
  greetingSub: {
    color: '#93c5fd',
    fontSize: '13px'
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    paddingTop: '16px'
  },
  submissionCard: {
    backgroundColor: '#fff',
    borderLeft: '4px solid #ef4444',
    margin: '0 16px 16px 16px',
    borderRadius: '10px',
    padding: '14px 16px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
  },
  section: {
    padding: '0 16px',
    marginBottom: '24px'
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: '800',
    color: '#1a3a5c',
    marginBottom: '4px'
  },
  sectionSub: {
    fontSize: '12px',
    color: '#94a3b8',
    marginBottom: '12px',
    lineHeight: 1.4
  },
  alertCard: {
    borderLeft: '4px solid #ef4444',
    borderRadius: '10px',
    padding: '14px',
    marginBottom: '10px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
  },
  contextualMsg: {
    backgroundColor: 'rgba(30, 58, 92, 0.06)',
    borderRadius: '8px',
    padding: '10px 12px',
    fontSize: '12px',
    color: '#475569',
    lineHeight: 1.5
  },
  noAlertCard: {
    backgroundColor: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: '10px',
    padding: '16px',
    fontSize: '13px',
    color: '#166534',
    fontWeight: '600',
    textAlign: 'center'
  },
  slowCard: {
    backgroundColor: '#fef9c3',
    border: '1px solid #fcd34d',
    borderRadius: '8px',
    padding: '12px 14px',
    marginBottom: '8px'
  },
  contextualMsgWarm: {
    backgroundColor: 'rgba(180, 83, 9, 0.06)',
    borderRadius: '6px',
    padding: '8px 10px',
    fontSize: '12px',
    color: '#78350f',
    lineHeight: 1.5
  },
  emptyCard: {
    backgroundColor: '#fef2f2',
    border: '1px solid #fca5a5',
    borderRadius: '8px',
    padding: '12px 14px',
    marginBottom: '8px'
  },
  skeletonBase: {
    backgroundColor: '#e2e8f0',
    animation: 'pulse 1.5s ease-in-out infinite'
  },
  focusCard: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '14px 16px',
    marginBottom: '10px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
    border: '1px solid #f1f5f9'
  },
  trendCard: {
    flex: 1,
    padding: '12px',
    borderRadius: '10px',
    border: '1px solid #eee',
    textAlign: 'center'
  },
  remCard: {
    backgroundColor: '#fff',
    borderRadius: '8px',
    padding: '12px',
    marginBottom: '8px',
    border: '1px solid #e2e8f0'
  },
  ctaWrap: {
    position: 'sticky',
    bottom: 0,
    left: 0,
    right: 0,
    padding: '12px 16px',
    backgroundColor: '#f8fafc',
    borderTop: '1px solid #e2e8f0',
    boxShadow: '0 -4px 16px rgba(0,0,0,0.06)'
  },
  ctaBtn: {
    width: '100%',
    padding: '16px',
    backgroundColor: '#22c55e',
    color: '#fff',
    border: 'none',
    borderRadius: '14px',
    fontSize: '15px',
    fontWeight: '800',
    letterSpacing: '0.2px',
    boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)',
    transition: 'all 0.2s ease'
  }
};

export default RepRegionalIntelligence;
