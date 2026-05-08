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
                const apiUrl = `/api/my-distributors?t=${new Date().getTime()}`;
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
                        <h1 style={styles.title}>Distributor Intelligence & Scorecards</h1>
                        <p style={styles.subtitle}>Personal dispatch history — returns, collection speed, and field performance</p>
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
                    <div id="quickNavList" style={styles.quickNavList}>
                        {data.distributors.map(dist => (
                            <button
                                key={`nav-${dist.distributorId}`}
                                onClick={() => {
                                    const element = document.getElementById(`dist-card-${dist.distributorId}`);
                                    if (element) {
                                        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        element.style.boxShadow = `0 0 0 4px ${dist.healthColor}40`;
                                        setTimeout(() => {
                                            element.style.boxShadow = styles.distCard.boxShadow;
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
                    <button
                        style={styles.navArrow}
                        onClick={() => {
                            const list = document.getElementById('quickNavList');
                            if (list) {
                                list.scrollBy({ left: 200, behavior: 'smooth' });
                            }
                        }}
                    >
                        →
                    </button>
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
                                        <div style={{ ...styles.batchValue, color: '#ef4444' }}>
                                            {data.totalReturnsCount || 0} <span style={{ fontSize: '14px', opacity: 0.8 }}>Batches</span>
                                        </div>
                                        <div style={styles.lossLabel}>{data.totalReturnsUnits || 0} Units Returned</div>
                                    </div>
                                    <div style={styles.lossDivider}></div>
                                    <div style={styles.lossStat}>
                                        <div style={{ ...styles.batchValue, color: '#A67956' }}>
                                            {data.totalClearancesCount || 0} <span style={{ fontSize: '14px', opacity: 0.8 }}>Batches</span>
                                        </div>
                                        <div style={styles.lossLabel}>{data.totalClearancesUnits || 0} Emergency Cleared</div>
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
                                    count={data.portfolioTrend?.improving || 0}
                                    label="Improving"
                                    color="#22c55e"
                                    icon="📈"
                                />
                                <TrendStat
                                    count={data.portfolioTrend?.stable || 0}
                                    label="Stable"
                                    color="#3b82f6"
                                    icon="📊"
                                />
                                <TrendStat
                                    count={data.portfolioTrend?.declining || 0}
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
                        sub={`${data.totalReturnsUnits || 0} Returns + ${data.totalClearancesUnits || 0} Emergency Clearances`}
                        status="poor"
                        icon="📦"
                    />
                </div>

                {/* Distributor List */}
                <div style={styles.content}>
                    {Object.entries(
                        data.distributors.reduce((acc, dist) => {
                            const region = dist.distributorRegion || 'Unassigned';
                            if (!acc[region]) acc[region] = [];
                            acc[region].push(dist);
                            return acc;
                        }, {})
                    ).map(([region, regionalDistributors]) => (
                        <div key={region} style={{ marginBottom: '40px' }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '15px',
                                marginBottom: '20px',
                                borderBottom: '2px solid rgba(0,0,0,0.05)',
                                paddingBottom: '10px'
                            }}>
                                <h2 style={{
                                    fontSize: '18px',
                                    color: '#1e293b',
                                    margin: 0,
                                    fontWeight: '800',
                                    textTransform: 'uppercase',
                                    letterSpacing: '1.5px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px'
                                }}>
                                    <span style={{ color: '#A67956' }}>📍</span> {region}
                                    <span style={{
                                        color: '#64748b',
                                        fontSize: '12px',
                                        fontWeight: '500',
                                        backgroundColor: '#f1f5f9',
                                        padding: '2px 8px',
                                        borderRadius: '12px',
                                        letterSpacing: '0'
                                    }}>
                                        {regionalDistributors.length} Operators
                                    </span>
                                </h2>
                            </div>

                            <div style={styles.distributorList}>
                                {regionalDistributors.map(dist => (
                                    <div
                                        key={dist.distributorId}
                                        id={`dist-card-${dist.distributorId}`}
                                        onClick={() => navigate(`/dashboard/scorecard/${dist.distributorId}`)}
                                        style={{
                                            ...styles.distCard,
                                            borderLeft: `8px solid ${dist.healthColor}`, // More prominent side color
                                            cursor: 'pointer',
                                            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.transform = 'translateY(-4px)';
                                            e.currentTarget.style.boxShadow = '0 10px 20px rgba(0,0,0,0.1)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.transform = 'translateY(0)';
                                            e.currentTarget.style.boxShadow = styles.distCard.boxShadow;
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flex: 1, marginBottom: '20px' }}>
                                            <div>
                                                <h2 style={styles.distName}>{dist.distributorName}</h2>
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                {/* Compact Score Badge */}
                                                <div style={{
                                                    backgroundColor: `${dist.healthColor}08`,
                                                    border: `1.5px solid ${dist.healthColor}40`,
                                                    borderRadius: '12px',
                                                    padding: '6px 14px',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    minWidth: '70px',
                                                    boxShadow: `0 2px 8px ${dist.healthColor}10`
                                                }}>
                                                    <span style={{ fontSize: '9px', fontWeight: '900', color: dist.healthColor, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Score</span>
                                                    <span style={{ fontSize: '20px', fontWeight: '900', color: dist.healthColor, lineHeight: 1, marginTop: '2px' }}>{dist.overallScore}</span>
                                                </div>

                                                {/* Performance Indicators */}
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                                                    {dist.performanceTrend && (
                                                        <div style={{
                                                            ...styles.trendBadge,
                                                            backgroundColor: dist.performanceTrend === 'Improving' ? '#f0fdf4' : dist.performanceTrend === 'Declining' ? '#fef2f2' : '#eff6ff',
                                                            color: dist.performanceTrend === 'Improving' ? '#166534' : dist.performanceTrend === 'Declining' ? '#991b1b' : '#1e40af',
                                                            border: `1px solid ${dist.performanceTrend === 'Improving' ? '#bbf7d0' : dist.performanceTrend === 'Declining' ? '#fecaca' : '#bfdbfe'},`,
                                                            fontSize: '10px',
                                                            padding: '3px 8px'
                                                        }}>
                                                            {dist.performanceTrend === 'Improving' ? '📈 Improving' : dist.performanceTrend === 'Declining' ? '📉 Declining' : '📊 Stable'}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Signal Pills */}
                                        <div style={styles.signalsRow}>
                                            {dist.signals && (
                                                <>
                                                    <SignalPill signal={dist.signals.returnSignal} labelPrefix="" />
                                                    <SignalPill signal={dist.signals.delaySignal} labelPrefix="Pickup Delay: " />
                                                    {dist.signals.missSignal && dist.signals.missSignal.value > 0 && (
                                                        <SignalPill signal={dist.signals.missSignal} labelPrefix="" />
                                                    )}

                                                    {/* Units Returned Pill (Distributor-Responsible Metric) */}
                                                    <div style={{
                                                        ...styles.signalPill,
                                                        backgroundColor: dist.totalReturnsUnits > 0 ? '#fef2f2' : '#f0fdf4',
                                                        color: dist.totalReturnsUnits > 0 ? '#ef4444' : '#166534',
                                                        border: `1px solid ${dist.totalReturnsUnits > 0 ? '#fecaca' : '#bbf7d0'}`
                                                    }}>
                                                        <span style={{ fontSize: '10px', marginRight: '4px' }}>📦</span>
                                                        <span style={{ fontWeight: '500' }}>Units Returned: </span>
                                                        <span style={{ marginLeft: '6px', fontWeight: 'bold', opacity: 0.8 }}>
                                                            {dist.totalReturnsUnits} units
                                                        </span>
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        <div style={styles.divider}></div>

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={styles.quickStatsSection}>
                                                <div style={styles.smallStat}>
                                                    <span style={styles.smallLabel}>Return rate:</span>
                                                    <span style={{ ...styles.smallValue, color: dist.signals?.returnSignal?.color || 'var(--text-main)' }}>{dist.managerReturnRate}%</span>
                                                </div>
                                            </div>
                                            <button
                                                style={{
                                                    backgroundColor: '#5c3a21',
                                                    color: 'white',
                                                    border: 'none',
                                                    padding: '8px 20px',
                                                    borderRadius: '8px',
                                                    fontSize: '12px',
                                                    fontWeight: 'bold',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                VIEW FULL CONTRACT INSIGHTS →
                                            </button>
                                        </div>
                                    </div>
                                ))}
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
    mainContainer: { maxWidth: '1200px', margin: '0 auto', paddingBottom: '60px' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' },
    title: { fontSize: '28px', fontWeight: '900', color: '#005696', margin: 0, letterSpacing: '-0.5px' },
    subtitle: { color: '#64748b', fontSize: '15px', margin: '4px 0 0 0', fontWeight: '500' },
    managerNameBadge: {
        backgroundColor: '#f8fafc',
        padding: '12px 20px',
        borderRadius: '14px',
        border: '1px solid #e2e8f0',
        textAlign: 'right',
        boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
    },
    quickNav: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        padding: '16px 24px',
        borderRadius: '16px',
        marginBottom: '28px',
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 15px rgba(166, 121, 86, 0.08)',
        position: 'relative'
    },
    quickNavLabel: { fontSize: '12px', fontWeight: '900', color: '#A67956', textTransform: 'uppercase', letterSpacing: '1px', whiteSpace: 'nowrap' },
    quickNavList: {
        display: 'flex',
        gap: '12px',
        overflowX: 'auto',
        paddingRight: '60px',
        scrollBehavior: 'smooth',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none'
    },
    navArrow: {
        position: 'absolute',
        right: '12px',
        top: '50%',
        transform: 'translateY(-50%)',
        backgroundColor: '#005696',
        color: 'white',
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        boxShadow: '0 2px 8px rgba(0,86,150,0.3)',
        zIndex: 5,
        border: 'none',
        fontSize: '18px',
        fontWeight: 'bold',
        transition: 'transform 0.2s ease'
    },
    navChip: {
        backgroundColor: 'white',
        border: '1px solid #e2e8f0',
        padding: '10px 18px',
        borderRadius: '12px',
        fontSize: '13px',
        fontWeight: '700',
        color: '#334155',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        whiteSpace: 'nowrap',
        boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
    },
    insightsPanel: {
        backgroundColor: '#FEF9F3', // Cream/Sand palette
        borderRadius: '24px',
        padding: '32px',
        marginBottom: '40px',
        color: '#1e293b',
        boxShadow: '0 10px 40px rgba(166, 121, 86, 0.12)',
        border: '1px solid #EADDCF',
        position: 'relative',
        overflow: 'hidden'
    },
    insightsHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        borderBottom: '1.5px solid #EADDCF',
        paddingBottom: '16px'
    },
    insightsTitle: { fontSize: '24px', fontWeight: '900', margin: 0, color: '#8B5E3C', letterSpacing: '-0.5px' },
    insightsTag: {
        fontSize: '10px',
        fontWeight: '900',
        textTransform: 'uppercase',
        backgroundColor: '#8B5E3C',
        color: 'white',
        padding: '6px 14px',
        borderRadius: '8px',
        letterSpacing: '1.5px'
    },
    insightsGrid: { display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '24px' },
    lossPanel: {
        backgroundColor: 'white',
        borderRadius: '20px',
        padding: '24px',
        border: '1px solid #EADDCF',
        boxShadow: '0 4px 12px rgba(166, 121, 86, 0.04)'
    },
    panelHeading: { fontSize: '11px', fontWeight: '900', color: '#A67956', margin: '0 0 16px 0', letterSpacing: '1.2px', textTransform: 'uppercase' },
    lossMainRow: { display: 'flex', alignItems: 'center', gap: '32px' },
    lossStat: { flex: 1 },
    lossValue: { fontSize: '42px', fontWeight: '900', color: '#1e293b', lineHeight: 1 },
    lossLabel: { fontSize: '14px', color: '#64748b', marginTop: '8px', fontWeight: '700' },
    lossDivider: { width: '1.5px', height: '50px', backgroundColor: '#EADDCF' },
    batchValue: { fontSize: '22px', fontWeight: '900', color: '#1e293b' }, // Darker for visibility
    lossFooter: { marginTop: '20px', fontSize: '12px', color: '#8B5E3C', fontStyle: 'italic', borderTop: '1px solid #EADDCF', paddingTop: '12px', opacity: 0.8 },
    trendPanel: {
        backgroundColor: 'white',
        borderRadius: '20px',
        padding: '24px',
        border: '1px solid #EADDCF'
    },
    trendRow: { display: 'flex', justifyContent: 'space-between', gap: '10px' },
    trendStat: {
        flex: 1,
        textAlign: 'center',
        padding: '16px 8px',
        backgroundColor: '#FEF9F3',
        borderRadius: '16px',
        border: '1px solid #EADDCF',
        boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
    },
    trendFooter: { marginTop: '20px', fontSize: '11px', color: '#8B5E3C', textAlign: 'center', fontWeight: '600' },
    summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '40px' },
    summaryCard: {
        padding: '24px',
        borderRadius: '24px',
        position: 'relative',
        transition: 'transform 0.2s ease',
        boxShadow: '0 8px 24px rgba(0,0,0,0.04)',
        backgroundColor: 'white',
        border: '1px solid #f1f5f9'
    },
    sumCardHeader: { display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '12px', fontWeight: '800', letterSpacing: '0.5px', marginBottom: '12px' },
    sumCardValue: { fontSize: '28px', fontWeight: '900', marginBottom: '4px', color: '#1e293b' },
    sumCardSub: { fontSize: '13px', color: '#94a3b8', fontWeight: '500' },
    sumCardBadge: { position: 'absolute', top: '16px', right: '16px', padding: '4px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: '800', color: 'white', textTransform: 'uppercase' },

    distributorList: { display: 'grid', gridTemplateColumns: '1fr', gap: '20px' },
    distCard: {
        backgroundColor: 'white',
        borderRadius: '22px',
        padding: '28px',
        border: '1px solid #f1f5f9',
        boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
        position: 'relative',
        overflow: 'hidden'
    },
    distCardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' },
    distName: { fontSize: '20px', fontWeight: '800', color: '#1e293b', margin: 0 },
    distRegion: { fontSize: '14px', color: '#94a3b8', fontWeight: '600', marginTop: '2px' },
    healthBadge: { padding: '6px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: '800', textTransform: 'uppercase' },
    trendBadge: { padding: '6px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: '700' },
    signalsRow: { display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '24px' },
    signalPill: {
        display: 'flex',
        alignItems: 'center',
        padding: '8px 16px',
        borderRadius: '12px',
        fontSize: '13px',
        fontWeight: '700',
        transition: 'all 0.2s ease'
    },
    divider: { height: '1.5px', backgroundColor: '#f1f5f9', margin: '0 0 20px 0' },
    quickStatsSection: { display: 'flex', gap: '24px' },
    smallStat: { display: 'flex', flexDirection: 'column' },
    smallLabel: { fontSize: '11px', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' },
    smallValue: { fontSize: '18px', fontWeight: '900', color: '#1e293b' },
    secondaryBtn: {
        padding: '10px 20px',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        backgroundColor: 'white',
        color: '#64748b',
        fontSize: '14px',
        fontWeight: '700',
        cursor: 'pointer',
        transition: 'all 0.2s ease'
    },
    loadingContainer: { padding: '40px' },
    skeletonTitle: { height: '30px', width: '300px', backgroundColor: '#e2e8f0', borderRadius: '8px', marginBottom: '10px' },
    skeletonSubtitle: { height: '15px', width: '450px', backgroundColor: '#f1f5f9', borderRadius: '4px' },
    skeletonCardSmall: { height: '140px', backgroundColor: 'white', borderRadius: '20px', border: '1px solid #f1f5f9' },
    skeletonDistCard: { height: '220px', backgroundColor: 'white', borderRadius: '22px', marginBottom: '20px', border: '1px solid #f1f5f9' }
};

export default MyDistributors;
