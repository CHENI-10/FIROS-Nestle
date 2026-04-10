import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const ActionRecommendations = () => {
    const [theme, setTheme] = useState(sessionStorage.getItem('theme') || 'light');
    const [recommendations, setRecommendations] = useState({
        high_risk: [],
        medium_risk: [],
        low_risk: [],
        dispatch_queue: [],
        distributors: [],
        total_in_queue: 0,
        total_clearance: 0
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [selectedBatch, setSelectedBatch] = useState(null);
    const [activeTab, setActiveTab] = useState('all');
    const [showDispatchModal, setShowDispatchModal] = useState(false);
    const [selectedDistributor, setSelectedDistributor] = useState('');
    const [isModalConfirmed, setIsModalConfirmed] = useState(false);
    
    // New states for real API flow
    const [isProcessing, setIsProcessing] = useState(false);
    const [clearanceReason, setClearanceReason] = useState('');
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    const fetchRecommendations = async () => {
        const token = sessionStorage.getItem('token');
        if (!token) {
            navigate('/login');
            return;
        }

        try {
            const response = await fetch('/api/dashboard/recommendations', {
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
                distributors: Array.isArray(data.distributors) ? data.distributors : [],
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

    useEffect(() => {
        fetchRecommendations();
        const interval = setInterval(fetchRecommendations, 60000);
        return () => clearInterval(interval);
    }, [navigate]);

    useEffect(() => {
        if (!loading && recommendations && location.state?.autoSelectBatchId && !selectedBatch) {
            const targetId = location.state.autoSelectBatchId;
            const allBatches = [
                ...(recommendations.high_risk || []),
                ...(recommendations.medium_risk || []),
                ...(recommendations.dispatch_queue || []),
                ...(recommendations.low_risk || [])
            ];
            const found = allBatches.find(b => String(b.batch_id) === String(targetId));
            if (found) {
                setSelectedBatch(found);
                if (found.risk_band === 'high') {
                    setActiveTab('clearance');
                } else if (found.risk_band === 'medium') {
                    setActiveTab('priority');
                } else {
                    setActiveTab('all');
                }
                // Clear the state so it doesn't re-trigger
                window.history.replaceState({}, document.title);
            }
        }
    }, [loading, recommendations, location.state, selectedBatch]);

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

    const isDark = theme === 'dark';
    const bgColor = isDark ? '#0f172a' : '#f8fafc';
    const textColor = isDark ? '#f1f5f9' : '#1e293b';
    const cardBgColor = isDark ? '#1e293b' : 'white';
    const textMuted = isDark ? '#94a3b8' : '#64748b';
    const navBg = isDark ? '#1e293b' : '#3D1C02';
    
    const riskColors = {
        high: '#ef4444',
        medium: '#f59e0b',
        low: '#22c55e'
    };

    let displayBatches = [];
    if (activeTab === 'all') {
        displayBatches = [...recommendations.high_risk, ...recommendations.dispatch_queue];
    } else if (activeTab === 'priority') {
        displayBatches = recommendations.medium_risk;
    } else if (activeTab === 'clearance') {
        displayBatches = recommendations.high_risk;
    } else if (activeTab === 'low') {
        displayBatches = recommendations.low_risk;
    }

    if (loading && recommendations.total_in_queue === 0 && recommendations.total_clearance === 0) {
        return (
            <div style={{ minHeight: '100vh', backgroundColor: bgColor, color: textColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>
                <p style={{ fontWeight: 'bold' }}>Loading Recommendations...</p>
            </div>
        );
    }

    const openDispatchModal = () => {
        setSelectedDistributor(selectedBatch.suggested_distributor_id || '');
        setClearanceReason('');
        setIsModalConfirmed(false);
        setShowDispatchModal(true);
    };

    const executeAction = async () => {
        setIsProcessing(true);
        try {
            const token = sessionStorage.getItem('token');
            const actionType = selectedBatch.risk_band === 'high' ? 'clearance' : 'dispatch';
            
            const payload = {
                batch_id: selectedBatch.batch_id,
                action_type: actionType,
                distributor_id: actionType === 'dispatch' ? selectedDistributor : null,
                reason: actionType === 'clearance' ? (clearanceReason || 'System Promoted Clearance') : null
            };

            const response = await fetch('/api/dashboard/recommendations/action', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Failed to process action');
            }

            // Close modal & reset selection
            setShowDispatchModal(false);
            setSelectedBatch(null);
            
            // Re-fetch to clear this batch organically from the UI queue
            await fetchRecommendations();

            setShowSuccessModal(true);

        } catch (err) {
            console.error('Error confirming action:', err);
            setError('Error: ' + err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const btnStyle = { padding: '12px 24px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' };

    return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: bgColor, color: textColor, fontFamily: 'inherit', overflow: 'hidden' }}>
            <style>{`
                @media (max-width: 768px) {
                    .panel-left { width: 100% !important; display: ${selectedBatch ? 'none' : 'flex'} !important; border-right: none !important; }
                    .panel-right { width: 100% !important; display: ${selectedBatch ? 'block' : 'none'} !important; }
                }
                * { box-sizing: border-box; }
                .batch-item:hover { background-color: ${isDark ? '#334155' : '#f1f5f9'}; }
            `}</style>
            
            <nav style={{ flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', backgroundColor: navBg, color: 'white' }}>
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

            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                <div className="panel-left" style={{ width: '380px', flexShrink: 0, display: 'flex', flexDirection: 'column', backgroundColor: cardBgColor, borderRight: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
                    
                    <div style={{ padding: '24px', borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, flexShrink: 0 }}>
                        <button
                            onClick={() => navigate('/dashboard')}
                            style={{ background: 'transparent', border: 'none', color: isDark ? '#60a5fa' : '#2563eb', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', padding: 0 }}
                        >
                            <span>←</span> Dashboard
                        </button>
                        <h1 style={{ margin: '0 0 16px 0', fontSize: '24px' }}>Dispatch Control Centre</h1>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <div style={{ padding: '4px 8px', borderRadius: '16px', backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#eff6ff', color: '#3b82f6', fontSize: '12px', fontWeight: 'bold' }}>
                                Queue: {recommendations.total_in_queue}
                            </div>
                            <div style={{ padding: '4px 8px', borderRadius: '16px', backgroundColor: isDark ? 'rgba(245, 158, 11, 0.2)' : '#fffbeb', color: '#f59e0b', fontSize: '12px', fontWeight: 'bold' }}>
                                Priority: {recommendations.medium_risk.length || 0}
                            </div>
                            <div style={{ padding: '4px 8px', borderRadius: '16px', backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#fef2f2', color: '#ef4444', fontSize: '12px', fontWeight: 'bold' }}>
                                Clearance: {recommendations.total_clearance}
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', padding: '16px 24px', gap: '8px', borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, overflowX: 'auto', flexShrink: 0 }}>
                        {['all', 'priority', 'clearance', 'low'].map(tab => (
                            <button key={tab} onClick={() => setActiveTab(tab)} style={{
                                padding: '6px 12px', borderRadius: '16px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', textTransform: 'capitalize',
                                backgroundColor: activeTab === tab ? (isDark ? '#475569' : '#e2e8f0') : 'transparent',
                                color: activeTab === tab ? textColor : textMuted, flexShrink: 0
                            }}>
                                {tab === 'low' ? 'Low Risk' : tab}
                            </button>
                        ))}
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        {displayBatches.length === 0 ? (
                            <div style={{ padding: '32px 24px', textAlign: 'center', color: textMuted }}>No batches found in this view.</div>
                        ) : (
                            displayBatches.map((batch, index) => {
                                const isSelected = selectedBatch?.batch_id === batch.batch_id;
                                const isHigh = batch.risk_band === 'high';
                                const isMedium = batch.risk_band === 'medium';
                                const badgeColor = isHigh ? riskColors.high : (isMedium ? riskColors.medium : riskColors.low);
                                
                                return (
                                    <div className="batch-item" key={batch.batch_id} onClick={() => setSelectedBatch(batch)} style={{
                                        padding: '16px 24px', borderBottom: `1px solid ${isDark ? '#334155' : '#f1f5f9'}`, cursor: 'pointer',
                                        backgroundColor: isSelected ? (isDark ? '#334155' : '#f8fafc') : 'transparent',
                                        borderLeft: isSelected ? `4px solid ${badgeColor}` : '4px solid transparent',
                                        display: 'flex', gap: '16px', alignItems: 'center'
                                    }}>
                                        {!isHigh && (
                                            <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: isDark ? '#0f172a' : '#1e293b', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold', flexShrink: 0 }}>
                                                {recommendations.dispatch_queue.findIndex(b => b.batch_id === batch.batch_id) + 1}
                                            </div>
                                        )}
                                        {isHigh && (
                                            <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#fef2f2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0 }}>
                                                ⚠️
                                            </div>
                                        )}
                                        
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                                <div style={{ fontWeight: 'bold', fontSize: '15px' }}>{batch.product_name}</div>
                                                <div style={{ fontSize: '10px', fontWeight: 'bold', color: badgeColor, backgroundColor: isHigh ? '#fef2f2' : (isMedium ? '#fffbeb' : '#f0fdf4'), padding: '2px 6px', borderRadius: '4px' }}>
                                                    {isHigh ? 'CLEARANCE' : (isMedium ? 'PRIORITY' : 'NORMAL')}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: textMuted }}>
                                                <span>{batch.batch_id}</span>
                                                <span>FRS: {Number(batch.frs_score).toFixed(0)} | {batch.days_in_warehouse}d</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                <div className="panel-right" style={{ flex: 1, backgroundColor: bgColor, overflowY: 'auto' }}>
                    {!selectedBatch ? (
                        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: textMuted, fontWeight: 'bold' }}>
                            Select a batch to view details and take action
                        </div>
                    ) : (() => {
                        const batch = selectedBatch;
                        const isHigh = batch.risk_band === 'high';
                        const isMedium = batch.risk_band === 'medium';
                        const badgeColor = isHigh ? riskColors.high : (isMedium ? riskColors.medium : riskColors.low);
                        
                        return (
                            <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 32px' }}>
                                <button className="mobile-back-btn" onClick={() => setSelectedBatch(null)} style={{ background: 'transparent', border: 'none', color: isDark ? '#60a5fa' : '#2563eb', cursor: 'pointer', fontWeight: 'bold', display: 'none', alignItems: 'center', gap: '8px', marginBottom: '24px', padding: 0 }}>
                                    <span>←</span> Back to List
                                    <style>{`@media (max-width: 768px) { .mobile-back-btn { display: flex !important; } }`}</style>
                                </button>

                                <div style={{ marginBottom: '32px' }}>
                                    <h2 style={{ fontSize: '32px', margin: '0 0 16px 0' }}>{batch.product_name}</h2>
                                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                        <span style={{ padding: '6px 12px', borderRadius: '6px', backgroundColor: isDark ? '#1e293b' : '#e2e8f0', fontSize: '14px', fontWeight: 'bold' }}>{batch.batch_id}</span>
                                        <span style={{ padding: '6px 12px', borderRadius: '6px', backgroundColor: isDark ? 'rgba(99,102,241,0.2)' : '#e0e7ff', color: isDark ? '#818cf8' : '#4338ca', fontSize: '14px', fontWeight: 'bold' }}>Zone {batch.zone_id}</span>
                                        <span style={{ padding: '6px 12px', borderRadius: '6px', backgroundColor: isHigh ? '#fef2f2' : (isMedium ? '#fffbeb' : '#f0fdf4'), color: badgeColor, fontSize: '14px', fontWeight: 'bold' }}>
                                            {isHigh ? 'CLEARANCE' : (isMedium ? 'PRIORITY DISPATCH' : 'NORMAL DISPATCH')}
                                        </span>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginBottom: '32px' }}>
                                    <div style={{ backgroundColor: cardBgColor, padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                                        <div style={{ color: textMuted, fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>FRS Score</div>
                                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: badgeColor }}>{Number(batch.frs_score).toFixed(1)}/100</div>
                                    </div>
                                    <div style={{ backgroundColor: cardBgColor, padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                                        <div style={{ color: textMuted, fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>Days in Warehouse</div>
                                        <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{batch.days_in_warehouse}</div>
                                    </div>
                                    <div style={{ backgroundColor: cardBgColor, padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                                        <div style={{ color: textMuted, fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>Expiry Date</div>
                                        <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{new Date(batch.expiry_date).toLocaleDateString()}</div>
                                    </div>
                                    <div style={{ backgroundColor: cardBgColor, padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                                        <div style={{ color: textMuted, fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>Quantity</div>
                                        <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{batch.quantity} units</div>
                                    </div>
                                </div>

                                <div style={{ backgroundColor: cardBgColor, padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '32px', borderLeft: '4px solid #3b82f6' }}>
                                    <div style={{ fontSize: '14px', color: textMuted, fontWeight: 'bold', marginBottom: '8px' }}>Suggested Distributor</div>
                                    <div style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '4px' }}>{batch.suggested_distributor_name || 'TBC'}</div>
                                    <div style={{ fontSize: '14px' }}>Next visit: <span style={{ fontWeight: 'bold' }}>{batch.suggested_next_visit_date ? new Date(batch.suggested_next_visit_date).toLocaleDateString() : 'TBC'}</span> <span style={{ color: textMuted, fontStyle: 'italic', marginLeft: '8px' }}>(Soonest available pickup)</span></div>
                                </div>

                                {batch.urgency_score >= 3 && (
                                    <div style={{ backgroundColor: '#fffbeb', color: '#b45309', padding: '16px 24px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
                                        <span style={{ fontSize: '24px' }}>⚠️</span> 
                                        <span style={{ fontWeight: 'bold' }}>Long Storage Alert — this batch has been in warehouse over 90 days</span>
                                    </div>
                                )}

                                <div style={{
                                    fontStyle: 'italic',
                                    backgroundColor: isHigh ? (isDark ? 'rgba(239, 68, 68, 0.1)' : '#fef2f2') : (isMedium ? (isDark ? 'rgba(245, 158, 11, 0.1)' : '#fffbeb') : (isDark ? 'rgba(34, 197, 94, 0.1)' : '#f0fdf4')),
                                    color: (isDark ? textColor : '#334155'),
                                    borderLeft: `3px solid ${badgeColor}`,
                                    padding: '24px',
                                    borderRadius: '12px',
                                    marginBottom: '32px',
                                    lineHeight: '1.6'
                                }}>
                                    "{batch.recommendation}"
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, paddingTop: '32px' }}>
                                    <div style={{ color: textMuted, fontSize: '14px', fontWeight: 'bold' }}>
                                        Review recommendations before confirming. Action will sync to database.
                                    </div>
                                    
                                    <button 
                                        onClick={openDispatchModal}
                                        style={{ 
                                            ...btnStyle, 
                                            backgroundColor: isHigh ? riskColors.high : riskColors.low, 
                                            color: 'white',
                                        }}
                                    >
                                        {isHigh ? 'Approve Clearance' : 'Confirm Dispatch'}
                                    </button>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            </div>

            {showDispatchModal && selectedBatch && (
                <div style={{ 
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
                    backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '24px'
                }}>
                    <div style={{ 
                        backgroundColor: cardBgColor, width: '100%', maxWidth: '480px', 
                        borderRadius: '16px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
                        overflow: 'hidden'
                    }}>
                        <div style={{ 
                            padding: '24px', 
                            borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                            backgroundColor: selectedBatch.risk_band === 'high' ? (isDark ? 'rgba(239, 68, 68, 0.1)' : '#fef2f2') : (selectedBatch.risk_band === 'medium' ? (isDark ? 'rgba(245, 158, 11, 0.1)' : '#fffbeb') : (isDark ? 'rgba(34, 197, 94, 0.1)' : '#f0fdf4'))
                        }}>
                            <h3 style={{ margin: 0, color: selectedBatch.risk_band === 'high' ? '#ef4444' : (selectedBatch.risk_band === 'medium' ? '#b45309' : '#15803d'), fontSize: '20px' }}>
                                {selectedBatch.risk_band === 'high' ? 'Approve Clearance' : 'Confirm Dispatch'} — {selectedBatch.product_name}
                            </h3>
                        </div>
                        
                        <div style={{ padding: '24px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                                <div>
                                    <div style={{ fontSize: '13px', color: textMuted, marginBottom: '4px' }}>Batch ID</div>
                                    <div style={{ fontWeight: 'bold', fontSize: '15px' }}>{selectedBatch.batch_id}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '13px', color: textMuted, marginBottom: '4px' }}>FRS Score</div>
                                    <div style={{ fontWeight: 'bold', fontSize: '15px' }}>{Number(selectedBatch.frs_score).toFixed(1)}/100</div>
                                </div>
                            </div>

                            {selectedBatch.risk_band === 'high' ? (
                                <div style={{ marginBottom: '24px' }}>
                                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>Clearance Reason</label>
                                    <textarea 
                                        value={clearanceReason}
                                        onChange={(e) => setClearanceReason(e.target.value)}
                                        placeholder="System Promoted Clearance"
                                        style={{ 
                                            width: '100%', padding: '12px', borderRadius: '8px', 
                                            border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`,
                                            backgroundColor: isDark ? '#0f172a' : 'white',
                                            color: textColor,
                                            fontSize: '15px',
                                            minHeight: '80px',
                                            resize: 'vertical'
                                        }}
                                    />
                                </div>
                            ) : (
                                <div style={{ marginBottom: '24px' }}>
                                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>Assign Distributor</label>
                                    <select 
                                        value={selectedDistributor}
                                        onChange={(e) => setSelectedDistributor(e.target.value)}
                                        style={{ 
                                            width: '100%', padding: '12px', borderRadius: '8px', 
                                            border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`,
                                            backgroundColor: isDark ? '#0f172a' : 'white',
                                            color: textColor,
                                            fontSize: '15px'
                                        }}
                                    >
                                        <option value="" disabled>Select a distributor...</option>
                                        {recommendations.distributors?.map(d => (
                                            <option key={d.distributor_id} value={d.distributor_id}>{d.distributor_name} — Next: {new Date(d.next_visit_date).toLocaleDateString()}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer', backgroundColor: isDark ? '#334155' : '#f8fafc', padding: '16px', borderRadius: '8px' }}>
                                <input 
                                    type="checkbox" 
                                    checked={isModalConfirmed}
                                    onChange={(e) => setIsModalConfirmed(e.target.checked)}
                                    style={{ marginTop: '4px', transform: 'scale(1.2)', cursor: 'pointer' }} 
                                />
                                <span style={{ fontSize: '14px', lineHeight: '1.4', fontWeight: 'bold', color: isModalConfirmed ? textColor : textMuted }}>I confirm this action is final and will permanently remove this batch from standard inventory.</span>
                            </label>
                        </div>

                        {error && (
                            <div style={{ padding: '12px 16px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '8px', marginBottom: '24px', fontSize: '14px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                                {error}
                            </div>
                        )}

                        <div style={{ padding: '20px 24px', backgroundColor: isDark ? '#0f172a' : '#f8fafc', display: 'flex', gap: '12px', borderTop: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
                            <button 
                                onClick={() => { setShowDispatchModal(false); setError(null); }}
                                style={{ flex: 1, padding: '12px 20px', borderRadius: '8px', border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`, backgroundColor: 'transparent', color: textColor, fontWeight: 'bold', cursor: 'pointer' }}
                                disabled={isProcessing}
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={executeAction}
                                disabled={!isModalConfirmed || isProcessing || (selectedBatch.risk_band !== 'high' && !selectedDistributor)}
                                style={{ 
                                    ...btnStyle, 
                                    flex: 1,
                                    backgroundColor: selectedBatch.risk_band === 'high' ? riskColors.high : riskColors.low, 
                                    color: 'white',
                                    opacity: (!isModalConfirmed || isProcessing || (selectedBatch.risk_band !== 'high' && !selectedDistributor)) ? 0.5 : 1,
                                    cursor: (!isModalConfirmed || isProcessing || (selectedBatch.risk_band !== 'high' && !selectedDistributor)) ? 'not-allowed' : 'pointer'
                                }}
                            >
                                {isProcessing ? 'Processing...' : (selectedBatch.risk_band === 'high' ? 'Approve Clearance' : 'Confirm Dispatch')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Success Modal */}
            {showSuccessModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ backgroundColor: cardBgColor, padding: '40px', borderRadius: '16px', width: '100%', maxWidth: '440px', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
                        <div style={{ width: '64px', height: '64px', margin: '0 auto 24px', borderRadius: '50%', border: '4px solid #10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ width: '18px', height: '32px', borderBottom: '4px solid #10b981', borderRight: '4px solid #10b981', transform: 'rotate(45deg)', marginTop: '-8px' }} />
                        </div>
                        <h2 style={{ margin: '0 0 16px 0', fontSize: '28px' }}>Action Confirmed</h2>
                        <p style={{ color: textMuted, marginBottom: '32px', fontSize: '15px' }}>The batch has been successfully removed from the active queue and officially logged in the system ledger.</p>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <button 
                                onClick={() => { setShowSuccessModal(false); navigate('/certificates'); }}
                                style={{ background: isDark ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' : '#ffffff', color: isDark ? '#C8A96E' : '#3D1C02', border: isDark ? '2px solid #C8A96E' : '2px solid #3D1C02', padding: '16px', borderRadius: '12px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}
                                onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
                                onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
                            >
                                <span style={{ marginRight: '8px', fontSize: '14px' }}>[ LEDGER ]</span> View Certificate Vault
                            </button>
                            <button 
                                onClick={() => setShowSuccessModal(false)}
                                style={{ background: 'transparent', border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`, color: textColor, padding: '16px', borderRadius: '12px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' }}
                            >
                                Continue Recommending
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ActionRecommendations;
