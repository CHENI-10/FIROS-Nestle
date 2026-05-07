import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip } from 'recharts';

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

    const [selectedPeriod, setSelectedPeriod] = useState(null);
    const [expandedBatches, setExpandedBatches] = useState({});
    const [assignedActions, setAssignedActions] = useState({});
    const reportRef = useRef(null);

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
        return <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc', fontFamily: "'Outfit', sans-serif" }}>
            <div style={{ color: '#64748b', fontSize: '18px', fontWeight: 'bold' }}>Scanning Intelligence Engine...</div>
        </div>;
    }

    if (error) {
        return <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc', fontFamily: "'Outfit', sans-serif" }}>
            <div style={{ color: '#ef4444', fontSize: '18px', fontWeight: 'bold' }}>Error: {error}</div>
        </div>;
    }

    if (!data) return null;

    const getTrendBadge = (val, isFailures = false) => {
        return null; // Logic removed as per user request to declutter UI
    };

    return (
        <div style={{ backgroundColor: '#f1f5f9', minHeight: '100vh', fontFamily: "'Outfit', sans-serif", color: '#1e293b' }}>
            {/* GOOGLE FONTS IMPORT */}
            <style>
                {`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap');`}
            </style>

            <div style={styles.container} ref={reportRef}>
                {/* Header */}
                <div style={styles.header}>
                    <div>
                        <h1 style={styles.title}>Root Cause Intelligence</h1>
                        {/* <p style={styles.subtitle}>Strategic Analysis by {data.managerName}</p> */}
                    </div>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <button
                            onClick={() => navigate('/dashboard')}
                            style={styles.secondaryBtn}
                        >
                            &larr; Back
                        </button>
                        <button onClick={handleExport} style={styles.exportBtn}>Export Intel</button>
                    </div>
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
                                <div style={styles.statValue}>{data.summary.totalDispatched}</div>
                                <div style={styles.statSub}>batches sent</div>
                            </div>
                            <div style={{ ...styles.statCard, borderTop: '4px solid #10b981' }}>
                                <div style={{ ...styles.statLabel, color: '#10b981' }}>SUCCESSFUL</div>
                                <div style={styles.statValue}>{data.summary.totalCleared}</div>
                                <div style={styles.statSub}>batches cleared</div>
                            </div>
                            <div style={{ ...styles.statCard, borderTop: '4px solid #f43f5e' }}>
                                <div style={{ ...styles.statLabel, color: '#f43f5e' }}>RETURNED</div>
                                <div style={styles.statValue}>{data.summary.totalReturned}</div>
                                <div style={styles.statSub}>
                                    batches returned
                                </div>
                            </div>

                            <div style={{ ...styles.statCard, borderTop: `4px solid ${data.summary.failureRate > 10 ? '#f43f5e' : data.summary.failureRate > 5 ? '#f59e0b' : '#10b981'}` }}>
                                <div style={{ ...styles.statLabel, color: data.summary.failureRate > 10 ? '#f43f5e' : data.summary.failureRate > 5 ? '#f59e0b' : '#10b981' }}>FAILURE RATE</div>
                                <div style={styles.statValue}>{data.summary.failureRate}%</div>
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
                                    <div style={{ display: 'grid', gap: '24px' }}>
                                        {['Temperature-Driven', 'Long Storage', 'Distributor Delay', 'Unclassified'].map(catName => {
                                            const rc = data.rootCauses.find(c => c.category === catName) || { category: catName, count: 0, percentage: 0 };
                                            const colors = {
                                                'Temperature-Driven': '#f43f5e',
                                                'Long Storage': '#f59e0b',
                                                'Distributor Delay': '#8b5cf6',
                                                'Market Saturation': '#3b82f6',
                                                'Unclassified': '#94a3b8'
                                            };
                                            const barColor = colors[catName] || '#94a3b8';
                                            const hasBatches = rc.count > 0;

                                            let delta = 0;
                                            if (catName === 'Temperature-Driven') delta = data.summary.comparison?.tempFailuresDelta;
                                            if (catName === 'Long Storage') delta = data.summary.comparison?.longStorageDelta;

                                            return (
                                                <div key={catName} style={{ opacity: hasBatches ? 1 : 0.4 }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                                        <span style={{ fontWeight: '800', color: '#1e293b', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                            {catName}
                                                        </span>
                                                        <span style={{ color: '#64748b', fontWeight: 'bold', fontSize: '13px' }}>
                                                            {hasBatches ? `${rc.count} batches (${rc.percentage}%)` : '—'}
                                                        </span>
                                                    </div>
                                                    <div style={styles.barBg}>
                                                        <div style={{
                                                            ...styles.barFill,
                                                            width: `${rc.percentage}%`,
                                                            backgroundColor: barColor,
                                                            boxShadow: `0 0 10px ${barColor}44`
                                                        }} />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* SECTION 3: DEEP DIVE PATTERNS */}
                        {data.summary.totalFailed > 0 && (
                            <div style={styles.section}>
                                <h2 style={styles.sectionTitle}>Diagnostic Patterns</h2>
                                {data.rootCauses.filter(rc => rc.count > 0).map(rc => (
                                    <div key={rc.category} style={{ ...styles.card, borderLeft: `6px solid ${rc.color}`, marginBottom: '24px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px', color: '#1e293b', fontSize: '18px', fontWeight: '900' }}>
                                                <span style={{ fontSize: '24px' }}>{rc.icon}</span> {rc.category.toUpperCase()}
                                            </h3>
                                            <span style={styles.pillBadge}>{rc.count} Failed Batches</span>
                                        </div>

                                        <div style={{ marginBottom: '20px' }}>
                                            {rc.patternDetected ? (
                                                <div style={{ ...styles.statusBadge, backgroundColor: '#fff7ed', color: '#c2410c', display: 'inline-block', marginBottom: '12px' }}>
                                                    ⚡ RECURRING ANOMALY DETECTED
                                                </div>
                                            ) : (
                                                rc.category !== 'Unclassified' && (
                                                    <div style={{ color: '#94a3b8', fontSize: '13px', fontStyle: 'italic', marginBottom: '12px' }}>
                                                        Scattered failures — no central pattern identified
                                                    </div>
                                                )
                                            )}
                                            {rc.category !== 'Unclassified' && (
                                                <p style={{ margin: '0 0 16px 0', color: '#334155', lineHeight: '1.6', fontSize: '15px' }}>{rc.patternText}</p>
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
                                            <button onClick={() => toggleBatches(rc.category)} style={styles.toggleBtn}>
                                                {expandedBatches[rc.category] ? 'Collapse List ▲' : 'Inspect Affected Batches ▼'}
                                            </button>

                                            {expandedBatches[rc.category] && (
                                                <div style={{ overflowX: 'auto', marginTop: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
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
    );
};

const styles = {
    container: {
        padding: '40px 5%',
        maxWidth: '1400px',
        margin: '0 auto',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '40px',
        flexWrap: 'wrap',
        gap: '20px'
    },
    title: {
        margin: '0 0 6px 0',
        fontSize: '32px',
        fontWeight: '900',
        color: '#1e3a8a',
        letterSpacing: '-1px'
    },
    subtitle: {
        margin: 0,
        color: '#64748b',
        fontSize: '16px',
        fontWeight: '500'
    },
    exportBtn: {
        background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
        border: 'none',
        padding: '12px 24px',
        borderRadius: '10px',
        cursor: 'pointer',
        fontWeight: '900',
        color: 'white',
        fontSize: '14px',
        boxShadow: '0 4px 12px rgba(30, 64, 175, 0.2)',
        textTransform: 'uppercase',
        letterSpacing: '1px'
    },
    secondaryBtn: {
        backgroundColor: 'white',
        border: '1px solid #e2e8f0',
        padding: '12px 24px',
        borderRadius: '10px',
        cursor: 'pointer',
        fontWeight: '800',
        color: '#475569',
        fontSize: '14px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
    },
    navSection: {
        marginBottom: '40px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '20px'
    },
    periodTabs: {
        display: 'flex',
        gap: '6px',
        backgroundColor: '#e2e8f0',
        padding: '6px',
        borderRadius: '12px',
    },
    tabBtn: {
        padding: '10px 20px',
        borderRadius: '8px',
        border: 'none',
        background: 'none',
        cursor: 'pointer',
        fontSize: '14px',
        color: '#64748b',
        fontWeight: '800',
        transition: 'all 0.3s ease'
    },
    activeTab: {
        backgroundColor: 'white',
        color: '#1e40af',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
    },
    monthSelect: {
        padding: '12px 24px',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        backgroundColor: 'white',
        color: '#1e293b',
        fontSize: '16px',
        fontWeight: '900',
        cursor: 'pointer',
        outline: 'none',
        boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
    },
    section: {
        marginBottom: '50px'
    },
    sectionTitle: {
        fontSize: '14px',
        fontWeight: '900',
        color: '#94a3b8',
        textTransform: 'uppercase',
        letterSpacing: '2px',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
    },
    statsGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '24px',
        marginBottom: '50px'
    },
    statCard: {
        backgroundColor: 'white',
        padding: '32px',
        borderRadius: '20px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
        textAlign: 'left',
    },
    statLabel: {
        fontSize: '12px',
        fontWeight: '900',
        letterSpacing: '1.5px',
        marginBottom: '16px'
    },
    statValue: {
        fontSize: '48px',
        fontWeight: '900',
        color: '#1e293b',
        lineHeight: '1',
        marginBottom: '8px'
    },
    statSub: {
        fontSize: '13px',
        color: '#94a3b8',
        fontWeight: '700',
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap'
    },
    card: {
        backgroundColor: 'white',
        padding: '32px',
        borderRadius: '20px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
        border: '1px solid #f1f5f9'
    },
    barBg: {
        backgroundColor: '#f1f5f9',
        height: '10px',
        borderRadius: '5px',
        overflow: 'hidden'
    },
    barFill: {
        height: '100%',
        fontWeight: 'bold'
    },
    riskBadge: {
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: '10px',
        fontWeight: 'bold',
        textTransform: 'uppercase'
    },
    pillBadge: {
        backgroundColor: '#f8fafc',
        border: '1px solid #e2e8f0',
        padding: '5px 14px',
        borderRadius: '20px',
        fontSize: '13px',
        fontWeight: '600',
        color: '#475569',
        fontFamily: "'Outfit', sans-serif",
        letterSpacing: '0.2px'
    },
    actionBox: {
        backgroundColor: '#eef2ff',
        border: '1px solid #c7d2fe',
        padding: '16px 20px',
        borderRadius: '12px',
        display: 'flex',
        gap: '14px',
        alignItems: 'center'
    },
    toggleBtn: {
        background: 'none',
        border: 'none',
        color: '#3b82f6',
        padding: '0',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: '700',
        fontFamily: "'Outfit', sans-serif",
        letterSpacing: '0.2px'
    },
    table: {
        width: '100%',
        borderCollapse: 'collapse',
        textAlign: 'left',
        fontFamily: "'Outfit', sans-serif"
    },
    th: {
        padding: '12px 18px',
        borderBottom: '2px solid #f1f5f9',
        color: '#64748b',
        fontWeight: '700',
        fontSize: '13px',
        backgroundColor: '#f8fafc',
        letterSpacing: '0.5px',
        textTransform: 'uppercase',
        fontFamily: "'Outfit', sans-serif"
    },
    td: {
        padding: '14px 18px',
        borderBottom: '1px solid #f1f5f9',
        fontSize: '14px',
        color: '#334155',
        fontFamily: "'Outfit', sans-serif",
        fontWeight: '500',
        lineHeight: '1.5'
    },
    skuChip: {
        backgroundColor: '#f1f5f9',
        border: '1px solid #e2e8f0',
        padding: '4px 12px',
        borderRadius: '20px',
        fontSize: '13px',
        fontWeight: '600',
        color: '#334155',
        fontFamily: "'Outfit', sans-serif"
    },
    statusBadge: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '5px 12px',
        borderRadius: '8px',
        fontSize: '12px',
        fontWeight: '800',
        letterSpacing: '0.5px',
        fontFamily: "'Outfit', sans-serif"
    },
    tr: {
        transition: 'background 0.15s ease'
    }
};

export default RootCauseAnalytics;
