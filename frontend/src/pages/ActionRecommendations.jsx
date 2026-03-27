import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const ActionRecommendations = () => {
    const [theme, setTheme] = useState(sessionStorage.getItem('theme') || 'light');
    const [recommendations, setRecommendations] = useState({
        high_risk: [],
        medium_risk: [],
        low_risk: [],
        dispatch_queue: [],
        total_in_queue: 0,
        total_clearance: 0
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [acknowledgedBatches, setAcknowledgedBatches] = useState(() => {
        const saved = localStorage.getItem('firos_acknowledged_batches');
        return saved ? JSON.parse(saved) : {};
    });
    const navigate = useNavigate();

    const handleAcknowledge = (batchId) => {
        const now = new Date();
        const timestamp = now.toLocaleString();
        const updated = {
            ...acknowledgedBatches,
            [batchId]: timestamp
        };
        setAcknowledgedBatches(updated);
        localStorage.setItem('firos_acknowledged_batches', JSON.stringify(updated));
    };

    useEffect(() => {
        const fetchRecommendations = async () => {
            const token = sessionStorage.getItem('token');
            if (!token) {
                navigate('/login');
                return;
            }

            try {
                const response = await fetch('http://localhost:5000/api/dashboard/recommendations', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!response.ok) {
                    if (response.status === 401 || response.status === 403) {
                        sessionStorage.removeItem('token');
                        navigate('/login');
                        return;
                    }
                    throw new Error('Failed to fetch recommendations');
                }

                const data = await response.json();
                setRecommendations({
                    high_risk: Array.isArray(data.high_risk) ? data.high_risk : [],
                    medium_risk: Array.isArray(data.medium_risk) ? data.medium_risk : [],
                    low_risk: Array.isArray(data.low_risk) ? data.low_risk : [],
                    dispatch_queue: Array.isArray(data.dispatch_queue) ? data.dispatch_queue : [],
                    total_in_queue: data.total_in_queue || 0,
                    total_clearance: data.total_clearance || 0
                });
                setError(null);
            } catch (err) {
                console.error("Error fetching recommendations:", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchRecommendations();
        const interval = setInterval(fetchRecommendations, 60000);
        return () => clearInterval(interval);
    }, [navigate]);

    const toggleTheme = () => {
        const newTheme = theme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);
        sessionStorage.setItem('theme', newTheme);
        document.documentElement.classList.toggle('dark', newTheme === 'dark');
    };

    const handleLogout = () => {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('role');
        navigate('/login');
    };

    const formatDays = (days) => {
        if (days === 0) return 'Today';
        if (days === 1) return 'Tomorrow';
        if (days === -1) return 'Yesterday';
        if (days > 1) return `In ${days} days`;
        return `${Math.abs(days)} days ago`;
    };

    const getDaysUntilExpiry = (expiryDate) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const expiry = new Date(expiryDate);
        expiry.setHours(0, 0, 0, 0);
        const diffTime = expiry - today;
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

    const isDark = theme === 'dark';
    const bgColor = isDark ? '#0f172a' : '#faf7f2';
    const textColor = isDark ? '#f1f5f9' : '#1e293b';
    const cardBgColor = isDark ? '#1e293b' : 'white';
    const textMuted = isDark ? '#94a3b8' : '#64748b';
    const navBg = isDark ? '#1e293b' : '#3D1C02';

    if (loading && recommendations.total_in_queue === 0 && recommendations.total_clearance === 0) {
        return (
            <div style={{ minHeight: '100vh', backgroundColor: bgColor, color: textColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Arial, sans-serif' }}>
                <p style={{ fontWeight: 'bold' }}>Loading Recommendations...</p>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', backgroundColor: bgColor, color: textColor, fontFamily: 'Arial, sans-serif', paddingBottom: '40px' }}>
            {/* Navbar */}
            <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', backgroundColor: navBg, color: 'white' }}>
                <div style={{ fontWeight: 'bold', fontSize: '20px', letterSpacing: '1px' }}>
                    FIROS <span style={{ color: '#C8A96E', fontSize: '14px', marginLeft: '8px' }}>NESTLÉ LANKA</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    <button onClick={toggleTheme} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', fontSize: '18px' }}>
                        {isDark ? <span>☀️</span> : <span>🌙</span>}
                    </button>
                    <button onClick={handleLogout} style={{ background: 'rgba(0,0,0,0.2)', border: 'none', color: 'white', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                        Logout
                    </button>
                </div>
            </nav>

            <div style={{ maxWidth: '1200px', margin: '0 auto', paddingTop: '32px' }}>
                {/* Back Link & Header */}
                <div style={{ padding: '0 24px', marginBottom: '32px' }}>
                    <button
                        onClick={() => navigate('/dashboard')}
                        style={{ background: 'transparent', border: 'none', color: isDark ? '#60a5fa' : '#2563eb', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}
                    >
                        <span>←</span> Back to Dashboard
                    </button>
                    <h1 style={{ margin: '0 0 8px 0', fontSize: '28px' }}>Action Recommendations</h1>
                    <p style={{ margin: 0, color: textMuted }}>System calculated dispatch and clearance recommendations based on FRS risk bands.</p>
                </div>

                {error && (
                    <div style={{ margin: '0 24px 32px 24px', padding: '16px', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: '8px', borderLeft: '4px solid #ef4444' }}>
                        <strong>Error:</strong> {error}
                    </div>
                )}

                {/* Summary Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', padding: '0 24px 32px 24px' }}>
                    <div style={{ backgroundColor: cardBgColor, borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', textAlign: 'center' }}>
                        <div style={{ color: '#3b82f6', marginBottom: '8px' }}><span style={{ fontSize: '20px' }}>📋</span></div>
                        <div style={{ fontSize: '48px', fontWeight: 'bold', color: '#3b82f6', margin: '8px 0' }}>{recommendations.total_in_queue}</div>
                        <div style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '14px' }}>Dispatch Queue</div>
                        <div style={{ fontSize: '12px', color: textMuted, marginTop: '4px' }}>Batches Ready To Dispatch</div>
                    </div>

                    <div style={{ backgroundColor: cardBgColor, borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', textAlign: 'center' }}>
                        <div style={{ color: '#f59e0b', marginBottom: '8px' }}><span style={{ fontSize: '20px' }}>🚚</span></div>
                        <div style={{ fontSize: '48px', fontWeight: 'bold', color: '#f59e0b', margin: '8px 0' }}>{recommendations.medium_risk.length || 0}</div>
                        <div style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '14px' }}>Priority Dispatch</div>
                        <div style={{ fontSize: '12px', color: textMuted, marginTop: '4px' }}>Need Urgent Dispatch</div>
                    </div>

                    <div style={{ backgroundColor: cardBgColor, borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', textAlign: 'center' }}>
                        <div style={{ color: '#ef4444', marginBottom: '8px' }}><span style={{ fontSize: '20px' }}>⚠️</span></div>
                        <div style={{ fontSize: '48px', fontWeight: 'bold', color: '#ef4444', margin: '8px 0' }}>{recommendations.total_clearance}</div>
                        <div style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '14px' }}>Clearance Required</div>
                        <div style={{ fontSize: '12px', color: textMuted, marginTop: '4px' }}>High Risk — Action Required</div>
                    </div>
                </div>

                {/* SECTION 1: HIGH RISK CLEARANCE */}
                <div style={{ marginBottom: '48px' }}>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', padding: '0 24px 16px 24px', display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', borderBottom: '1px solid #ef4444', margin: '0 24px 24px 24px' }}>
                        <span style={{ fontSize: '20px' }}>⚠️</span> High Risk Batches — Clearance Required
                    </div>

                    {recommendations.high_risk?.length === 0 ? (
                        <div style={{ margin: '0 24px', padding: '24px', borderRadius: '12px', border: '1px solid #334155', backgroundColor: cardBgColor, color: textMuted, textAlign: 'center', fontWeight: 'bold' }}>
                            ✅ No batches in this category
                        </div>
                    ) : (
                        <div>
                            {(Array.isArray(recommendations.high_risk) ? recommendations.high_risk : []).map(batch => (
                                <div key={batch.batch_id} style={{ backgroundColor: cardBgColor, borderRadius: '12px', padding: '20px', margin: '0 24px 16px 24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', borderLeft: '4px solid #ef4444' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                                        <h3 style={{ margin: 0, fontSize: '18px' }}>{batch.product_name}</h3>
                                        <span style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: isDark ? '#334155' : '#f1f5f9', fontSize: '12px', fontWeight: 'bold' }}>{batch.batch_id}</span>
                                        <span style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: isDark ? 'rgba(99,102,241,0.2)' : '#e0e7ff', color: isDark ? '#818cf8' : '#4338ca', fontSize: '12px', fontWeight: 'bold' }}>Zone {batch.zone_id}</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '24px', fontSize: '14px', marginBottom: '16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ color: textMuted, fontWeight: 'bold' }}>FRS:</span>
                                            <span style={{ padding: '4px 12px', borderRadius: '20px', fontWeight: 'bold', backgroundColor: '#fef2f2', color: '#ef4444' }}>
                                                {Number(batch.frs_score).toFixed(1)}/100
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ color: textMuted, fontWeight: 'bold' }}>Days in warehouse:</span>
                                            <span style={{ fontWeight: 'bold' }}>{batch.days_in_warehouse} days</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ color: textMuted, fontWeight: 'bold' }}>Expiry:</span>
                                            <span style={{ fontWeight: 'bold', color: '#ef4444' }}>{new Date(batch.expiry_date).toLocaleDateString()}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ color: textMuted, fontWeight: 'bold' }}>Qty:</span>
                                            <span style={{ fontWeight: 'bold' }}>{batch.quantity} units</span>
                                        </div>
                                    </div>

                                    <div style={{
                                        fontStyle: 'italic',
                                        fontSize: '14px',
                                        backgroundColor: acknowledgedBatches[batch.batch_id] ? 'rgba(148, 163, 184, 0.1)' : 'rgba(239, 68, 68, 0.15)',
                                        borderLeft: `3px solid ${acknowledgedBatches[batch.batch_id] ? '#94a3b8' : '#ef4444'}`,
                                        color: acknowledgedBatches[batch.batch_id] ? textMuted : (isDark ? '#fca5a5' : '#991b1b'), 
                                        padding: '12px 16px',
                                        borderRadius: '8px',
                                        marginBottom: '16px'
                                    }}>
                                        "{batch.recommendation}"
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: isDark ? '1px solid #334155' : '1px solid #f1f5f9', paddingTop: '16px' }}>
                                        <div style={{ fontSize: '14px', color: textMuted, fontWeight: 'bold' }}>
                                            {acknowledgedBatches[batch.batch_id] ? `Acknowledged at ${acknowledgedBatches[batch.batch_id]}` : ''}
                                        </div>
                                        <button 
                                            onClick={() => handleAcknowledge(batch.batch_id)}
                                            disabled={!!acknowledgedBatches[batch.batch_id]}
                                            style={{ 
                                                padding: '8px 16px', 
                                                borderRadius: '8px', 
                                                border: 'none', 
                                                cursor: acknowledgedBatches[batch.batch_id] ? 'default' : 'pointer', 
                                                opacity: acknowledgedBatches[batch.batch_id] ? 0.7 : 1, 
                                                backgroundColor: '#ef4444', 
                                                color: 'white', 
                                                fontWeight: 'bold' 
                                            }}
                                        >
                                            {acknowledgedBatches[batch.batch_id] ? 'Acknowledged' : 'Acknowledge Recommendation'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* SECTION 2: MEDIUM RISK PRIORITY DISPATCH */}
                <div style={{ marginBottom: '48px' }}>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', padding: '0 24px 16px 24px', display: 'flex', alignItems: 'center', gap: '8px', color: '#f59e0b', borderBottom: '1px solid #f59e0b', margin: '0 24px 24px 24px' }}>
                        <span style={{ fontSize: '20px' }}>🚚</span> Medium Risk — Priority Dispatch
                    </div>

                    {recommendations.medium_risk?.length === 0 ? (
                        <div style={{ margin: '0 24px', padding: '24px', borderRadius: '12px', border: '1px solid #334155', backgroundColor: cardBgColor, color: textMuted, textAlign: 'center', fontWeight: 'bold' }}>
                            ✅ No batches in this category
                        </div>
                    ) : (
                        <div>
                            {(Array.isArray(recommendations.medium_risk) ? recommendations.medium_risk : []).map(batch => (
                                <div key={batch.batch_id} style={{ backgroundColor: cardBgColor, borderRadius: '12px', padding: '20px', margin: '0 24px 16px 24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', borderLeft: '4px solid #f59e0b' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                                        <h3 style={{ margin: 0, fontSize: '18px' }}>{batch.product_name}</h3>
                                        <span style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: isDark ? '#334155' : '#f1f5f9', fontSize: '12px', fontWeight: 'bold' }}>{batch.batch_id}</span>
                                        <span style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: isDark ? 'rgba(99,102,241,0.2)' : '#e0e7ff', color: isDark ? '#818cf8' : '#4338ca', fontSize: '12px', fontWeight: 'bold' }}>Zone {batch.zone_id}</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '24px', fontSize: '14px', marginBottom: '16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ color: textMuted, fontWeight: 'bold' }}>FRS:</span>
                                            <span style={{ padding: '4px 12px', borderRadius: '20px', fontWeight: 'bold', backgroundColor: '#fffbeb', color: '#f59e0b' }}>
                                                {Number(batch.frs_score).toFixed(1)}/100
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ color: textMuted, fontWeight: 'bold' }}>Days in warehouse:</span>
                                            <span style={{ fontWeight: 'bold' }}>{batch.days_in_warehouse} days</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ color: textMuted, fontWeight: 'bold' }}>Expiry:</span>
                                            <span style={{ fontWeight: 'bold', color: '#f59e0b' }}>{new Date(batch.expiry_date).toLocaleDateString()}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ color: textMuted, fontWeight: 'bold' }}>Qty:</span>
                                            <span style={{ fontWeight: 'bold' }}>{batch.quantity} units</span>
                                        </div>
                                    </div>

                                    <div style={{
                                        fontStyle: 'italic',
                                        fontSize: '14px',
                                        backgroundColor: acknowledgedBatches[batch.batch_id] ? 'rgba(148, 163, 184, 0.1)' : 'rgba(245, 158, 11, 0.15)',
                                        borderLeft: `3px solid ${acknowledgedBatches[batch.batch_id] ? '#94a3b8' : '#f59e0b'}`,
                                        color: acknowledgedBatches[batch.batch_id] ? textMuted : (isDark ? '#fcd34d' : '#854d0e'), 
                                        padding: '12px 16px',
                                        borderRadius: '8px',
                                        marginBottom: '16px'
                                    }}>
                                        "{batch.recommendation}"
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: isDark ? '1px solid #334155' : '1px solid #f1f5f9', paddingTop: '16px' }}>
                                        <div style={{ fontSize: '14px', color: textMuted, fontWeight: 'bold' }}>
                                            {acknowledgedBatches[batch.batch_id] ? `Acknowledged at ${acknowledgedBatches[batch.batch_id]}` : ''}
                                        </div>
                                        <button 
                                            onClick={() => handleAcknowledge(batch.batch_id)}
                                            disabled={!!acknowledgedBatches[batch.batch_id]}
                                            style={{ 
                                                padding: '8px 16px', 
                                                borderRadius: '8px', 
                                                border: 'none', 
                                                cursor: acknowledgedBatches[batch.batch_id] ? 'default' : 'pointer', 
                                                opacity: acknowledgedBatches[batch.batch_id] ? 0.7 : 1, 
                                                backgroundColor: '#22c55e', 
                                                color: 'white', 
                                                fontWeight: 'bold' 
                                            }}
                                        >
                                            {acknowledgedBatches[batch.batch_id] ? 'Acknowledged' : 'Acknowledge Recommendation'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* SECTION 3: FULL DISPATCH QUEUE */}
                <div style={{ marginBottom: '48px' }}>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', padding: '0 24px 16px 24px', display: 'flex', alignItems: 'center', gap: '8px', color: '#3b82f6', borderBottom: '1px solid #3b82f6', margin: '0 24px 24px 24px' }}>
                        <span style={{ fontSize: '20px' }}>📋</span> Full Dispatch Queue — FEFO Order
                    </div>

                    {recommendations.dispatch_queue?.length === 0 ? (
                        <div style={{ margin: '0 24px', padding: '24px', borderRadius: '12px', border: '1px solid #334155', backgroundColor: cardBgColor, color: textMuted, textAlign: 'center', fontWeight: 'bold' }}>
                            ✅ No batches in this category
                        </div>
                    ) : (
                        <div>
                            {(Array.isArray(recommendations.dispatch_queue) ? recommendations.dispatch_queue : []).map((batch, index) => {
                                const isMedium = batch.risk_band === 'medium';
                                const leftBorderColor = isMedium ? '#f59e0b' : '#22c55e';
                                const badgeBg = isMedium ? '#fffbeb' : '#f0fdf4';
                                const badgeColor = isMedium ? '#f59e0b' : '#22c55e';

                                return (
                                    <div key={batch.batch_id} style={{ display: 'flex', gap: '16px', margin: '0 24px 16px 24px', position: 'relative' }}>
                                        <div style={{ flex: 1, backgroundColor: cardBgColor, borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', borderLeft: `4px solid ${leftBorderColor}` }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                                                <h3 style={{ margin: 0, fontSize: '18px' }}>{batch.product_name}</h3>
                                                <span style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: isDark ? '#334155' : '#f1f5f9', fontSize: '12px', fontWeight: 'bold' }}>{batch.batch_id}</span>
                                                <span style={{ padding: '4px 12px', borderRadius: '20px', fontWeight: 'bold', backgroundColor: badgeBg, color: badgeColor, fontSize: '12px' }}>
                                                    {isMedium ? 'PRIORITY' : 'NORMAL'}
                                                </span>
                                                <span style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: isDark ? 'rgba(99,102,241,0.2)' : '#e0e7ff', color: isDark ? '#818cf8' : '#4338ca', fontSize: '12px', fontWeight: 'bold' }}>Zone {batch.zone_id}</span>
                                            </div>

                                            <div style={{ display: 'flex', gap: '24px', fontSize: '14px', marginBottom: '16px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ color: textMuted, fontWeight: 'bold' }}>FRS:</span>
                                                    <span style={{ padding: '4px 12px', borderRadius: '20px', fontWeight: 'bold', backgroundColor: badgeBg, color: badgeColor }}>
                                                        {Number(batch.frs_score).toFixed(1)}/100
                                                    </span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ color: textMuted, fontWeight: 'bold' }}>Days in warehouse:</span>
                                                    <span style={{ fontWeight: 'bold' }}>{batch.days_in_warehouse} days</span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ color: textMuted, fontWeight: 'bold' }}>Expiry:</span>
                                                    <span style={{ fontWeight: 'bold', color: leftBorderColor }}>{new Date(batch.expiry_date).toLocaleDateString()}</span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ color: textMuted, fontWeight: 'bold' }}>Qty:</span>
                                                    <span style={{ fontWeight: 'bold' }}>{batch.quantity} units</span>
                                                </div>
                                            </div>

                                            <div style={{
                                                fontStyle: 'italic',
                                                fontSize: '14px',
                                                backgroundColor: acknowledgedBatches[batch.batch_id] ? 'rgba(148, 163, 184, 0.1)' : (isMedium ? 'rgba(245, 158, 11, 0.15)' : 'rgba(34, 197, 94, 0.15)'),
                                                borderLeft: `3px solid ${acknowledgedBatches[batch.batch_id] ? '#94a3b8' : (isMedium ? '#f59e0b' : '#22c55e')}`,
                                                color: acknowledgedBatches[batch.batch_id] ? textMuted : (isDark ? (isMedium ? '#fcd34d' : '#86efac') : (isMedium ? '#854d0e' : '#166534')), 
                                                padding: '12px 16px',
                                                borderRadius: '8px',
                                                marginBottom: '16px'
                                            }}>
                                                "{batch.recommendation}"
                                            </div>

                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: isDark ? '1px solid #334155' : '1px solid #f1f5f9', paddingTop: '16px' }}>
                                                <div style={{ fontSize: '14px', color: textMuted, fontWeight: 'bold' }}>
                                                    {acknowledgedBatches[batch.batch_id] ? `Acknowledged at ${acknowledgedBatches[batch.batch_id]}` : ''}
                                                </div>
                                                <button 
                                                    onClick={() => handleAcknowledge(batch.batch_id)}
                                                    disabled={!!acknowledgedBatches[batch.batch_id]}
                                                    style={{ 
                                                        padding: '8px 16px', 
                                                        borderRadius: '8px', 
                                                        border: 'none', 
                                                        cursor: acknowledgedBatches[batch.batch_id] ? 'default' : 'pointer', 
                                                        opacity: acknowledgedBatches[batch.batch_id] ? 0.7 : 1, 
                                                        backgroundColor: '#22c55e', 
                                                        color: 'white', 
                                                        fontWeight: 'bold' 
                                                    }}
                                                >
                                                    {acknowledgedBatches[batch.batch_id] ? 'Acknowledged' : 'Acknowledge Recommendation'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

export default ActionRecommendations;
