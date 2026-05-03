import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const MyDistributors = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();
    const token = sessionStorage.getItem('token');
    const theme = sessionStorage.getItem('theme') || 'light';

    useEffect(() => {
        const fetchData = async () => {
            try {
                const apiUrl = `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/my-distributors`;
                console.log("[DEBUG Frontend] Calling API:", apiUrl);
                const res = await fetch(apiUrl, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!res.ok) {
                    if (res.status === 403 || res.status === 401) {
                        navigate('/dashboard');
                        return;
                    }
                    throw new Error('Failed to fetch distributor intelligence');
                }

                const result = await res.json();
                setData(result);
            } catch (err) {
                console.error("Error fetching data:", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [token, navigate]);

    if (loading) {
        return (
            <div className={`dashboard-container ${theme}`} style={styles.loadingContainer}>
                <div style={styles.header}>
                    <div style={styles.skeletonTitle}></div>
                    <div style={styles.skeletonSubtitle}></div>
                </div>
                <div style={styles.summaryGridSkeleton}>
                    {[1, 2, 3, 4, 5].map(i => <div key={i} style={styles.skeletonCardSmall}></div>)}
                </div>
                <div style={styles.distributorList}>
                    {[1, 2].map(i => <div key={i} style={styles.skeletonDistCard}></div>)}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={`dashboard-container ${theme}`} style={styles.errorContainer}>
                <div style={styles.errorCard}>
                    <h2 style={{ color: '#ef4444' }}>Error</h2>
                    <p>{error}</p>
                    <button style={styles.retryBtn} onClick={() => window.location.reload()}>Retry</button>
                </div>
            </div>
        );
    }

    if (!data || !data.distributors || data.distributors.length === 0) {
        return (
            <div className={`dashboard-container ${theme}`} style={styles.container}>
                <div style={styles.header}>
                    <div>
                        <h1 style={styles.title}>My Distributor Relationships</h1>
                        <p style={styles.subtitle}>Your personal dispatch history with each distributor</p>
                    </div>
                </div>
                <div style={styles.emptyState}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>🤝</div>
                    <h3>No dispatch history found yet</h3>
                    <p>Start dispatching batches to build your distributor relationship profile.</p>
                    <button style={styles.backBtn} onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
                </div>
            </div>
        );
    }

    return (
        <div className={`dashboard-container ${theme}`} style={{ minHeight: '100vh', padding: '24px' }}>
            <div style={styles.mainContainer}>
                {/* Header */}
                <div style={styles.header}>
                    <div>
                        <h1 style={styles.title}> Distributor Scorecards</h1>
                        <p style={styles.subtitle}>Personal dispatch history — returns, collection speed, and stock freshness</p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <button
                            onClick={() => navigate('/dashboard')}
                            style={styles.secondaryBtn}
                        >
                            ← Back to Dashboard
                        </button>
                        <div style={styles.managerNameBadge}>
                            <div style={{ fontWeight: 'bold', color: 'var(--text-main)', fontSize: '15px' }}>{data.managerName}</div>
                        </div>
                    </div>
                </div>

                {/* Quick Navigation Bar */}
                <style>
                    {`
                        .hide-scrollbar::-webkit-scrollbar { display: none; }
                        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                    `}
                </style>
                <div style={styles.quickNav}>
                    <div style={styles.quickNavLabel}>Quick Jump:</div>
                    <div style={styles.quickNavList} className="hide-scrollbar">
                        {data.distributors.map(dist => (
                            <button 
                                key={`nav-${dist.distributorId}`}
                                onClick={() => {
                                    const element = document.getElementById(`dist-card-${dist.distributorId}`);
                                    if (element) {
                                        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        // Add a temporary highlight effect
                                        element.style.outline = '3px solid var(--nestle-gold-main)';
                                        element.style.outlineOffset = '4px';
                                        setTimeout(() => {
                                            element.style.outline = 'none';
                                            element.style.outlineOffset = '0';
                                        }, 2000);
                                    }
                                }}
                                style={{
                                    ...styles.navChip,
                                    borderLeft: `4px solid ${dist.healthColor}`
                                }}
                            >
                                {dist.distributorName}
                            </button>
                        ))}
                    </div>
                    <div style={styles.navArrow}>→</div>
                </div>

                {/* Contract Insights Section */}
                <div style={styles.insightsPanel}>
                    <div style={styles.insightsHeader}>
                        <h2 style={styles.insightsTitle}>📊 Contract Performance Insights</h2>
                        <span style={styles.insightsTag}>Strategic Overview</span>
                    </div>

                    <div style={styles.insightsGrid}>
                        {/* Freshness Loss Summary Panel */}
                        <div style={styles.lossPanel}>
                            <h3 style={styles.panelHeading}>STOCK LOSS SUMMARY</h3>
                            <div style={styles.lossMainRow}>
                                <div style={styles.lossStat}>
                                    <div style={styles.lossValue}>{data.totalUnitsLost || 0}</div>
                                    <div style={styles.lossLabel}>Total Units Lost</div>
                                </div>
                                <div style={styles.lossDivider}></div>
                                <div style={{ display: 'flex', gap: '20px' }}>
                                    <div style={styles.lossStat}>
                                        <div style={{ ...styles.lossValue, fontSize: '20px', color: '#fca5a5' }}>
                                            {data.totalReturnsCount || 0} <span style={{ fontSize: '14px', opacity: 0.8 }}>Batches</span>
                                        </div>
                                        <div style={styles.lossLabel}>{data.totalReturnsUnits || 0} Units Ret</div>
                                    </div>
                                    <div style={styles.lossStat}>
                                        <div style={{ ...styles.lossValue, fontSize: '20px', color: '#fdba74' }}>
                                            {data.totalClearancesCount || 0} <span style={{ fontSize: '14px', opacity: 0.8 }}>Batches</span>
                                        </div>
                                        <div style={styles.lossLabel}>{data.totalClearancesUnits || 0} Units Clr</div>
                                    </div>
                                </div>
                            </div>
                            <div style={styles.lossFooter}>
                                ℹ Breakdown of stock impact from distributor returns vs. warehouse emergency clearances.
                            </div>
                        </div>

                        {/* Trend Breakdown Panel */}
                        <div style={styles.trendPanel}>
                            <h3 style={styles.panelHeading}>PORTFOLIO TREND</h3>
                            <div style={styles.trendRow}>
                                <TrendStat
                                    count={data.distributors.filter(d => d.performanceTrend === 'Improving').length}
                                    label="Improving"
                                    color="#22c55e"
                                    icon="📈"
                                />
                                <TrendStat
                                    count={data.distributors.filter(d => d.performanceTrend === 'Stable').length}
                                    label="Stable"
                                    color="#3b82f6"
                                    icon="📊"
                                />
                                <TrendStat
                                    count={data.distributors.filter(d => d.performanceTrend === 'Declining').length}
                                    label="Declining"
                                    color="#ef4444"
                                    icon="📉"
                                />
                            </div>
                            <div style={styles.trendFooter}>
                                Classification based on 30-day return rate variance.
                            </div>
                        </div>
                    </div>
                </div>

                {/* Summary Cards Row */}
                <div style={styles.summaryGrid}>
                    <SummaryStatCard
                        label="BATCH RETURN RATE"
                        value={`${data.yourOverallReturnRate || 0}%`}
                        sub={`System Avg: ${data.systemAvgReturnRate || 0}%`}
                        status={(data.yourOverallReturnRate || 0) <= (data.systemAvgReturnRate || 0) ? 'good' : 'poor'}
                        statusLabel={(data.yourOverallReturnRate || 0) <= (data.systemAvgReturnRate || 0) ? '✅ Below avg' : '⚠ Above avg'}
                    />
                    <SummaryStatCard
                        label="AVG PICKUP DELAY"
                        value={`${data.yourAvgCollectionDelay || 0} days`}
                        sub={`System Avg: ${data.systemAvgCollectionDelay || 0}d`}
                        status={(data.yourAvgCollectionDelay || 0) <= (data.systemAvgCollectionDelay || 0) ? 'good' : 'poor'}
                        statusLabel={(data.yourAvgCollectionDelay || 0) <= (data.systemAvgCollectionDelay || 0) ? '✅ Below avg' : '⚠ Above avg'}
                    />
                    <SummaryStatCard
                        label="TOTAL UNITS LOST"
                        value={data.totalUnitsLost || 0}
                        sub={`${data.totalReturnsUnits || 0} Returns + ${data.totalClearancesUnits || 0} Clearances`}
                        status="poor"
                        icon="📦"
                    />
                    <SummaryStatCard
                        label="TOP RELIABLE PARTNER"
                        value={data.mostReliable?.distributorName || 'N/A'}
                        sub={data.mostReliable ? `Health: ${data.mostReliable.health}` : 'Pending data'}
                        status="good"
                        icon="⭐"
                    />
                    <SummaryStatCard
                        label="RELATIONSHIP RISK"
                        value={data.mostProblematic?.distributorName || 'None'}
                        sub={data.mostProblematic ? `Health: ${data.mostProblematic.health}` : 'Low risk profile'}
                        status="poor"
                        icon="🚨"
                    />
                </div>

                {/* Distributor List */}
                <div style={styles.distributorList}>
                    {data.distributors.map(dist => (
                        <div 
                            key={dist.distributorId} 
                            id={`dist-card-${dist.distributorId}`}
                            style={{ ...styles.distCard, borderLeft: `6px solid ${dist.healthColor}` }}
                        >
                            <div style={styles.distCardHeader}>
                                <div>
                                    <h2 style={styles.distName}>{dist.distributorName}</h2>
                                    <div style={styles.distRegion}>{dist.distributorRegion}</div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                                    <div style={{
                                        ...styles.healthBadge,
                                        backgroundColor: dist.healthColor + '20',
                                        color: dist.healthColor,
                                        border: `1px solid ${dist.healthColor}`
                                    }}>
                                        {dist.badge}
                                    </div>
                                    <div style={{
                                        ...styles.trendBadge,
                                        backgroundColor: dist.performanceTrend === 'Improving' ? '#f0fdf4' : dist.performanceTrend === 'Declining' ? '#fef2f2' : '#eff6ff',
                                        color: dist.performanceTrend === 'Improving' ? '#166534' : dist.performanceTrend === 'Declining' ? '#991b1b' : '#1e40af',
                                        border: `1px solid ${dist.performanceTrend === 'Improving' ? '#bbf7d0' : dist.performanceTrend === 'Declining' ? '#fecaca' : '#bfdbfe'}`
                                    }}>
                                        {dist.performanceTrend === 'Improving' ? '📈 Improving' : dist.performanceTrend === 'Declining' ? '📉 Declining' : '📊 Stable'}
                                    </div>
                                </div>
                            </div>

                            {/* Signal Pills */}
                            <div style={styles.signalsRow}>
                                {dist.signals && (
                                    <>
                                        <SignalPill signal={dist.signals.returnSignal} labelPrefix="" />
                                        <SignalPill signal={dist.signals.delaySignal} labelPrefix="Pickup Delay: " />
                                        <div style={{
                                            ...styles.signalPill,
                                            backgroundColor: '#fef2f2',
                                            color: '#ef4444',
                                            border: '1px solid #fecaca'
                                        }}>
                                            <span style={{ fontSize: '10px', marginRight: '4px' }}>📦</span>
                                            <span style={{ fontWeight: '500' }}>Stock Loss: </span>
                                            <span style={{ marginLeft: '6px', fontWeight: 'bold', opacity: 0.8 }}>
                                                {dist.totalUnitsLost} units ({dist.totalReturnsUnits} Ret / {dist.totalClearancesUnits} Clr)
                                            </span>
                                        </div>
                                    </>
                                )}
                            </div>

                            <div style={styles.divider}></div>

                            <div style={styles.summaryTextSection}>
                                <p style={styles.plainEnglishText}>
                                    {dist.plainEnglishSummary}
                                </p>
                            </div>

                            <div style={styles.divider}></div>

                            <div style={styles.chartSection}>
                                <h4 style={styles.sectionHeading}>YOUR HISTORY WITH THEM</h4>
                                <div style={{ height: '200px', width: '100%', marginTop: '16px' }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={dist.monthlyHistory}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                                            <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={{ stroke: 'var(--border-color)' }} />
                                            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={{ stroke: 'var(--border-color)' }} />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', color: 'var(--text-main)', fontSize: '12px' }}
                                            />
                                            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                                            <Bar name="Dispatches" dataKey="dispatched" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                                            <Bar name="Returns" dataKey="returned" fill="#ef4444" radius={[3, 3, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div style={styles.divider}></div>

                            <div style={styles.quickStatsSection}>
                                <h4 style={styles.sectionHeading}>QUICK STATS:</h4>
                                <div style={styles.statsGridRow}>
                                    <div style={styles.smallStat}>
                                        <span style={styles.smallLabel}>Dispatches:</span>
                                        <span style={styles.smallValue}>{dist.totalDispatches}</span>
                                    </div>
                                    <div style={styles.smallStat}>
                                        <span style={styles.smallLabel}>Returns:</span>
                                        <span style={styles.smallValue}>{dist.totalReturns}</span>
                                    </div>
                                    <div style={styles.smallStat}>
                                        <span style={styles.smallLabel}>Return rate:</span>
                                        <span style={{ ...styles.smallValue, color: dist.signals?.returnSignal?.color || 'var(--text-main)' }}>{dist.managerReturnRate}%</span>
                                    </div>
                                    <div style={styles.smallStat}>
                                        <span style={styles.smallLabel}>Avg delay:</span>
                                        <span style={{ ...styles.smallValue, color: dist.signals?.delaySignal?.color || 'var(--text-main)' }}>{dist.avgCollectionDelay || 'N/A'}d</span>
                                    </div>
                                    <div style={styles.smallStat}>
                                        <span style={styles.smallLabel}>Avg FRS sent:</span>
                                        <span style={{ ...styles.smallValue, color: dist.signals?.frsSignal?.color || 'var(--text-main)' }}>{dist.avgFrsAtDispatch}</span>
                                    </div>
                                    <div style={styles.smallStat}>
                                        <span style={styles.smallLabel}>Distributor Performance Score:</span>
                                        <span style={styles.smallValue}>{dist.overallScore || 'Pending'}</span>
                                    </div>
                                </div>
                            </div>

                            <div style={{
                                ...styles.actionBox,
                                backgroundColor: dist.actionSeverity === 'critical' ? '#ef4444' : dist.actionSeverity === 'warning' ? '#f59e0b' : dist.actionSeverity === 'positive' ? '#22c55e' : '#1e3a5f'
                            }}>
                                <span style={{ fontSize: '18px' }}>💡</span>
                                <p style={{ margin: 0, fontSize: '14px', fontWeight: '500', color: dist.actionSeverity === 'neutral' ? 'white' : '#0f172a' }}>
                                    {dist.suggestedAction}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const TrendStat = ({ count, label, color, icon }) => (
    <div style={{ ...styles.trendStat, borderColor: color + '30' }}>
        <div style={{ fontSize: '20px', marginBottom: '4px' }}>{icon}</div>
        <div style={{ fontSize: '20px', fontWeight: '900', color }}>{count}</div>
        <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{label}</div>
    </div>
);

const SummaryStatCard = ({ label, value, sub, status, statusLabel, icon }) => (
    <div style={{
        ...styles.summaryCard,
        backgroundColor: status === 'good' ? '#f0fdf4' : status === 'poor' ? '#fef2f2' : 'white',
        border: `1px solid ${status === 'good' ? '#bbf7d0' : status === 'poor' ? '#fecaca' : '#e2e8f0'}`
    }}>
        <div style={styles.sumCardHeader}>
            <span style={styles.sumCardLabel}>{label}</span>
            {icon && <span>{icon}</span>}
        </div>
        <div style={{ ...styles.sumCardValue, color: status === 'good' ? '#166534' : status === 'poor' ? '#991b1b' : '#0f172a' }}>
            {value}
        </div>
        <div style={styles.sumCardSub}>{sub}</div>
        {statusLabel && (
            <div style={{ ...styles.sumCardBadge, backgroundColor: status === 'good' ? '#22c55e' : '#ef4444' }}>
                {statusLabel}
            </div>
        )}
    </div>
);

const SignalPill = ({ signal, labelPrefix }) => (
    <div style={{
        ...styles.signalPill,
        backgroundColor: signal.color + '15',
        color: signal.color,
        border: `1px solid ${signal.color}30`
    }}>
        <span style={{ fontSize: '10px', marginRight: '4px' }}>
            {signal.signal === 'good' ? '🟢' : signal.signal === 'poor' ? '🔴' : '🟡'}
        </span>
        <span style={{ fontWeight: '500' }}>{signal.label}</span>
        <span style={{ marginLeft: '6px', fontWeight: 'bold', opacity: 0.8 }}>— {signal.value}</span>
    </div>
);

const styles = {
    mainContainer: { maxWidth: '1200px', margin: '0 auto' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' },
    title: { fontSize: '26px', fontWeight: '800', color: 'var(--text-main)', margin: 0 },
    subtitle: { color: 'var(--text-muted)', fontSize: '14px', margin: '4px 0 0 0' },
    managerNameBadge: { backgroundColor: 'var(--card-bg)', padding: '10px 16px', borderRadius: '10px', border: '1px solid var(--border-color)', textAlign: 'right' },
    quickNav: {
        backgroundColor: 'var(--card-bg)',
        padding: '12px 20px',
        borderRadius: '12px',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-sm)',
        position: 'relative'
    },
    quickNavLabel: { fontSize: '13px', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase', flexShrink: 0 },
    quickNavList: { 
        display: 'flex', 
        gap: '8px', 
        overflowX: 'auto', 
        paddingRight: '40px',
        scrollBehavior: 'smooth'
    },
    navArrow: {
        position: 'absolute',
        right: '16px',
        color: 'var(--text-muted)',
        fontSize: '20px',
        fontWeight: 'bold',
        background: 'linear-gradient(to left, var(--card-bg) 60%, transparent)',
        paddingLeft: '20px',
        pointerEvents: 'none'
    },
    navChip: {
        backgroundColor: 'var(--bg-main)',
        border: '1px solid var(--border-color)',
        padding: '6px 14px',
        borderRadius: '8px',
        fontSize: '13px',
        fontWeight: '600',
        color: 'var(--text-main)',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        display: 'flex',
        alignItems: 'center'
    },
    insightsPanel: {
        backgroundColor: '#A67956',
        backgroundImage: 'linear-gradient(135deg, #A67956 0%, #3D1C02 100%)',
        borderRadius: '20px',
        padding: '24px',
        marginBottom: '32px',
        color: 'white',
        boxShadow: '0 10px 30px rgba(92, 58, 33, 0.3)',
        border: '1px solid var(--nestle-gold-main)'
    },
    insightsHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid rgba(200, 169, 110, 0.2)', paddingBottom: '12px' },
    insightsTitle: { fontSize: '20px', fontWeight: '800', margin: 0, color: 'var(--nestle-gold-light)' },
    insightsTag: { fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', backgroundColor: 'rgba(200, 169, 110, 0.2)', color: 'var(--nestle-gold-light)', padding: '4px 8px', borderRadius: '4px', letterSpacing: '1px' },
    insightsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' },
    lossPanel: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '20px', border: '1px solid rgba(200, 169, 110, 0.1)' },
    panelHeading: { fontSize: '11px', fontWeight: 'bold', color: 'var(--nestle-gold-main)', margin: '0 0 16px 0', letterSpacing: '1px' },
    lossMainRow: { display: 'flex', alignItems: 'center', gap: '30px' },
    lossStat: { flex: 1 },
    lossValue: { fontSize: '32px', fontWeight: '900', color: 'white' },
    lossLabel: { fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginTop: '4px' },
    lossFooter: { marginTop: '16px', fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' },
    trendPanel: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '20px', border: '1px solid rgba(200, 169, 110, 0.1)' },
    trendRow: { display: 'flex', justifyContent: 'space-between', gap: '12px' },
    trendStat: { flex: 1, textAlign: 'center', padding: '12px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid transparent' },
    trendFooter: { marginTop: '16px', fontSize: '11px', color: 'rgba(255,255,255,0.4)', textAlign: 'center' },
    summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' },
    summaryCard: { padding: '16px', borderRadius: '12px', display: 'flex', flexDirection: 'column', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' },
    sumCardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' },
    sumCardLabel: { fontSize: '10px', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' },
    sumCardValue: { fontSize: '22px', fontWeight: '900', margin: '4px 0' },
    sumCardSub: { fontSize: '12px', color: 'var(--text-muted)' },
    sumCardBadge: { marginTop: '10px', padding: '3px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 'bold', color: 'white', display: 'inline-block', width: 'fit-content' },
    trendBadge: { padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' },
    distributorList: { display: 'flex', flexDirection: 'column', gap: '24px' },
    distCard: { backgroundColor: 'var(--card-bg)', borderRadius: '16px', padding: '24px', boxShadow: 'var(--shadow-md)', border: '1px solid var(--border-color)' },
    distCardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' },
    distName: { fontSize: '22px', fontWeight: '800', margin: 0, color: 'var(--text-main)' },
    distRegion: { color: 'var(--text-muted)', fontSize: '14px', marginTop: '2px' },
    healthBadge: { padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold' },
    signalsRow: { display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '8px' },
    signalPill: { padding: '4px 12px', borderRadius: '30px', fontSize: '12px', display: 'flex', alignItems: 'center' },
    divider: { height: '1px', backgroundColor: 'var(--border-color)', margin: '16px 0' },
    plainEnglishText: { fontSize: '15px', lineHeight: '1.6', color: 'var(--text-main)', margin: 0, fontWeight: '400' },
    sectionHeading: { fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)', margin: 0, textTransform: 'uppercase', letterSpacing: '1px' },
    quickStatsSection: { padding: '4px 0' },
    statsGridRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginTop: '12px' },
    smallStat: { display: 'flex', flexDirection: 'column', gap: '2px' },
    smallLabel: { fontSize: '11px', color: 'var(--text-muted)' },
    smallValue: { fontSize: '14px', fontWeight: 'bold', color: 'var(--text-main)' },
    actionBox: { marginTop: '20px', padding: '12px 16px', borderRadius: '8px', display: 'flex', gap: '12px', alignItems: 'center' },
    secondaryBtn: {
        padding: '8px 16px',
        borderRadius: '8px',
        border: '1px solid var(--border-color)',
        backgroundColor: 'var(--card-bg)',
        color: 'var(--text-main)',
        fontSize: '13px',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
    },
    loadingContainer: { padding: '40px' },
    skeletonCardSmall: { height: '120px', backgroundColor: 'var(--border-color)', borderRadius: '12px', animation: 'pulse 1.5s infinite' },
    skeletonDistCard: { height: '350px', backgroundColor: 'var(--card-bg)', borderRadius: '16px', marginBottom: '24px', animation: 'pulse 1.5s infinite' }
};

export default MyDistributors;
