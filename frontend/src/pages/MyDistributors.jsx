import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

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

const MyDistributors = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();
    const token = sessionStorage.getItem('token');
    const [theme, setTheme] = useState(sessionStorage.getItem('theme') || 'light');

    const [fadeClass, setFadeClass] = useState('fluid-transition');

    useEffect(() => {
        const syncTheme = () => setTheme(sessionStorage.getItem('theme') || 'light');
        window.addEventListener('theme-changed', syncTheme);
        return () => window.removeEventListener('theme-changed', syncTheme);
    }, []);

    useEffect(() => {
        if (data) {
            setFadeClass('');
            const timer = setTimeout(() => setFadeClass('fluid-transition'), 10);
            return () => clearTimeout(timer);
        }
    }, [data]);

    const isDark = theme === 'dark';
    const bgColor = isDark ? '#0f172a' : '#faf7f2';
    const textColor = isDark ? '#f1f5f9' : '#1e293b';
    const cardBg = isDark ? '#1e293b' : 'white';
    const borderColor = isDark ? '#334155' : '#e2e8f0';
    const mutedColor = isDark ? '#94a3b8' : '#64748b';
    const panelBg = isDark ? 'rgba(30, 41, 59, 0.5)' : '#FEF9F3';
    const panelBorder = isDark ? '#334155' : '#EADDCF';
    const accentColor = isDark ? '#C8A96E' : '#8B5E3C';

    const styles = {
        mainContainer: { maxWidth: '1400px', margin: '0 auto', padding: '0 20px 60px' },
        header: { marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
        title: { fontSize: '32px', fontWeight: '900', margin: '0 0 4px 0', letterSpacing: '-1px' },
        subtitle: { fontSize: '16px', fontWeight: '500', margin: 0 },
        quickNav: {
            display: 'flex', gap: '12px', marginBottom: '32px', padding: '12px 0',
            borderBottom: `1.5px solid ${borderColor}`, overflowX: 'auto', className: 'hide-scrollbar',
            alignItems: 'center'
        },
        quickNavLabel: { fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', alignSelf: 'center', marginRight: '8px' },
        quickNavList: { display: 'flex', gap: '12px', overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' },
        navChip: {
            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'white',
            border: `1px solid ${borderColor}`, padding: '10px 18px', borderRadius: '12px',
            fontSize: '13px', fontWeight: '700', color: textColor, cursor: 'pointer', transition: 'all 0.2s ease',
            display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
        },
        navArrow: {
            background: 'none', border: 'none', color: mutedColor, cursor: 'pointer', fontSize: '18px', padding: '0 10px'
        },
        insightsPanel: {
            backgroundColor: cardBg, borderRadius: '24px', padding: '32px', marginBottom: '40px',
            position: 'relative', overflow: 'hidden', border: `1px solid ${borderColor}`
        },
        insightsHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: `1px solid ${borderColor}`, paddingBottom: '16px' },
        insightsTitle: { fontSize: '24px', fontWeight: '900', margin: 0, color: textColor, letterSpacing: '-0.5px' },
        insightsTag: { fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', backgroundColor: '#8B5E3C', color: 'white', padding: '6px 14px', borderRadius: '8px', letterSpacing: '1.5px' },
        insightsGrid: { display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '24px' },
        lossPanel: { backgroundColor: isDark ? 'rgba(15,23,42,0.5)' : '#FEF9F3', borderRadius: '20px', padding: '24px', border: `1px solid ${borderColor}`, boxShadow: '0 4px 12px rgba(0,0,0,0.04)' },
        panelHeading: { fontSize: '11px', fontWeight: '900', color: '#A67956', margin: '0 0 16px 0', letterSpacing: '1.2px', textTransform: 'uppercase' },
        lossMainRow: { display: 'flex', alignItems: 'center', gap: '32px' },
        lossStat: { flex: 1 },
        lossValue: { fontSize: '42px', fontWeight: '900', color: textColor, lineHeight: 1 },
        lossLabel: { fontSize: '14px', color: mutedColor, marginTop: '8px', fontWeight: '700' },
        lossDivider: { width: '1.5px', height: '50px', backgroundColor: borderColor },
        batchValue: { fontSize: '22px', fontWeight: '900', color: textColor },
        lossFooter: { marginTop: '20px', fontSize: '12px', color: mutedColor, fontStyle: 'italic', borderTop: `1px solid ${borderColor}`, paddingTop: '12px', opacity: 0.8 },
        trendPanel: { backgroundColor: isDark ? 'rgba(30,41,59,0.3)' : 'white', borderRadius: '20px', padding: '24px', border: `1px solid ${borderColor}` },
        trendRow: { display: 'flex', justifyContent: 'space-between', gap: '10px' },
        trendStat: {
            flex: 1, textAlign: 'center', padding: '16px 8px', borderRadius: '16px',
            backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc',
            border: `1px solid ${borderColor}`, boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
        },
        trendFooter: { marginTop: '20px', fontSize: '11px', color: mutedColor, textAlign: 'center', fontWeight: '600' },
        summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '40px' },
        summaryCard: {
            padding: '24px', borderRadius: '24px', backgroundColor: cardBg, position: 'relative',
            border: `1px solid ${borderColor}`, transition: 'transform 0.2s ease', boxShadow: '0 8px 24px rgba(0,0,0,0.04)',
        },
        sumCardHeader: { display: 'flex', justifyContent: 'space-between', color: mutedColor, fontSize: '12px', fontWeight: '800', letterSpacing: '0.5px', marginBottom: '12px' },
        sumCardValue: { fontSize: '28px', fontWeight: '900', color: textColor, marginBottom: '4px' },
        sumCardSub: { fontSize: '13px', color: mutedColor, fontWeight: '500' },
        sumCardBadge: { position: 'absolute', top: '16px', right: '16px', padding: '4px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: '800', color: 'white', textTransform: 'uppercase' },
        distributorList: { display: 'grid', gridTemplateColumns: '1fr', gap: '20px' },
        distCard: {
            backgroundColor: cardBg, borderRadius: '22px', padding: '28px', border: `1px solid ${borderColor}`,
            boxShadow: '0 4px 20px rgba(0,0,0,0.04)', position: 'relative', overflow: 'hidden'
        },
        distCardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' },
        distName: { fontSize: '20px', fontWeight: '800', margin: 0 },
        distRegion: { color: mutedColor, fontSize: '14px', fontWeight: '600', marginTop: '2px' },
        healthBadge: { padding: '6px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: '800', textTransform: 'uppercase' },
        trendBadge: { padding: '6px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: '700' },
        signalsRow: { display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '24px' },
        signalPill: {
            display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px',
            borderRadius: '12px', fontSize: '13px', fontWeight: '700', transition: 'all 0.2s ease'
        },
        divider: { height: '1.5px', backgroundColor: borderColor, margin: '0 0 20px 0' },
        quickStatsSection: { display: 'flex', gap: '24px' },
        smallStat: { display: 'flex', flexDirection: 'column' },
        smallLabel: { fontSize: '11px', fontWeight: '800', color: mutedColor, textTransform: 'uppercase', letterSpacing: '0.5px' },
        smallValue: { fontSize: '18px', fontWeight: '900' },
        secondaryBtn: {
            backgroundColor: isDark ? '#334155' : '#f8fafc', border: `1px solid ${borderColor}`,
            padding: '10px 20px', borderRadius: '12px', fontSize: '14px', color: textColor,
            fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s ease'
        },
        loadingContainer: { padding: '40px' },
        skeletonTitle: { height: '30px', width: '300px', backgroundColor: isDark ? '#1e293b' : '#e2e8f0', borderRadius: '8px', marginBottom: '10px' },
        skeletonSubtitle: { height: '15px', width: '450px', backgroundColor: isDark ? '#334155' : '#f1f5f9', borderRadius: '4px' },
        skeletonCardSmall: { height: '140px', backgroundColor: isDark ? '#1e293b' : 'white', borderRadius: '20px', border: `1px solid ${borderColor}` },
        skeletonDistCard: { height: '220px', backgroundColor: isDark ? '#1e293b' : 'white', borderRadius: '22px', border: `1px solid ${borderColor}`, marginBottom: '20px' }
    };

    const TrendStat = ({ count, label, color, icon, isDark }) => (
        <div style={{ 
            ...styles.trendStat, 
            backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#FEF9F3',
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : color + '30',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : color + '30'}`
        }}>
            <div style={{ fontSize: '20px', marginBottom: '4px' }}>{icon}</div>
            <div style={{ fontSize: '20px', fontWeight: '900', color }}><AnimatedCounter value={count} /></div>
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: isDark ? '#94a3b8' : '#64748b', textTransform: 'uppercase' }}>{label}</div>
        </div>
    );

    const SummaryStatCard = ({ label, value, sub, status, statusLabel, icon, isDark }) => (
        <div style={{
            ...styles.summaryCard,
            backgroundColor: isDark 
                ? (status === 'good' ? 'rgba(34,197,94,0.1)' : status === 'poor' ? 'rgba(239,68,68,0.1)' : '#1e293b')
                : (status === 'good' ? '#f0fdf4' : status === 'poor' ? '#fef2f2' : 'white'),
            border: `1px solid ${isDark 
                ? (status === 'good' ? 'rgba(34,197,94,0.2)' : status === 'poor' ? 'rgba(239,68,68,0.2)' : '#334155')
                : (status === 'good' ? '#bbf7d0' : status === 'poor' ? '#fecaca' : '#e2e8f0')}`,
            color: isDark ? '#f1f5f9' : '#1e293b'
        }}>
            <div style={{ ...styles.sumCardHeader, color: isDark ? '#94a3b8' : '#64748b' }}>
                <span style={styles.sumCardLabel}>{label}</span>
                {icon && <span>{icon}</span>}
            </div>
            <div style={{ 
                ...styles.sumCardValue, 
                color: isDark 
                    ? (status === 'good' ? '#4ade80' : status === 'poor' ? '#f87171' : '#f1f5f9')
                    : (status === 'good' ? '#166534' : status === 'poor' ? '#991b1b' : '#0f172a') 
            }}>
                {value}
            </div>
            <div style={{ ...styles.sumCardSub, color: isDark ? '#64748b' : '#94a3b8' }}>{sub}</div>
            {statusLabel && (
                <div style={{ ...styles.sumCardBadge, backgroundColor: status === 'good' ? '#22c55e' : '#ef4444' }}>
                    {statusLabel}
                </div>
            )}
        </div>
    );

    const SignalPill = ({ signal, labelPrefix, isDark }) => (
        <div style={{
            ...styles.signalPill,
            backgroundColor: isDark ? `${signal.color}20` : `${signal.color}15`,
            color: signal.color,
            border: `1px solid ${isDark ? `${signal.color}40` : `${signal.color}30`}`
        }}>
            <span style={{ fontSize: '10px', marginRight: '4px' }}>
                {signal.signal === 'good' ? '🟢' : signal.signal === 'poor' ? '🔴' : '🟡'}
            </span>
            <span style={{ fontWeight: '500' }}>{signal.label}</span>
            <span style={{ marginLeft: '6px', fontWeight: 'bold', opacity: 0.8 }}>— {signal.value}</span>
        </div>
    );

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
                <style>{`
                    @keyframes pulseSkeleton {
                        0%, 100% { opacity: 1; }
                        50% { opacity: 0.5; }
                    }
                    .skeleton-item {
                        animation: pulseSkeleton 1.5s infinite ease-in-out;
                    }
                `}</style>
                <div style={{ ...styles.header, marginBottom: '40px' }} className="skeleton-item">
                    <div>
                        <div style={{ ...styles.skeletonTitle }}></div>
                        <div style={{ ...styles.skeletonSubtitle }}></div>
                    </div>
                </div>
                
                <div style={{ ...styles.insightsPanel, padding: '32px', marginBottom: '40px' }} className="skeleton-item">
                    <div style={{ height: '24px', width: '250px', backgroundColor: isDark ? '#334155' : '#EADDCF', borderRadius: '4px', marginBottom: '24px' }}></div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '24px' }}>
                        <div style={{ height: '180px', backgroundColor: isDark ? '#0f172a' : '#fdfaf5', borderRadius: '20px', border: `1px solid ${borderColor}` }}></div>
                        <div style={{ height: '180px', backgroundColor: isDark ? '#0f172a' : '#fdfaf5', borderRadius: '20px', border: `1px solid ${borderColor}` }}></div>
                    </div>
                </div>

                <div style={{ ...styles.summaryGrid, marginBottom: '40px' }}>
                    {[1, 2, 3].map(i => (
                        <div key={i} style={{ ...styles.summaryCard, height: '120px' }} className="skeleton-item">
                            <div style={{ height: '12px', width: '40%', backgroundColor: isDark ? '#334155' : '#e2e8f0', borderRadius: '4px', marginBottom: '16px' }}></div>
                            <div style={{ height: '28px', width: '60%', backgroundColor: isDark ? '#334155' : '#e2e8f0', borderRadius: '4px', marginBottom: '16px' }}></div>
                            <div style={{ height: '12px', width: '80%', backgroundColor: isDark ? '#334155' : '#f1f5f9', borderRadius: '4px' }}></div>
                        </div>
                    ))}
                </div>

                <div style={styles.distributorList}>
                    {[1, 2].map(i => (
                        <div key={i} style={{ ...styles.distCard, height: '160px' }} className="skeleton-item">
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                                <div style={{ height: '24px', width: '200px', backgroundColor: isDark ? '#334155' : '#e2e8f0', borderRadius: '4px' }}></div>
                                <div style={{ height: '40px', width: '80px', backgroundColor: isDark ? '#334155' : '#e2e8f0', borderRadius: '8px' }}></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={`dashboard-container ${theme}`} style={{ minHeight: '100vh', backgroundColor: bgColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ backgroundColor: cardBg, padding: '40px', borderRadius: '24px', border: `1px solid ${borderColor}`, textAlign: 'center' }}>
                    <h2 style={{ color: '#ef4444' }}>Error</h2>
                    <p style={{ color: textColor }}>{error}</p>
                    <button 
                        style={{ ...styles.secondaryBtn, marginTop: '20px', backgroundColor: '#ef4444', color: 'white', border: 'none' }} 
                        onClick={() => window.location.reload()}
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    if (!data || !data.distributors || data.distributors.length === 0) {
        return (
            <div className={`dashboard-container ${theme}`} style={{ minHeight: '100vh', backgroundColor: bgColor, color: textColor }}>
                <div style={styles.mainContainer}>
                    <div style={styles.header}>
                        <div>
                            <h1 style={{ ...styles.title, color: isDark ? '#f8fafc' : '#005696' }}>My Distributor Relationships</h1>
                            <p style={{ ...styles.subtitle, color: mutedColor }}>No dispatch history found yet.</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`dashboard-container ${theme}`} style={{ minHeight: '100vh', backgroundColor: bgColor, color: textColor }}>
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
                    <button onClick={() => {
                        const newTheme = theme === 'dark' ? 'light' : 'dark';
                        setTheme(newTheme);
                        sessionStorage.setItem('theme', newTheme);
                        window.dispatchEvent(new Event('theme-changed'));
                    }} style={{
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
            <div style={styles.mainContainer}>
                {/* Header */}
                <div style={styles.header}>
                    <div>
                        <h1 style={{ ...styles.title, color: isDark ? '#f8fafc' : '#005696' }}>Distributor Intelligence & Scorecards</h1>
                        <p style={{ ...styles.subtitle, color: mutedColor }}>Personal dispatch history — returns, collection speed, and field performance</p>
                    </div>
                </div>

                {/* Quick Navigation Bar */}
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
                </div>

                {/* Contract Insights Section */}
                <div style={{ ...styles.insightsPanel, backgroundColor: panelBg, border: `1px solid ${panelBorder}`, boxShadow: isDark ? '0 10px 40px rgba(0,0,0,0.4)' : '0 10px 40px rgba(166, 121, 86, 0.12)' }}>
                    <div style={{ ...styles.insightsHeader, borderBottom: `1.5px solid ${panelBorder}` }}>
                        <h2 style={{ ...styles.insightsTitle, color: accentColor }}>📊 Contract Performance Insights</h2>
                        <span style={styles.insightsTag}>Strategic Overview</span>
                    </div>

                    <div style={styles.insightsGrid}>
                        {/* Freshness Loss Summary Panel */}
                        <div style={{ ...styles.lossPanel, backgroundColor: cardBg, border: `1px solid ${borderColor}` }}>
                            <h3 style={styles.panelHeading}>STOCK LOSS SUMMARY</h3>
                            <div style={styles.lossMainRow}>
                                <div style={styles.lossStat}>
                                    <div style={{ ...styles.lossValue, color: textColor }}><AnimatedCounter value={data.totalUnitsLost || 0} /></div>
                                    <div style={{ ...styles.lossLabel, color: mutedColor }}>Total Units Lost</div>
                                </div>
                                <div style={{ ...styles.lossDivider, backgroundColor: borderColor }}></div>
                                <div style={{ display: 'flex', gap: '20px' }}>
                                    <div style={styles.lossStat}>
                                        <div style={{ ...styles.batchValue, color: '#ef4444' }}>
                                            <AnimatedCounter value={data.totalReturnsCount || 0} /> <span style={{ fontSize: '14px', opacity: 0.8 }}>Batches</span>
                                        </div>
                                        <div style={{ ...styles.lossLabel, color: mutedColor }}><AnimatedCounter value={data.totalReturnsUnits || 0} /> Units Returned</div>
                                    </div>
                                    <div style={{ ...styles.lossDivider, backgroundColor: borderColor }}></div>
                                    <div style={styles.lossStat}>
                                        <div style={{ ...styles.batchValue, color: '#C8A96E' }}>
                                            <AnimatedCounter value={data.totalClearancesCount || 0} /> <span style={{ fontSize: '14px', opacity: 0.8 }}>Batches</span>
                                        </div>
                                        <div style={{ ...styles.lossLabel, color: mutedColor }}><AnimatedCounter value={data.totalClearancesUnits || 0} /> Emergency Cleared</div>
                                    </div>
                                </div>
                            </div>
                            <div style={{ ...styles.lossFooter, borderTop: `1px solid ${borderColor}`, color: mutedColor }}>
                                ℹ Breakdown of stock impact from distributor returns vs. warehouse emergency clearances.
                            </div>
                        </div>

                        {/* Trend Breakdown Panel */}
                        <div style={{ ...styles.trendPanel, backgroundColor: cardBg, border: `1px solid ${borderColor}` }}>
                            <h3 style={styles.panelHeading}>PORTFOLIO TREND</h3>
                            <div style={styles.trendRow}>
                                <TrendStat
                                    count={data.portfolioTrend?.improving || 0}
                                    label="Improving"
                                    color="#22c55e"
                                    icon="📈"
                                    isDark={isDark}
                                />
                                <TrendStat
                                    count={data.portfolioTrend?.stable || 0}
                                    label="Stable"
                                    color="#3b82f6"
                                    icon="📊"
                                    isDark={isDark}
                                />
                                <TrendStat
                                    count={data.portfolioTrend?.declining || 0}
                                    label="Declining"
                                    color="#ef4444"
                                    icon="📉"
                                    isDark={isDark}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Summary Cards Row */}
                <div style={styles.summaryGrid}>
                    <SummaryStatCard
                        label="BATCH RETURN RATE"
                        value={<><AnimatedCounter value={data.yourOverallReturnRate || 0} />%</>}
                        sub={`System Avg: ${data.systemAvgReturnRate || 0}%`}
                        status={(data.yourOverallReturnRate || 0) <= (data.systemAvgReturnRate || 0) ? 'good' : 'poor'}
                        statusLabel={(data.yourOverallReturnRate || 0) <= (data.systemAvgReturnRate || 0) ? '✅ Below avg' : '⚠ Above avg'}
                        isDark={isDark}
                    />
                    <SummaryStatCard
                        label="AVG PICKUP DELAY"
                        value={<><AnimatedCounter value={data.yourAvgCollectionDelay || 0} /> days</>}
                        sub={`System Avg: ${data.systemAvgCollectionDelay || 0}d`}
                        status={(data.yourAvgCollectionDelay || 0) <= (data.systemAvgCollectionDelay || 0) ? 'good' : 'poor'}
                        statusLabel={(data.yourAvgCollectionDelay || 0) <= (data.systemAvgCollectionDelay || 0) ? '✅ Below avg' : '⚠ Above avg'}
                        isDark={isDark}
                    />
                    <SummaryStatCard
                        label="TOTAL UNITS LOST"
                        value={<AnimatedCounter value={data.totalUnitsLost || 0} />}
                        sub={`${data.totalReturnsUnits || 0} Returns + ${data.totalClearancesUnits || 0} Emergency Clearances`}
                        status="poor"
                        icon="📦"
                        isDark={isDark}
                    />
                </div>

                {/* Distributor List */}
                <div>
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
                                borderBottom: `2px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
                                paddingBottom: '10px'
                            }}>
                                <h2 style={{ fontSize: '18px', color: textColor, margin: 0, fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
                                    <span style={{ color: '#A67956' }}>📍</span> {region}
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
                                            borderLeft: `8px solid ${dist.healthColor}`,
                                            cursor: 'pointer',
                                            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                            <h2 style={{ ...styles.distName, color: textColor }}>{dist.distributorName}</h2>
                                            <div style={{ backgroundColor: `${dist.healthColor}15`, border: `1.5px solid ${dist.healthColor}40`, borderRadius: '12px', padding: '6px 14px', textAlign: 'center' }}>
                                                <span style={{ fontSize: '9px', fontWeight: '900', color: dist.healthColor, textTransform: 'uppercase' }}>Score</span>
                                                <div style={{ fontSize: '20px', fontWeight: '900', color: dist.healthColor }}>{dist.overallScore}</div>
                                            </div>
                                        </div>

                                        <div style={styles.signalsRow}>
                                            {dist.signals && (
                                                <>
                                                    <SignalPill signal={dist.signals.returnSignal} isDark={isDark} />
                                                    <SignalPill signal={dist.signals.delaySignal} isDark={isDark} />
                                                </>
                                            )}
                                        </div>

                                        <div style={styles.divider}></div>

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={styles.smallStat}>
                                                <span style={styles.smallLabel}>Return rate:</span>
                                                <span style={{ ...styles.smallValue, color: dist.healthColor }}>{dist.managerReturnRate}%</span>
                                            </div>
                                            <button style={{ backgroundColor: isDark ? '#C8A96E' : '#5c3a21', color: isDark ? '#0f172a' : 'white', border: 'none', padding: '8px 20px', borderRadius: '8px', fontWeight: 'bold' }}>
                                                VIEW CONTRACT →
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

export default MyDistributors;
