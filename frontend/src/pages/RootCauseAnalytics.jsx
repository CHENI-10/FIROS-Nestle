import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip } from 'recharts';
const AnimatedCounter = ({ value }) => {
    const [count, setCount] = useState(0);

    useEffect(() => {
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

const RootCauseAnalytics = () => {
    const navigate = useNavigate();
    const token = sessionStorage.getItem('token');

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [currentMonthStr, setCurrentMonthStr] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });

    const [theme, setTheme] = useState(sessionStorage.getItem('theme') || 'light');

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

    const isDark = theme === 'dark';
    const bgColor = isDark ? '#0f172a' : '#faf7f2';
    const textColor = isDark ? '#f1f5f9' : '#1e293b';
    const cardBg = isDark ? '#1e293b' : '#ffffff';
    const borderColor = isDark ? '#334155' : '#e2e8f0';
    const mutedColor = isDark ? '#94a3b8' : '#64748b';

    const [selectedPeriod, setSelectedPeriod] = useState(null);
    const [expandedBatches, setExpandedBatches] = useState({});
    const [assignedActions, setAssignedActions] = useState({});
    const reportRef = useRef(null);
    const [fadeClass, setFadeClass] = useState('fluid-transition');

    useEffect(() => {
        if (data) {
            setFadeClass('');
            const timer = setTimeout(() => setFadeClass('fluid-transition'), 10);
            return () => clearTimeout(timer);
        }
    }, [data]);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                let url = '/api/root-cause';
                if (selectedPeriod) {
                    url += `?period=${selectedPeriod}`;
                } else {
                    const [year, month] = currentMonthStr.split('-');
                    url += `?month=${parseInt(month)}&year=${year}`;
                }

                console.log(`[DEBUG] Fetching from URL: ${url}`);
                const res = await fetch(url, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!res.ok) {
                    if (res.status === 403 || res.status === 401) {
                        navigate('/dashboard');
                        return;
                    }
                    throw new Error('Failed to fetch data');
                }

                const result = await res.json();
                setData(result);

            } catch (err) {
                console.error("Error fetching root cause data:", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [currentMonthStr, selectedPeriod, token, navigate]);

    const handleExport = () => {
        if (!data) return;
        const pLabel = data.periodLabel || 'Report';
        const rootCauseRows = (data.rootCauses || []).filter(rc => rc.count > 0).map(rc => {
            const batchRows = rc.batches.map(b => `
                <tr>
                    <td>${b.batchId}</td>
                    <td>${b.productName}</td>
                    <td>${new Date(b.dispatched_at).toLocaleDateString()}</td>
                    <td>Zone ${b.zone}</td>
                    <td>${b.distributor_name || b.distributorName || 'N/A'}</td>
                    <td style="color:#dc2626;font-weight:700;">RETURNED</td>
                </tr>`).join('');
            return `
                <div class="section">
                    <div class="cat-header" style="border-left:5px solid ${rc.color};">
                        <span>${rc.icon} <strong>${rc.category.toUpperCase()}</strong></span>
                        <span class="badge">${rc.count} Batch${rc.count > 1 ? 'es' : ''} (${rc.percentage}%)</span>
                    </div>
                    ${rc.patternText ? `<p class="pattern">${rc.patternText}</p>` : ''}
                    ${rc.suggestedAction ? `<div class="action">&#128161; <strong>Action Plan:</strong> ${rc.suggestedAction}</div>` : ''}
                    <table>
                        <thead><tr><th>Batch ID</th><th>Product</th><th>Dispatched</th><th>Zone</th><th>Distributor</th><th>Status</th></tr></thead>
                        <tbody>${batchRows}</tbody>
                    </table>
                </div>`;
        }).join('');

        const pw = window.open('', '_blank');
        pw.document.write(`<!DOCTYPE html><html><head>
            <title>Root Cause Intelligence - ${pLabel}</title>
            <style>
                *{margin:0;padding:0;box-sizing:border-box;}
                body{font-family:Arial,sans-serif;font-size:13px;color:#1e293b;padding:30px;background:#fff;}
                .header{border-bottom:3px solid #1e40af;padding-bottom:14px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:flex-end;}
                .title{font-size:22px;font-weight:900;color:#1e3a8a;}
                .sub{font-size:12px;color:#64748b;margin-top:4px;}
                .meta{font-size:11px;color:#94a3b8;text-align:right;}
                .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px;}
                .kpi{padding:14px;border-radius:8px;border:1px solid #e2e8f0;}
                .kpi-label{font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;}
                .kpi-value{font-size:30px;font-weight:900;line-height:1;}
                .kpi-sub{font-size:11px;color:#94a3b8;margin-top:3px;}
                .breakdown-title{font-size:10px;font-weight:800;letter-spacing:2px;color:#94a3b8;text-transform:uppercase;margin-bottom:14px;}
                .section{margin-bottom:22px;page-break-inside:avoid;}
                .cat-header{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:#f8fafc;border-radius:6px;margin-bottom:10px;}
                .badge{font-size:11px;background:#e2e8f0;padding:3px 9px;border-radius:10px;font-weight:600;color:#475569;}
                .pattern{font-size:12px;color:#334155;margin-bottom:8px;line-height:1.5;}
                .action{background:#eef2ff;border:1px solid #c7d2fe;border-radius:6px;padding:9px 12px;margin-bottom:10px;font-size:12px;color:#3730a3;line-height:1.5;}
                table{width:100%;border-collapse:collapse;font-size:12px;}
                th{background:#f1f5f9;padding:8px 10px;text-align:left;font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:#64748b;border-bottom:2px solid #e2e8f0;}
                td{padding:9px 10px;border-bottom:1px solid #f1f5f9;color:#334155;font-weight:500;}
                tr:last-child td{border-bottom:none;}
                .footer{margin-top:28px;padding-top:10px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8;text-align:center;}
            </style></head><body>
            <div class="header">
                <div><div class="title">Root Cause Intelligence Report</div><div class="sub">Period: ${pLabel}</div></div>
                <div class="meta">Generated: ${new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'})}<br/>FIROS Warehouse Intelligence</div>
            </div>
            <div class="kpis">
                <div class="kpi" style="border-top:4px solid #3b82f6;"><div class="kpi-label" style="color:#3b82f6;">Dispatched</div><div class="kpi-value">${data.summary.totalDispatched}</div><div class="kpi-sub">batches sent</div></div>
                <div class="kpi" style="border-top:4px solid #10b981;"><div class="kpi-label" style="color:#10b981;">Successful</div><div class="kpi-value">${data.summary.totalCleared}</div><div class="kpi-sub">batches cleared</div></div>
                <div class="kpi" style="border-top:4px solid #f43f5e;"><div class="kpi-label" style="color:#f43f5e;">Returned</div><div class="kpi-value">${data.summary.totalReturned}</div><div class="kpi-sub">batches returned</div></div>
                <div class="kpi" style="border-top:4px solid #f59e0b;"><div class="kpi-label" style="color:#f59e0b;">Failure Rate</div><div class="kpi-value">${data.summary.totalDispatched > 0 ? Math.round((data.summary.totalReturned/data.summary.totalDispatched)*100) : 0}%</div><div class="kpi-sub">of dispatches</div></div>
            </div>
            <div class="breakdown-title">Loss Intelligence Breakdown</div>
            ${rootCauseRows}
            <div class="footer">Confidential — FIROS Warehouse Intelligence System &nbsp;|&nbsp; ${new Date().toLocaleString()}</div>
        </body></html>`);
        pw.document.close();
        pw.focus();
        setTimeout(() => pw.print(), 600);
    };

    const toggleBatches = (category) => {
        setExpandedBatches(prev => ({
            ...prev,
            [category]: !prev[category]
        }));
    };

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', backgroundColor: bgColor, padding: '40px' }}>
                <style>{`
                    @keyframes pulseSkeleton { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
                    .skeleton-item { animation: pulseSkeleton 1.5s infinite ease-in-out; }
                    .loading-msg {
                        background: linear-gradient(135deg, #1a3a5c 0%, #295380 100%);
                        color: #f8fafc; padding: 12px 24px; border-radius: 30px; display: inline-block;
                        font-weight: 800; font-size: 16px; box-shadow: 0 4px 15px rgba(26, 58, 92, 0.4);
                        letter-spacing: 0.5px; border: 1px solid rgba(200, 169, 110, 0.3);
                        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 9999;
                    }
                `}</style>
                <div style={{ textAlign: 'center' }} className="skeleton-item">
                    <div className="loading-msg">🧠 Scanning Intelligence Engine...</div>
                </div>
                <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
                    <div className="skeleton-item" style={{ height: '60px', width: '300px', backgroundColor: isDark ? '#1e293b' : '#e2e8f0', borderRadius: '8px', marginBottom: '32px' }} />
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '32px' }}>
                        {[1, 2, 3, 4].map(i => <div key={i} className="skeleton-item" style={{ height: '140px', backgroundColor: isDark ? '#1e293b' : 'white', borderRadius: '16px', border: `1px solid ${borderColor}` }} />)}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {[1, 2, 3].map(i => <div key={i} className="skeleton-item" style={{ height: '120px', backgroundColor: isDark ? '#1e293b' : 'white', borderRadius: '12px', border: `1px solid ${borderColor}` }} />)}
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#faf7f2', fontFamily: "'Outfit', sans-serif" }}>
            <div style={{ color: '#ef4444', fontSize: '18px', fontWeight: 'bold' }}>Error: {error}</div>
        </div>;
    }

    if (!data) return null;

    const getTrendBadge = (val, isFailures = false) => {
        return null; // Logic removed as per user request to declutter UI
    };
    
    const styles = {
        container: { maxWidth: '1400px', margin: '0 auto', minHeight: '100vh' },
        header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' },
        title: { fontSize: '32px', fontWeight: '900', color: isDark ? '#f8fafc' : '#1a3a5c', margin: 0, letterSpacing: '-1px' },
        exportBtn: {
            backgroundColor: '#1a3a5c', color: '#fff', border: 'none', padding: '12px 24px',
            borderRadius: '12px', cursor: 'pointer', fontWeight: '800', fontSize: '14px',
            boxShadow: '0 4px 12px rgba(26, 58, 92, 0.2)', transition: 'all 0.2s ease'
        },
        navSection: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '20px' },
        periodTabs: { display: 'flex', gap: '10px', backgroundColor: isDark ? '#1e293b' : '#fff', padding: '6px', borderRadius: '14px', border: `1px solid ${borderColor}` },
        tabBtn: {
            padding: '8px 16px', borderRadius: '10px', border: 'none', background: 'none',
            color: mutedColor, cursor: 'pointer', fontWeight: '700', fontSize: '13px', transition: 'all 0.2s'
        },
        activeTab: { backgroundColor: '#1a3a5c', color: '#fff' },
        navRow: { display: 'flex', alignItems: 'center', gap: '12px' },
        monthSelect: {
            padding: '10px 16px', borderRadius: '12px', border: `1px solid ${borderColor}`,
            backgroundColor: isDark ? '#1e293b' : '#fff', color: textColor, fontWeight: '700', fontSize: '14px', cursor: 'pointer', outline: 'none'
        },
        refreshBtn: {
            backgroundColor: isDark ? '#334155' : '#fff', color: textColor, border: `1px solid ${borderColor}`,
            padding: '10px 16px', borderRadius: '12px', fontWeight: '700', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px'
        },
        generateBtn: {
            backgroundColor: '#C8A96E', color: '#fff', border: 'none', padding: '12px 28px',
            borderRadius: '12px', fontWeight: '900', fontSize: '16px', cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(200, 169, 110, 0.3)', transition: 'all 0.2s'
        },
        section: { marginBottom: '50px' },
        sectionTitle: {
            fontSize: '14px', fontWeight: '900', color: isDark ? '#C8A96E' : '#8B5E3C',
            textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '24px',
            display: 'flex', alignItems: 'center', gap: '12px'
        },
        statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px', marginBottom: '50px' },
        statCard: {
            backgroundColor: cardBg, padding: '32px', borderRadius: '20px',
            boxShadow: isDark ? '0 8px 30px rgba(0,0,0,0.2)' : '0 4px 20px rgba(0,0,0,0.03)',
            textAlign: 'left', border: `1px solid ${borderColor}`
        },
        statLabel: { fontSize: '12px', fontWeight: '900', letterSpacing: '1.5px', marginBottom: '16px', color: mutedColor },
        statValue: { fontSize: '48px', fontWeight: '900', color: textColor, lineHeight: '1', marginBottom: '8px' },
        statSub: { fontSize: '13px', color: mutedColor, fontWeight: '700', display: 'flex', alignItems: 'center', flexWrap: 'wrap' },
        card: {
            backgroundColor: cardBg, padding: '32px', borderRadius: '20px',
            boxShadow: isDark ? '0 8px 30px rgba(0,0,0,0.2)' : '0 4px 20px rgba(0,0,0,0.03)',
            border: `1px solid ${borderColor}`
        },
        barBg: { backgroundColor: isDark ? '#334155' : '#f1f5f9', height: '10px', borderRadius: '5px', overflow: 'hidden' },
        barFill: { height: '100%', fontWeight: 'bold' },
        riskBadge: { padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' },
        pillBadge: {
            backgroundColor: isDark ? '#334155' : '#f8fafc', border: `1px solid ${borderColor}`,
            padding: '5px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: '600',
            color: textColor, fontFamily: "'Outfit', sans-serif", letterSpacing: '0.2px'
        },
        actionBox: {
            backgroundColor: isDark ? 'rgba(79, 70, 229, 0.1)' : '#eef2ff',
            border: `1px solid ${isDark ? 'rgba(79, 70, 229, 0.3)' : '#c7d2fe'}`,
            padding: '16px 20px', borderRadius: '12px', display: 'flex', gap: '14px', alignItems: 'center'
        },
        toggleBtn: { background: 'none', border: 'none', color: '#3b82f6', padding: '0', cursor: 'pointer', fontSize: '14px', fontWeight: '700', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.2px' },
        table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontFamily: "'Outfit', sans-serif" },
        th: {
            padding: '12px 18px', borderBottom: `2px solid ${borderColor}`, color: mutedColor,
            fontWeight: '700', fontSize: '13px', backgroundColor: isDark ? '#1e293b' : '#f8fafc',
            letterSpacing: '0.5px', textTransform: 'uppercase', fontFamily: "'Outfit', sans-serif"
        },
        td: { padding: '14px 18px', borderBottom: `1px solid ${borderColor}`, fontSize: '14px', color: textColor, fontFamily: "'Outfit', sans-serif", fontWeight: '500', lineHeight: '1.5' },
        skuChip: {
            backgroundColor: isDark ? '#334155' : '#f1f5f9', border: `1px solid ${borderColor}`,
            padding: '4px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: '600',
            color: textColor, fontFamily: "'Outfit', sans-serif"
        },
        statusBadge: { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '800', letterSpacing: '0.5px', fontFamily: "'Outfit', sans-serif" },
        tr: { transition: 'background 0.15s ease', cursor: 'pointer' },
    };

    return (
        <div style={{ backgroundColor: bgColor, minHeight: '100vh', fontFamily: "'Outfit', sans-serif", color: textColor }}>
            {/* GOOGLE FONTS IMPORT */}
            <style>
                {`
                @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap');
                @keyframes fadeSlideIn {
                    from { opacity: 0; transform: translateY(15px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .fluid-transition {
                    animation: fadeSlideIn 0.5s ease-out forwards;
                }
                .rc-row:hover {
                    background-color: ${isDark ? 'rgba(255, 255, 255, 0.05)' : '#f8fafc'} !important;
                }
                `}
            </style>

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

            <div style={{ ...styles.container, padding: '16px 24px' }} ref={reportRef}>
                {/* Header */}
                <div style={styles.header}>
                    <div>
                        <h1 style={{ ...styles.title, color: isDark ? '#f8fafc' : '#1a3a5c' }}>Root Cause Intelligence</h1>
                    </div>
                    <button onClick={handleExport} style={styles.exportBtn}>Export Intel</button>
                </div>



                {/* Period Selection Row */}
                <div style={styles.navSection}>
                    <div style={styles.periodTabs}>
                        <button
                            style={{ ...styles.tabBtn, ...(selectedPeriod === null ? styles.activeTab : {}) }}
                            onClick={() => setSelectedPeriod(null)}
                        >
                            Monthly Report
                        </button>
                        {[30, 60, 90].map(p => (
                            <button
                                key={p}
                                style={{ ...styles.tabBtn, ...(selectedPeriod === p ? styles.activeTab : {}) }}
                                onClick={() => setSelectedPeriod(p)}
                            >
                                {p} Days
                            </button>
                        ))}
                    </div>

                    {!selectedPeriod && (
                        <div style={styles.navRow}>
                            <select
                                value={`${data.year}-${String(data.month).padStart(2, '0')}`}
                                onChange={(e) => {
                                    setCurrentMonthStr(e.target.value);
                                    setSelectedPeriod(null);
                                }}
                                style={styles.monthSelect}
                            >
                                {data.availableMonths.map(m => (
                                    <option key={`${m.year}-${m.month}`} value={`${m.year}-${String(m.month).padStart(2, '0')}`}>
                                        {m.label} {m.year === new Date().getFullYear() && m.month === new Date().getMonth() + 1 ? '(Current)' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {selectedPeriod && (
                        <div style={styles.periodHeader}>
                            <span style={styles.monthLabel}>{data.periodLabel}</span>
                            <span style={styles.periodSub}>({new Date(new Date().setDate(new Date().getDate() - selectedPeriod)).toLocaleDateString()} - Today)</span>
                        </div>
                    )}
                </div>

                <div className={fadeClass}>
                    {data.summary.totalDispatched === 0 && data.summary.totalFailed === 0 ? (
                        <div style={styles.card}>
                            <h3 style={{ marginTop: 0, color: '#64748b' }}>No data for {data.periodLabel}.</h3>
                            <p style={{ color: '#94a3b8' }}>All operations are currently inactive for this timeframe.</p>
                        </div>
                    ) : (
                        <>
                            {/* SECTION 1: METRICS GRID */}
                            <div style={styles.statsGrid}>
                                <div style={{ ...styles.statCard, borderTop: '4px solid #3b82f6' }}>
                                    <div style={{ ...styles.statLabel, color: '#3b82f6' }}>DISPATCHED</div>
                                    <div style={styles.statValue}><AnimatedCounter value={data.summary.totalDispatched} /></div>
                                    <div style={styles.statSub}>batches sent</div>
                                </div>
                                <div style={{ ...styles.statCard, borderTop: '4px solid #10b981' }}>
                                    <div style={{ ...styles.statLabel, color: '#10b981' }}>SUCCESSFUL</div>
                                    <div style={styles.statValue}><AnimatedCounter value={data.summary.totalCleared} /></div>
                                    <div style={styles.statSub}>batches cleared</div>
                                </div>
                                <div style={{ ...styles.statCard, borderTop: '4px solid #f43f5e' }}>
                                    <div style={{ ...styles.statLabel, color: '#f43f5e' }}>RETURNED</div>
                                    <div style={styles.statValue}><AnimatedCounter value={data.summary.totalReturned} /></div>
                                    <div style={styles.statSub}>
                                        batches returned
                                    </div>
                                </div>

                                <div style={{ ...styles.statCard, borderTop: `4px solid ${data.summary.failureRate > 10 ? '#f43f5e' : data.summary.failureRate > 5 ? '#f59e0b' : '#10b981'}` }}>
                                    <div style={{ ...styles.statLabel, color: data.summary.failureRate > 10 ? '#f43f5e' : data.summary.failureRate > 5 ? '#f59e0b' : '#10b981' }}>FAILURE RATE</div>
                                    <div style={styles.statValue}><AnimatedCounter value={data.summary.failureRate} />%</div>
                                    <div style={styles.statSub}>of total dispatches</div>
                                </div>
                        </div>

                        {/* SECTION 2: ROOT CAUSE CLASSIFICATION */}
                        <div style={styles.section}>
                            <h2 style={styles.sectionTitle}>Loss Intelligence Breakdown</h2>
                            {data.summary.totalFailed === 0 ? (
                                <div style={{ ...styles.card, backgroundColor: '#f0fdf4', borderColor: '#bbf7d0', textAlign: 'center' }}>
                                    <div style={{ fontSize: '32px', marginBottom: '12px' }}>🛡️</div>
                                    <strong style={{ color: '#166534', fontSize: '18px' }}>Zero Batch Failures Detected</strong><br />
                                    <span style={{ color: '#166534' }}>Your operational protocol is performing flawlessly in this period.</span>
                                </div>
                            ) : (
                                <div style={styles.card}>
                                    {(() => {
                                        const PIE_CATEGORIES = [
                                            { name: 'Temperature-Driven', color: '#f43f5e', icon: '🌡️', gradient: 'linear-gradient(135deg, #f43f5e, #e11d48)' },
                                            { name: 'Long Storage',       color: '#f59e0b', icon: '📦', gradient: 'linear-gradient(135deg, #f59e0b, #d97706)' },
                                            { name: 'Distributor Delay',  color: '#8b5cf6', icon: '🚚', gradient: 'linear-gradient(135deg, #8b5cf6, #7c3aed)' },
                                            { name: 'Unclassified',       color: '#64748b', icon: '❓', gradient: 'linear-gradient(135deg, #64748b, #475569)' },
                                        ];

                                        const pieData = PIE_CATEGORIES
                                            .map(cat => {
                                                const rc = data.rootCauses.find(c => c.category === cat.name) || { count: 0, percentage: 0 };
                                                return { ...cat, count: rc.count, percentage: rc.percentage };
                                            })
                                            .filter(d => d.count > 0);

                                        const totalFailed = pieData.reduce((s, d) => s + d.count, 0);

                                        const CustomTooltip = ({ active, payload }) => {
                                            if (active && payload && payload.length) {
                                                const d = payload[0].payload;
                                                return (
                                                    <div style={{
                                                        background: isDark ? '#1e293b' : 'white',
                                                        border: `2px solid ${d.color}`,
                                                        borderRadius: '12px',
                                                        padding: '12px 18px',
                                                        boxShadow: isDark ? `0 8px 24px rgba(0,0,0,0.5)` : `0 8px 24px ${d.color}33`,
                                                        fontFamily: "'Outfit', sans-serif"
                                                    }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                                            <span style={{ fontSize: '18px' }}>{d.icon}</span>
                                                            <span style={{ fontWeight: '900', fontSize: '14px', color: d.color }}>{d.name}</span>
                                                        </div>
                                                        <div style={{ fontSize: '22px', fontWeight: '900', color: textColor, lineHeight: 1 }}>{d.count}</div>
                                                        <div style={{ fontSize: '12px', color: mutedColor, marginTop: '2px' }}>batches · {d.percentage}% of failures</div>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        };

                                        return (
                                            <div style={{ display: 'flex', gap: '40px', alignItems: 'center', flexWrap: 'wrap' }}>
                                                {/* Pie Chart */}
                                                <div style={{ position: 'relative', flexShrink: 0 }}>
                                                    <PieChart width={280} height={280}>
                                                        <Pie
                                                            data={pieData}
                                                            cx={135}
                                                            cy={135}
                                                            innerRadius={78}
                                                            outerRadius={126}
                                                            paddingAngle={3}
                                                            dataKey="count"
                                                            strokeWidth={0}
                                                        >
                                                            {pieData.map((entry, i) => (
                                                                <Cell key={i} fill={entry.color} />
                                                            ))}
                                                        </Pie>
                                                        <Tooltip content={<CustomTooltip />} />
                                                    </PieChart>
                                                    {/* Center label */}
                                                    <div style={{
                                                        position: 'absolute',
                                                        top: '50%', left: '50%',
                                                        transform: 'translate(-50%, -50%)',
                                                        textAlign: 'center',
                                                        pointerEvents: 'none'
                                                    }}>
                                                        <div style={{ fontSize: '36px', fontWeight: '900', color: '#1e293b', lineHeight: 1 }}>{totalFailed}</div>
                                                        <div style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>Total</div>
                                                        <div style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Failed</div>
                                                    </div>
                                                </div>

                                                {/* Legend Panel */}
                                                <div style={{ flex: 1, minWidth: '220px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                                    {PIE_CATEGORIES.map(cat => {
                                                        const rc = data.rootCauses.find(c => c.category === cat.name) || { count: 0, percentage: 0 };
                                                        const active = rc.count > 0;
                                                        return (
                                                            <div 
                                                                key={cat.name} 
                                                                onClick={() => {
                                                                    if (active) {
                                                                        document.getElementById(`diagnostic-${cat.name}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                                    }
                                                                }}
                                                                style={{
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '14px',
                                                                    padding: '14px 18px',
                                                                    borderRadius: '14px',
                                                                    background: active ? (isDark ? `${cat.color}15` : `${cat.color}0d`) : (isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc'),
                                                                    border: `1.5px solid ${active ? cat.color + '33' : borderColor}`,
                                                                    opacity: active ? 1 : 0.45,
                                                                    transition: 'all 0.2s ease',
                                                                    cursor: active ? 'pointer' : 'default',
                                                                    transform: active ? 'scale(1)' : 'scale(1)',
                                                                }}
                                                                onMouseEnter={(e) => {
                                                                    if (active) {
                                                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                                                        e.currentTarget.style.boxShadow = `0 4px 12px ${cat.color}1a`;
                                                                    }
                                                                }}
                                                                onMouseLeave={(e) => {
                                                                    if (active) {
                                                                        e.currentTarget.style.transform = 'translateY(0)';
                                                                        e.currentTarget.style.boxShadow = 'none';
                                                                    }
                                                                }}
                                                            >
                                                                {/* Color swatch */}
                                                                <div style={{
                                                                    width: '38px', height: '38px',
                                                                    borderRadius: '10px',
                                                                    background: active ? cat.gradient : '#e2e8f0',
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                    fontSize: '18px', flexShrink: 0
                                                                }}>
                                                                    {cat.icon}
                                                                </div>
                                                                {/* Label */}
                                                                <div style={{ flex: 1 }}>
                                                                    <div style={{ fontSize: '13px', fontWeight: '800', color: active ? textColor : mutedColor, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                                                                        {cat.name}
                                                                    </div>
                                                                    <div style={{ fontSize: '12px', color: mutedColor, fontWeight: '600', marginTop: '2px' }}>
                                                                        {active ? `${rc.count} batch${rc.count > 1 ? 'es' : ''}` : 'No failures'}
                                                                    </div>
                                                                </div>
                                                                {/* Percentage badge */}
                                                                <div style={{
                                                                    minWidth: '52px',
                                                                    textAlign: 'right'
                                                                }}>
                                                                    <div style={{ fontSize: '22px', fontWeight: '900', color: active ? cat.color : (isDark ? '#475569' : '#cbd5e1'), lineHeight: 1 }}>
                                                                        {active ? `${rc.percentage}%` : '—'}
                                                                    </div>
                                                                    {active && (
                                                                        <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '700', letterSpacing: '0.5px', marginTop: '2px' }}>
                                                                            OF FAILURES
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}
                        </div>

                        {/* SECTION 3: DEEP DIVE PATTERNS */}
                        {data.summary.totalFailed > 0 && (
                            <div style={styles.section}>
                                <h2 style={styles.sectionTitle}>Diagnostic Patterns</h2>
                                {data.rootCauses.filter(rc => rc.count > 0).map(rc => (
                                    <div 
                                        key={rc.category} 
                                        id={`diagnostic-${rc.category}`}
                                        style={{ ...styles.card, borderLeft: `6px solid ${rc.color}`, marginBottom: '24px', scrollMarginTop: '20px' }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px', color: textColor, fontSize: '18px', fontWeight: '900' }}>
                                                <span style={{ fontSize: '24px' }}>{rc.icon}</span> {rc.category.toUpperCase()}
                                            </h3>
                                            <span style={styles.pillBadge}>{rc.count} Failed Batches</span>
                                        </div>

                                        <div style={{ marginBottom: '20px' }}>
                                            {rc.patternDetected ? (
                                                <div style={{ ...styles.statusBadge, backgroundColor: isDark ? 'rgba(251,146,60,0.1)' : '#fff7ed', color: isDark ? '#fb923c' : '#c2410c', display: 'inline-block', marginBottom: '12px', border: `1px solid ${isDark ? 'rgba(251,146,60,0.2)' : '#ffedd5'}` }}>
                                                    ⚡ RECURRING ANOMALY DETECTED
                                                </div>
                                            ) : (
                                                rc.category !== 'Unclassified' && (
                                                    <div style={{ color: mutedColor, fontSize: '13px', fontStyle: 'italic', marginBottom: '12px' }}>
                                                        Scattered failures — no central pattern identified
                                                    </div>
                                                )
                                            )}
                                            {rc.category !== 'Unclassified' && (
                                                <p style={{ margin: '0 0 16px 0', color: textColor, lineHeight: '1.6', fontSize: '15px', opacity: 0.9 }}>{rc.patternText}</p>
                                            )}
                                        </div>

                                        {rc.affectedSkus.length > 0 && (
                                            <div style={{ marginBottom: '20px' }}>
                                                <div style={{ fontSize: '12px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '10px' }}>Impacted Products:</div>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                                    {rc.affectedSkus.map(skuObj => (
                                                        <span key={skuObj.sku} style={styles.skuChip}>{skuObj.productName} ({skuObj.count})</span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {rc.suggestedAction && (
                                            <div style={styles.actionBox}>
                                                <div style={{ fontSize: '20px' }}>💡</div>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontSize: '11px', fontWeight: '900', color: '#6366f1', textTransform: 'uppercase', marginBottom: '4px' }}>Intelligence Action Plan</div>
                                                    <div style={{ fontSize: '14px', color: '#312e81', fontWeight: '500' }}>{rc.suggestedAction}</div>
                                                </div>
                                                {rc.category === 'Temperature-Driven' && (
                                                    <button
                                                        onClick={() => setAssignedActions(prev => ({ ...prev, [rc.category]: !prev[rc.category] }))}
                                                        style={{
                                                            flexShrink: 0,
                                                            padding: '8px 14px',
                                                            borderRadius: '8px',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            fontSize: '12px',
                                                            fontWeight: '700',
                                                            transition: 'all 0.2s ease',
                                                            backgroundColor: assignedActions[rc.category] ? '#dcfce7' : '#e0e7ff',
                                                            color: assignedActions[rc.category] ? '#166534' : '#3730a3',
                                                        }}
                                                    >
                                                        {assignedActions[rc.category] ? '✓ Assigned to Tech' : '🔧 Assign to Technician'}
                                                    </button>
                                                )}
                                            </div>
                                        )}

                                        <div style={{ marginTop: '20px' }}>
                                            <button onClick={() => toggleBatches(rc.category)} style={{ ...styles.toggleBtn, color: isDark ? '#60a5fa' : '#3b82f6' }}>
                                                {expandedBatches[rc.category] ? 'Collapse List ▲' : 'Inspect Affected Batches ▼'}
                                            </button>

                                            {expandedBatches[rc.category] && (
                                                <div style={{ overflowX: 'auto', marginTop: '16px', borderRadius: '12px', border: `1px solid ${borderColor}` }}>
                                                    <table style={styles.table}>
                                                        <thead>
                                                            <tr>
                                                                <th style={styles.th}>Batch ID</th>
                                                                <th style={styles.th}>Product</th>
                                                                <th style={styles.th}>Dispatched</th>
                                                                <th style={styles.th}>Zone</th>
                                                                {rc.category === 'Unclassified' && <th style={styles.th}>Distributor</th>}
                                                                <th style={styles.th}>Status</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {rc.batches.map(b => (
                                                                <tr key={b.batchId} style={styles.tr}>
                                                                    <td style={{ ...styles.td, fontWeight: 'bold' }}>#{b.batchId}</td>
                                                                    <td style={styles.td}>{b.productName}</td>
                                                                    <td style={styles.td}>{new Date(b.dispatched_at).toLocaleDateString()}</td>
                                                                    <td style={styles.td}>Zone {b.zone}</td>
                                                                    {rc.category === 'Unclassified' && (
                                                                        <td style={styles.td}>
                                                                            <span style={{ color: '#6366f1', fontWeight: '600' }}>
                                                                                {b.distributorName || b.distributor_name || 'Unknown'}
                                                                            </span>
                                                                        </td>
                                                                    )}
                                                                    <td style={styles.td}>
                                                                        <span style={{ color: b.status === 'returned' ? '#f43f5e' : '#64748b', fontWeight: 'bold' }}>
                                                                            {b.status.toUpperCase()}
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};


export default RootCauseAnalytics;

