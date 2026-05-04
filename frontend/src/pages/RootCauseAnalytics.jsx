import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip } from 'recharts';

const RootCauseAnalytics = () => {
    const navigate = useNavigate();
    const token = sessionStorage.getItem('token');

    const [data, setData] = useState(null);
    const [liveImpact, setLiveImpact] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Default to current month, but keep track via state
    const [currentMonthStr, setCurrentMonthStr] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });

    const [selectedPeriod, setSelectedPeriod] = useState(null); // null, 30, 60, 90

    const [expandedBatches, setExpandedBatches] = useState({});

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

                const res = await fetch(url, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!res.ok) {
                    if (res.status === 403 || res.status === 401) {
                        navigate('/dashboard'); // Kick out if not manager
                        return;
                    }
                    throw new Error('Failed to fetch data');
                }

                const result = await res.json();
                setData(result);

                // Fetch live impact based on problem zones from the result
                const problemZones = result.problemZones.map(pz => pz.zone).join(',');
                const liveRes = await fetch(`/api/root-cause/live-impact?zones=${problemZones}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (liveRes.ok) {
                    const liveData = await liveRes.json();
                    setLiveImpact(liveData);
                }

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
        if (!data || !data.rootCauses) return;

        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Batch ID,Product,Zone,Days in WH,Temp Breaches,Root Cause,Dispatched At,Collected At,Distributor,Status\n";

        data.rootCauses.forEach(rc => {
            rc.batches.forEach(b => {
                const dispDate = new Date(b.dispatched_at).toLocaleDateString();
                const collDate = b.collected_at ? new Date(b.collected_at).toLocaleDateString() : 'N/A';
                const row = [
                    b.batchId,
                    b.productName,
                    b.zone,
                    b.daysInWarehouse,
                    b.tempBreachWindows,
                    rc.category,
                    dispDate,
                    collDate,
                    `"${b.distributorName || 'N/A'}"`,
                    b.status
                ];
                csvContent += row.join(",") + "\n";
            });
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        const pLabel = (data.periodLabel || 'Report').replace(/\s+/g, '-');
        const mName = (data.managerName || 'Manager').replace(/\s+/g, '_');
        link.setAttribute("download", `root-cause-${pLabel}-${mName}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const toggleBatches = (category) => {
        setExpandedBatches(prev => ({
            ...prev,
            [category]: !prev[category]
        }));
    };



    const theme = sessionStorage.getItem('theme') || 'light';

    if (loading) {
        return <div className={`dashboard-container ${theme}`} style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ color: 'var(--text-main)', fontSize: '18px' }}>Loading analytics...</div>
        </div>;
    }

    if (error) {
        return <div className={`dashboard-container ${theme}`} style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ color: '#ef4444', fontSize: '18px' }}>Error: {error}</div>
        </div>;
    }

    if (!data) return null;



    const getAtRiskCount = () => {
        if (!liveImpact) return 0;
        return (liveImpact.atRiskInZones?.length || 0) + 
               (liveImpact.approachingStorageLimit?.length || 0) + 
               (liveImpact.collectionDelays?.length || 0);
    };

    const scrollToLiveImpact = () => {
        const element = document.getElementById('live-impact-section');
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        }
    };

    const getTrendBadge = (val, isFailures = false) => {
        if (val === 0 || val === undefined || val === null || isNaN(val)) return null;
        const isPositive = val > 0; // "Positive" delta means more failures, which is BAD
        const color = isPositive ? '#ef4444' : '#22c55e';
        const icon = isPositive ? '↑' : '↓';
        const absVal = Math.abs(val);
        const text = isPositive ? `${absVal} more` : `${absVal} fewer`;
        
        return (
            <span style={{ 
                ...styles.deltaBadge, 
                backgroundColor: isPositive ? '#fee2e2' : '#dcfce7', 
                color 
            }}>
                {icon} {text} {isFailures ? 'failures' : ''}
            </span>
        );
    };

    return (
        <div className={`dashboard-container ${theme}`} style={{ minHeight: '100vh' }}>
            <div style={styles.container}>
                {/* Header */}
                <div style={styles.header}>
                    <div>
                        <h1 style={styles.title}> Root Cause Analytics</h1>
                        <p style={styles.subtitle}>{data.managerName}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <button 
                            onClick={() => navigate('/dashboard')}
                            style={styles.secondaryBtn}
                        >
                            ← Back to Dashboard
                        </button>
                        <button onClick={handleExport} style={styles.exportBtn}>Export Report</button>
                    </div>
                </div>

                {/* Navigation & Period Selection */}
                <div style={styles.navSection}>
                    <div style={styles.periodTabs}>
                        <button 
                            style={{ ...styles.tabBtn, ...(selectedPeriod === null ? styles.activeTab : {}) }}
                            onClick={() => setSelectedPeriod(null)}
                        >
                            Monthly View
                        </button>
                        {[30, 60, 90].map(p => (
                            <button 
                                key={p}
                                style={{ ...styles.tabBtn, ...(selectedPeriod === p ? styles.activeTab : {}) }}
                                onClick={() => setSelectedPeriod(p)}
                            >
                                Last {p} Days
                            </button>
                        ))}
                    </div>

                    {!selectedPeriod && (
                        <div style={styles.navRow}>
                            <div style={styles.monthBadgeContainer}>
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
                    /* Empty State */
                    <div style={styles.card}>
                        <h3 style={{ marginTop: 0, color: 'var(--text-main)' }}>No batch failure data for {data.periodLabel}.</h3>
                        <p style={{ color: 'var(--text-muted)' }}>Either no batches were cleared or returned in this period, or you had no dispatches recorded.</p>
                    </div>
                ) : (
                    <>
                        {/* SECTION 1: PERIOD AT A GLANCE */}
                        <div style={styles.section}>
                            <div style={styles.statsGrid}>
                                <div style={{ ...styles.statCard, backgroundColor: 'var(--card-bg)', borderTop: '4px solid #3b82f6' }}>
                                    <div style={{ ...styles.statLabel, color: '#3b82f6' }}>DISPATCHED</div>
                                    <div style={{ ...styles.statValue, color: 'var(--text-main)' }}>{data.summary.totalDispatched}</div>
                                    <div style={styles.statSub}>in period</div>
                                </div>
                                <div style={{ ...styles.statCard, backgroundColor: 'var(--card-bg)', borderTop: '4px solid #f59e0b' }}>
                                    <div style={{ ...styles.statLabel, color: '#f59e0b' }}>CLEARED</div>
                                    <div style={{ ...styles.statValue, color: 'var(--text-main)' }}>{data.summary.totalCleared}</div>
                                    <div style={styles.statSub}>in period</div>
                                </div>
                                <div style={{ ...styles.statCard, backgroundColor: 'var(--card-bg)', borderTop: '4px solid #ef4444' }}>
                                    <div style={{ ...styles.statLabel, color: '#ef4444' }}>RETURNED</div>
                                    <div style={{ ...styles.statValue, color: 'var(--text-main)' }}>{data.summary.totalReturned}</div>
                                    <div style={styles.statSub}>
                                        in period
                                        {getTrendBadge(data.summary.comparison?.failuresDelta, true)}
                                    </div>
                                </div>
                                <div 
                                    style={{ 
                                        ...styles.statCard, 
                                        backgroundColor: 'var(--card-bg)', 
                                        borderTop: `4px solid ${getAtRiskCount() > 0 ? '#f59e0b' : '#22c55e'}`,
                                        cursor: 'pointer'
                                    }}
                                    onClick={scrollToLiveImpact}
                                >
                                    <div style={{ ...styles.statLabel, color: getAtRiskCount() > 0 ? '#f59e0b' : '#22c55e' }}>CURRENTLY AT RISK</div>
                                    <div style={{ ...styles.statValue, color: 'var(--text-main)' }}>{getAtRiskCount()}</div>
                                    <div style={styles.statSub}>batches in problem areas</div>
                                </div>
                            </div>

                            <div style={styles.card}>
                                <div style={styles.comparisonRow}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                            <strong style={{ color: 'var(--text-main)' }}>Your failure rate:</strong>
                                            <span style={{ color: 'var(--text-main)' }}>
                                                {data.summary.failureRate}%
                                                {getTrendBadge(data.summary.comparison?.failureRateDelta)}
                                            </span>
                                        </div>
                                        <div style={styles.barBg}>
                                            <div style={{ ...styles.barFill, width: `${Math.min(data.summary.failureRate, 100)}%`, backgroundColor: '#3b82f6' }} />
                                        </div>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                            <strong style={{ color: 'var(--text-muted)' }}>System average:</strong>
                                            <span style={{ color: 'var(--text-muted)' }}>{data.summary.systemAvgFailureRate}%</span>
                                        </div>
                                        <div style={styles.barBg}>
                                            <div style={{ ...styles.barFill, width: `${Math.min(data.summary.systemAvgFailureRate, 100)}%`, backgroundColor: '#cbd5e1' }} />
                                        </div>
                                    </div>
                                </div>
                                <div style={{ marginTop: '16px', color: 'var(--text-muted)', fontSize: '14px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                                    {data.summary.failureRate < data.summary.systemAvgFailureRate ? (
                                        <span>
                                            ✅ You're performing better than average. 
                                            {data.summary.comparison?.failuresDelta < 0 && " Plus, failures are decreasing vs previous period!"}
                                            {" Your main area to watch is "}
                                            <strong>{data.rootCauses.sort((a,b) => b.count - a.count)[0]?.category}</strong>.
                                        </span>
                                    ) : (
                                        <span>
                                            Your failure rate is above average. Focus on <strong>{data.rootCauses.sort((a,b) => b.count - a.count)[0]?.category}</strong> — it accounts for {data.rootCauses.sort((a,b) => b.count - a.count)[0]?.percentage}% of your failures.
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* SECTION 2: WHY YOUR BATCHES FAILED */}
                        <div style={styles.section}>
                            <h2 style={styles.sectionTitle}>Why Your Batches Failed</h2>
                            {data.summary.totalFailed === 0 ? (
                                <div style={{ ...styles.card, backgroundColor: '#dcfce7', borderColor: '#bbf7d0' }}>
                                    <strong style={{ color: '#166534' }}>✅ No batch failures in this period.</strong><br />
                                    <span style={{ color: '#166534' }}>All your dispatches resolved successfully.</span>
                                </div>
                            ) : (
                                <div style={styles.card}>
                                    <div style={{ display: 'grid', gap: '20px' }}>
                                        {['Temperature-Driven', 'Long Storage', 'Distributor Delay', 'Unclassified'].map(catName => {
                                            const rc = data.rootCauses.find(c => c.category === catName) || { category: catName, count: 0, percentage: 0, color: '#94a3b8' };
                                            const colors = {
                                                'Temperature-Driven': '#ef4444',
                                                'Long Storage': '#f59e0b',
                                                'Distributor Delay': '#8b5cf6',
                                                'Unclassified': '#94a3b8'
                                            };
                                            const barColor = colors[catName] || '#94a3b8';
                                            const hasBatches = rc.count > 0;
                                            
                                            // Get category delta
                                            let delta = 0;
                                            if (catName === 'Temperature-Driven') delta = data.summary.comparison?.tempFailuresDelta;
                                            if (catName === 'Long Storage') delta = data.summary.comparison?.longStorageDelta;

                                            return (
                                                <div key={catName} style={{ opacity: hasBatches ? 1 : 0.5 }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                                                        <span style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>
                                                            {catName}
                                                            {getTrendBadge(delta)}
                                                        </span>
                                                        <span style={{ color: 'var(--text-muted)' }}>
                                                            {hasBatches ? `${rc.count} batches (${rc.percentage}%)` : '(empty)'}
                                                        </span>
                                                    </div>
                                                    <div style={styles.barBg}>
                                                        <div style={{ 
                                                            ...styles.barFill, 
                                                            width: `${rc.percentage}%`, 
                                                            backgroundColor: hasBatches ? barColor : '#e2e8f0' 
                                                        }} />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Rest of sections only show if there are failures */}
                        {data.summary.totalFailed > 0 && (
                            <>
                                {/* SECTION 3: PATTERN ANALYSIS */}
                                <div style={styles.section}>
                                    <h2 style={styles.sectionTitle}>Patterns Detected in Your Dispatches</h2>
                                    {data.rootCauses.filter(rc => rc.count > 0).map(rc => (
                                        <div key={rc.category} style={{ ...styles.card, borderLeft: `4px solid ${rc.color}`, marginBottom: '16px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
                                                    <span>{rc.icon}</span> {rc.category.toUpperCase()}
                                                </h3>
                                                <span style={{ fontWeight: 'bold', color: 'var(--text-muted)' }}>{rc.count} batches</span>
                                            </div>
                                            <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '0 0 16px 0' }} />

                                            <div style={{ marginBottom: '16px' }}>
                                                {rc.patternDetected ? (
                                                    <div style={{ ...styles.statusBadge, backgroundColor: '#fef3c7', color: '#b45309', display: 'inline-block', marginBottom: '8px' }}>
                                                        ⚡ PATTERN DETECTED
                                                    </div>
                                                ) : (
                                                    <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: '8px' }}>
                                                        No recurring pattern in this period
                                                    </div>
                                                )}
                                                <p style={{ margin: '0 0 12px 0', color: 'var(--text-main)' }}>{rc.patternText}</p>
                                            </div>

                                            {rc.affectedSkus.length > 0 && (
                                                <div style={{ marginBottom: '16px' }}>
                                                    <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>Products affected:</div>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                                        {rc.affectedSkus.map(sku => {
                                                            const count = rc.batches.filter(b => b.sku === sku).length;
                                                            return (
                                                                <span key={sku} style={styles.pillBadge}>{sku} ×{count}</span>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Day of Week Insight */}
                                            <div style={{ marginBottom: '16px' }}>
                                                <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>Day of week patterns:</div>
                                                <div style={{ display: 'flex', gap: '4px' }}>
                                                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, idx) => {
                                                        const dow = idx === 6 ? 0 : idx + 1; // JS Day vs Postgres DOW (0=Sun)
                                                        const count = rc.batches.filter(b => parseInt(b.dispatch_day_of_week) === dow).length;
                                                        const isAffected = count > 0;
                                                        return (
                                                            <div 
                                                                key={day} 
                                                                style={{
                                                                    padding: '4px 8px',
                                                                    borderRadius: '4px',
                                                                    fontSize: '11px',
                                                                    fontWeight: 'bold',
                                                                    backgroundColor: isAffected ? '#fee2e2' : 'var(--hover-bg)',
                                                                    color: isAffected ? '#ef4444' : 'var(--text-muted)',
                                                                    border: isAffected ? '1px solid #fecaca' : '1px solid var(--border-color)',
                                                                    textAlign: 'center',
                                                                    minWidth: '36px'
                                                                }}
                                                            >
                                                                {day.toUpperCase()}{isAffected ? '🔴' : ''}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {/* Zone Breakdown (Temperature Only) */}
                                            {rc.category === 'Temperature-Driven' && (
                                                <div style={{ marginBottom: '16px', backgroundColor: 'var(--hover-bg)', padding: '12px', borderRadius: '8px' }}>
                                                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '8px' }}>Zone Breakdown</div>
                                                    {Object.entries(rc.batches.reduce((acc, b) => {
                                                        acc[b.zone] = (acc[b.zone] || 0) + 1;
                                                        return acc;
                                                    }, {})).map(([zone, count]) => (
                                                        <div key={zone} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                                                            <span style={{ width: '60px', fontSize: '12px', color: 'var(--text-main)' }}>Zone {zone}</span>
                                                            <div style={{ flex: 1, backgroundColor: 'var(--card-bg)', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                                                                <div style={{ width: `${(count / rc.count) * 100}%`, backgroundColor: '#ef4444', height: '100%' }} />
                                                            </div>
                                                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', width: '60px' }}>{count} failures</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {rc.suggestedAction && (
                                                <div style={styles.actionBox}>
                                                    <span style={{ fontSize: '18px' }}>💡</span>
                                                    <div>
                                                        <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#94a3b8', marginBottom: '4px' }}>SUGGESTED ACTION</div>
                                                        <div>{rc.suggestedAction}</div>
                                                    </div>
                                                </div>
                                            )}

                                            <div style={{ marginTop: '16px' }}>
                                                <button onClick={() => toggleBatches(rc.category)} style={styles.toggleBtn}>
                                                    {expandedBatches[rc.category] ? 'Hide Affected Batches ▲' : 'View Affected Batches ▼'}
                                                </button>

                                                {expandedBatches[rc.category] && (
                                                    <div style={{ overflowX: 'auto', marginTop: '12px' }}>
                                                        <table style={styles.table}>
                                                            <thead>
                                                                <tr>
                                                                    <th style={styles.th}>Batch ID</th>
                                                                    <th style={styles.th}>Product</th>
                                                                    <th style={styles.th}>Date</th>
                                                                    <th style={styles.th}>Zone</th>
                                                                    <th style={styles.th}>Status</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {rc.batches.map(b => (
                                                                    <tr key={b.batchId}>
                                                                        <td style={styles.td}>{b.batchId}</td>
                                                                        <td style={styles.td}>{b.productName}</td>
                                                                        <td style={styles.td}>{new Date(b.dispatched_at).toLocaleDateString()}</td>
                                                                        <td style={styles.td}>{b.zone}</td>
                                                                        <td style={styles.td}>{b.status}</td>
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

                                {/* SECTION 4: RECURRING PROBLEM PRODUCTS */}
                                {data.recurringProblemProducts.length > 0 && (
                                    <div style={styles.section}>
                                        <h2 style={{ ...styles.sectionTitle, marginBottom: '4px' }}>Your Recurring Problem Products</h2>
                                        <p style={styles.sectionSubtitle}>SKUs appearing in 3 or more failed batches in this period</p>
                                        <div style={{ display: 'grid', gap: '16px' }}>
                                            {data.recurringProblemProducts.map(rp => (
                                                <div key={rp.sku} style={styles.card}>
                                                    <div style={{ fontWeight: 'bold', fontSize: '16px', color: 'var(--text-main)' }}>{rp.productName}</div>
                                                    <div style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '8px' }}>{rp.failureCount} failures detected</div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                        <div style={{ flex: 1, backgroundColor: 'var(--hover-bg)', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                                                            <div style={{ width: `${Math.min((rp.failureCount / 10) * 100, 100)}%`, backgroundColor: rp.severity === 'high' ? '#ef4444' : '#f59e0b', height: '100%' }} />
                                                        </div>
                                                        <span style={{ fontSize: '14px', color: rp.severity === 'high' ? '#ef4444' : '#f59e0b', fontWeight: 'bold' }}>
                                                            {rp.severity === 'high' ? '🔴 High concern' : '🟡 Monitor closely'}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* SECTION 5: LIVE WAREHOUSE IMPACT */}
                                <div style={styles.section} id="live-impact-section">
                                    <h2 style={{ ...styles.sectionTitle, marginBottom: '4px' }}>What This Means For Your Warehouse Right Now</h2>
                                    <p style={styles.sectionSubtitle}>Based on patterns detected, these current batches may be at risk</p>
                                    
                                    {!liveImpact || (liveImpact.atRiskInZones.length === 0 && liveImpact.approachingStorageLimit.length === 0 && liveImpact.collectionDelays.length === 0) ? (
                                        <div style={{ ...styles.card, backgroundColor: '#dcfce7', borderColor: '#22c55e', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <span style={{ fontSize: '24px' }}>✅</span>
                                            <div>
                                                <strong style={{ color: '#166534' }}>No immediate threats detected.</strong><br />
                                                <span style={{ color: '#166534' }}>No current batches are showing signs of repeating these failure patterns.</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                                            {/* Zone Risks */}
                                            {data.problemZones.map(pz => {
                                                const batches = liveImpact.atRiskInZones.filter(b => String(b.zone) === String(pz.zone));
                                                const hasBatches = batches.length > 0;
                                                return (
                                                    <div key={pz.zone} style={{ ...styles.card, borderLeft: `4px solid ${hasBatches ? '#f59e0b' : '#22c55e'}` }}>
                                                        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '12px' }}>
                                                            <span style={{ fontSize: '20px' }}>{hasBatches ? '⚡' : '✅'}</span>
                                                            <div>
                                                                <div style={{ fontWeight: 'bold', fontSize: '16px', color: 'var(--text-main)' }}>ZONE {pz.zone} — Problem Area</div>
                                                                <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Caused {pz.tempFailureCount} temperature failures recently.</div>
                                                            </div>
                                                        </div>

                                                        {hasBatches ? (
                                                            <>
                                                                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#94a3b8', margin: '12px 0 8px 0' }}>CURRENTLY IN ZONE {pz.zone}:</div>
                                                                {batches.map(b => (
                                                                    <div key={b.batch_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                                                                        <div style={{ fontSize: '14px', color: 'var(--text-main)' }}>{b.product_name}</div>
                                                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                                            <span style={{ ...styles.riskBadge, backgroundColor: b.risk_category === 'High Risk' ? '#fee2e2' : (b.risk_category === 'Medium Risk' ? '#fef3c7' : '#dcfce7'), color: b.risk_category === 'High Risk' ? '#ef4444' : (b.risk_category === 'Medium Risk' ? '#b45309' : '#166534') }}>
                                                                                {b.risk_category}
                                                                            </span>
                                                                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>FRS {Math.round(b.frs_score)}</span>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                                <div style={{ ...styles.actionBox, marginTop: '16px', backgroundColor: '#fff7ed', color: '#9a3412', border: '1px solid #ffedd5' }}>
                                                                    <span style={{ fontSize: '18px' }}>💡</span>
                                                                    <div style={{ fontSize: '13px' }}>
                                                                        You have {batches.length} batches in Zone {pz.zone} right now. Consider moving <strong>{batches[0]?.product_name}</strong> to dispatch priority.
                                                                    </div>
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '12px' }}>
                                                                No batches currently in this zone. No immediate action needed.
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}

                                            {/* Storage Risk */}
                                            {liveImpact.approachingStorageLimit.length > 0 && (
                                                <div style={{ ...styles.card, borderLeft: '4px solid #f59e0b' }}>
                                                    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '12px' }}>
                                                        <span style={{ fontSize: '20px' }}>⚡</span>
                                                        <div>
                                                            <div style={{ fontWeight: 'bold', fontSize: '16px', color: 'var(--text-main)' }}>LONG STORAGE RISK</div>
                                                            <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Batches approaching 120-day storage limit.</div>
                                                        </div>
                                                    </div>
                                                    
                                                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#94a3b8', margin: '12px 0 8px 0' }}>APPROACHING LIMIT NOW:</div>
                                                    {liveImpact.approachingStorageLimit.slice(0, 3).map(b => (
                                                        <div key={b.batch_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                                                            <div style={{ fontSize: '14px', color: 'var(--text-main)' }}>{b.product_name}</div>
                                                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                                                <span style={{ fontSize: '14px', fontWeight: 'bold', color: b.days_in_warehouse > 110 ? '#ef4444' : '#f59e0b' }}>{Math.floor(b.days_in_warehouse)} days</span>
                                                                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>FRS {Math.round(b.frs_score)}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* SECTION 6: HOW YOU COMPARE */}
                                <div style={styles.section}>
                                    <h2 style={{ ...styles.sectionTitle, marginBottom: '4px' }}>How You Compare to System Average</h2>
                                    <p style={styles.sectionSubtitle}>Based on all managers in this period</p>
                                    <div style={{ ...styles.card, overflowX: 'auto' }}>
                                        <table style={styles.table}>
                                            <thead>
                                                <tr>
                                                    <th style={styles.th}>Metric</th>
                                                    <th style={styles.th}>You</th>
                                                    <th style={styles.th}>System Avg</th>
                                                    <th style={styles.th}>Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <ComparisonRow
                                                    label="Failure Rate"
                                                    you={data.comparison.yourFailureRate}
                                                    avg={data.comparison.systemAvgFailureRate}
                                                    isPercentage={true}
                                                />
                                                <ComparisonRow
                                                    label="Temp Failures"
                                                    you={data.comparison.yourTempFailures}
                                                    avg={data.comparison.systemAvgTempFailures}
                                                />
                                                <ComparisonRow
                                                    label="Long Storage"
                                                    you={data.comparison.yourLongStorage}
                                                    avg={data.comparison.systemAvgLongStorage}
                                                />
                                                <ComparisonRow
                                                    label="Distributor Delay"
                                                    you={data.comparison.yourDistributorDelay}
                                                    avg={data.comparison.systemAvgDistributorDelay}
                                                />
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

const ComparisonRow = ({ label, you, avg, isPercentage = false }) => {
    let status = '→';
    let color = '#475569';

    // Threshold calculation
    const isWorse = you > (avg + (isPercentage ? 5 : 0.5));
    const isBetter = you < (avg - (isPercentage ? 5 : 0.5));

    if (isWorse) {
        status = '⚠';
        color = '#ef4444';
    } else if (isBetter) {
        status = '✅';
        color = '#22c55e';
    }

    const formatVal = (v) => isPercentage ? `${v}%` : v;

    return (
        <tr>
            <td style={{ ...styles.td, color: 'var(--text-main)' }}><strong>{label}</strong></td>
            <td style={{ ...styles.td, color, fontWeight: 'bold' }}>{formatVal(you)}</td>
            <td style={{ ...styles.td, color: 'var(--text-muted)' }}>{formatVal(avg)}</td>
            <td style={styles.td}>{status}</td>
        </tr>
    );
};

const styles = {
    container: {
        padding: '24px',
        maxWidth: '1200px',
        margin: '0 auto',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '16px'
    },
    title: {
        margin: '0 0 4px 0',
        color: 'var(--text-main)'
    },
    subtitle: {
        margin: 0,
        color: 'var(--text-muted)',
        fontSize: '16px'
    },
    exportBtn: {
        backgroundColor: '#3b82f6',
        border: 'none',
        padding: '8px 16px',
        borderRadius: '6px',
        cursor: 'pointer',
        fontWeight: 'bold',
        color: 'white'
    },
    secondaryBtn: {
        backgroundColor: 'var(--hover-bg)',
        border: '1px solid var(--border-color)',
        padding: '8px 16px',
        borderRadius: '6px',
        cursor: 'pointer',
        fontWeight: 'bold',
        color: 'var(--text-main)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
    },
    navSection: {
        marginBottom: '32px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
    },
    periodTabs: {
        display: 'flex',
        gap: '8px',
        backgroundColor: 'var(--hover-bg)',
        padding: '4px',
        borderRadius: '8px',
        alignSelf: 'flex-start'
    },
    tabBtn: {
        padding: '6px 16px',
        borderRadius: '6px',
        border: 'none',
        background: 'none',
        cursor: 'pointer',
        fontSize: '14px',
        color: 'var(--text-muted)',
        fontWeight: 'bold',
        transition: 'all 0.2s'
    },
    activeTab: {
        backgroundColor: 'var(--card-bg)',
        color: '#3b82f6',
        boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
    },
    periodHeader: {
        display: 'flex',
        alignItems: 'baseline',
        gap: '12px'
    },
    periodSub: {
        fontSize: '14px',
        color: 'var(--text-muted)'
    },
    navRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '16px'
    },
    navBtn: {
        background: 'none',
        border: 'none',
        color: '#3b82f6',
        cursor: 'pointer',
        fontWeight: 'bold',
        padding: '4px 8px'
    },
    monthBadgeContainer: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
    },
    monthSelect: {
        padding: '8px 16px',
        borderRadius: '8px',
        border: '1px solid var(--border-color)',
        backgroundColor: 'var(--card-bg)',
        color: 'var(--text-main)',
        fontSize: '18px',
        fontWeight: 'bold',
        cursor: 'pointer',
        outline: 'none',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
    },
    monthLabel: {
        fontSize: '18px',
        fontWeight: 'bold',
        color: 'var(--text-main)'
    },
    currentBadge: {
        backgroundColor: '#e0e7ff',
        color: '#4338ca',
        fontSize: '12px',
        padding: '2px 8px',
        borderRadius: '12px',
        fontWeight: 'bold'
    },
    section: {
        marginBottom: '40px'
    },
    sectionTitle: {
        fontSize: '20px',
        color: 'var(--text-main)',
        borderBottom: '2px solid var(--border-color)',
        paddingBottom: '8px',
        marginBottom: '16px'
    },
    sectionSubtitle: {
        color: 'var(--text-muted)',
        marginTop: '-12px',
        marginBottom: '16px',
        fontSize: '14px'
    },
    statsGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '16px'
    },
    statCard: {
        padding: '24px',
        borderRadius: '8px',
        textAlign: 'center',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
    },
    statLabel: {
        fontSize: '14px',
        fontWeight: 'bold',
        letterSpacing: '1px',
        opacity: 0.9
    },
    statValue: {
        fontSize: '48px',
        fontWeight: 'bold',
        margin: '8px 0'
    },
    statSub: {
        fontSize: '12px',
        color: 'var(--text-muted)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '4px'
    },
    card: {
        backgroundColor: 'var(--card-bg)',
        padding: '24px',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        border: '1px solid var(--border-color)'
    },
    comparisonRow: {
        display: 'flex',
        gap: '32px',
        flexWrap: 'wrap'
    },
    barBg: {
        height: '8px',
        backgroundColor: '#f1f5f9',
        borderRadius: '4px',
        overflow: 'hidden'
    },
    barFill: {
        height: '100%',
        borderRadius: '4px'
    },
    deltaBadge: {
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: '11px',
        fontWeight: 'bold'
    },
    statusBadge: {
        padding: '4px 12px',
        borderRadius: '16px',
        fontSize: '14px',
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
        backgroundColor: 'var(--hover-bg)',
        border: '1px solid var(--border-color)',
        padding: '4px 12px',
        borderRadius: '16px',
        fontSize: '13px',
        color: 'var(--text-main)'
    },
    actionBox: {
        backgroundColor: '#1e3a5f',
        color: 'white',
        padding: '16px',
        borderRadius: '8px',
        display: 'flex',
        gap: '12px',
        alignItems: 'flex-start'
    },
    toggleBtn: {
        background: 'none',
        border: 'none',
        color: '#3b82f6',
        padding: 0,
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: 'bold'
    },
    table: {
        width: '100%',
        borderCollapse: 'collapse',
        textAlign: 'left'
    },
    th: {
        padding: '12px 16px',
        borderBottom: '2px solid var(--border-color)',
        color: 'var(--text-muted)',
        fontWeight: 'bold',
        fontSize: '14px',
        backgroundColor: 'var(--table-header)'
    },
    td: {
        padding: '12px 16px',
        borderBottom: '1px solid var(--border-color)',
        fontSize: '14px',
        color: 'var(--text-main)'
    }
};

export default RootCauseAnalytics;
