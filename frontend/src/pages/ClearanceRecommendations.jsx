import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const ClearanceRecommendations = () => {
    const navigate = useNavigate();
    const [theme, setTheme] = useState(sessionStorage.getItem('theme') || 'light');
    
    const [batches, setBatches] = useState([]);
    const [distributors, setDistributors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedBatch, setSelectedBatch] = useState(null);
    
    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedDistributorId, setSelectedDistributorId] = useState('');
    const [clearanceReason, setClearanceReason] = useState('');
    const [confirmCheck, setConfirmCheck] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [actionError, setActionError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const isDark = theme === 'dark';
    const bgColor = isDark ? '#0f172a' : '#f8fafc';
    const textColor = isDark ? '#f1f5f9' : '#1e293b';
    const cardBgColor = isDark ? '#1e293b' : '#ffffff';
    const navBg = isDark ? '#1e293b' : '#3D1C02';
    const textMuted = isDark ? '#94a3b8' : '#64748b';
    const borderCol = isDark ? '#334155' : '#e2e8f0';

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line
    }, []);

    const fetchData = async () => {
        setLoading(true);
        const token = sessionStorage.getItem('token');
        if (!token) {
            navigate('/login');
            return;
        }

        try {
            const [recRes, distRes] = await Promise.all([
                fetch('/api/dashboard/clearance-recommendations', {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch('/api/dashboard/dispatches', {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
            ]);

            if (!recRes.ok || !distRes.ok) {
                if (recRes.status === 401 || distRes.status === 401) {
                    sessionStorage.removeItem('token');
                    navigate('/login');
                    return;
                }
                throw new Error('Failed to load data');
            }

            const recData = await recRes.json();
            const distData = await distRes.json();

            setBatches(recData);

            // Extract unique distributors
            const uniqueDict = {};
            distData.forEach(d => {
                if (d.distributor_id && !uniqueDict[d.distributor_id]) {
                    uniqueDict[d.distributor_id] = {
                        id: d.distributor_id,
                        name: d.distributor_name
                    };
                }
            });
            setDistributors(Object.values(uniqueDict));
            setError(null);
        } catch (err) {
            console.error(err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('role');
        navigate('/login');
    };

    const toggleTheme = () => {
        const newTheme = isDark ? 'light' : 'dark';
        setTheme(newTheme);
        sessionStorage.setItem('theme', newTheme);
        document.body.className = newTheme;
    };

    const handleBatchSelect = (batch) => {
        setSelectedBatch(batch);
        setClearanceReason(batch.promotion_type || '');
    };

    const openModal = () => {
        if (!selectedBatch) return;
        setIsModalOpen(true);
        setSelectedDistributorId('');
        setConfirmCheck(false);
        setActionError('');
    };

    const submitClearance = async () => {
        if (!selectedDistributorId) {
            setActionError('Please select a distributor.');
            return;
        }
        if (!confirmCheck) {
            setActionError('You must confirm the clearance action.');
            return;
        }

        setActionLoading(true);
        setActionError('');
        const token = sessionStorage.getItem('token');

        try {
            const res = await fetch('/api/dashboard/recommendations/action', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    batch_id: selectedBatch.batch_id,
                    action_type: 'clearance',
                    distributor_id: selectedDistributorId,
                    reason: clearanceReason
                })
            });

            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'Failed to apply clearance');

            setSuccessMsg('Batch marked as Cleared');
            setBatches(batches.filter(b => b.batch_id !== selectedBatch.batch_id));
            setSelectedBatch(null);
            setIsModalOpen(false);

            setTimeout(() => setSuccessMsg(''), 3000);

        } catch (err) {
            console.error(err);
            setActionError(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const getPromoColor = (type) => {
        if (type === 'Trade Discount') return '#3b82f6'; // Blue
        if (type === 'Bundle Offer') return '#8b5cf6'; // Purple
        return '#ef4444'; // Red
    };

    return (
        <div style={{ minHeight: '100vh', backgroundColor: bgColor, color: textColor, fontFamily: 'inherit' }}>
            <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', backgroundColor: navBg, color: 'white' }}>
                <div style={{ fontWeight: 'bold', fontSize: '20px', letterSpacing: '1px' }}>
                    FIROS <span style={{ color: '#C8A96E', fontSize: '14px', marginLeft: '8px' }}>NESTLÉ LANKA</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    <button onClick={toggleTheme} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', fontSize: '18px' }}>
                        {isDark ? '☀️' : '🌙'}
                    </button>
                    <button onClick={handleLogout} style={{ background: 'rgba(0,0,0,0.2)', border: 'none', color: 'white', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                        Logout
                    </button>
                </div>
            </nav>

            <main style={{ padding: '32px 48px', maxWidth: '1400px', margin: '0 auto' }}>
                <div style={{ marginBottom: '32px' }}>
                    <button
                        onClick={() => navigate('/dashboard')}
                        style={{ background: 'transparent', border: 'none', color: isDark ? '#60a5fa' : '#2563eb', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', padding: 0 }}
                    >
                        <span>←</span> Back to Dashboard
                    </button>
                    <h1 style={{ margin: '0 0 8px 0', fontSize: '32px' }}>Clearance Recommendations</h1>
                    <p style={{ margin: 0, color: textMuted }}>AI-driven promotional guidance for high-risk batches approaching expiry.</p>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '64px', fontWeight: 'bold', fontSize: '18px' }}>Analyzing inventory risks...</div>
                ) : error ? (
                    <div style={{ textAlign: 'center', padding: '64px', color: '#ef4444' }}>{error}</div>
                ) : batches.length === 0 ? (
                    <div style={{ backgroundColor: cardBgColor, padding: '64px', borderRadius: '12px', textAlign: 'center', border: `1px solid ${borderCol}` }}>
                        <h3 style={{ margin: '0 0 8px 0' }}>No Urgent Clearances Required</h3>
                        <p style={{ color: textMuted, margin: 0 }}>All stored batches are within acceptable freshness levels.</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', gap: '32px', flexDirection: window.innerWidth < 1024 ? 'column' : 'row' }}>
                        {/* LEFT PANEL */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '70vh', overflowY: 'auto', paddingRight: '16px' }}>
                            {batches.map(batch => {
                                const isSelected = selectedBatch?.batch_id === batch.batch_id;
                                return (
                                    <div 
                                        key={batch.batch_id}
                                        onClick={() => handleBatchSelect(batch)}
                                        style={{ 
                                            backgroundColor: cardBgColor, 
                                            borderRadius: '12px', 
                                            padding: '24px',
                                            cursor: 'pointer',
                                            border: `2px solid ${isSelected ? (isDark ? '#60a5fa' : '#2563eb') : borderCol}`,
                                            transition: 'all 0.2s ease',
                                            boxShadow: isSelected ? '0 10px 15px -3px rgba(0,0,0,0.1)' : 'none',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                        }}
                                    >
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                                                <h3 style={{ margin: 0, fontSize: '18px' }}>{batch.product_name}</h3>
                                                <span style={{ backgroundColor: isDark ? '#334155' : '#f1f5f9', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', color: textMuted }}>Zone {batch.zone_id}</span>
                                            </div>
                                            <div style={{ color: textMuted, fontSize: '14px', marginBottom: '16px' }}>
                                                Batch: {batch.batch_id} | Days in WH: {batch.days_in_warehouse} | Expiry: {new Date(batch.expiry_date).toLocaleDateString()}
                                            </div>
                                            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                                                <span style={{ 
                                                    backgroundColor: 'rgba(239, 68, 68, 0.1)', 
                                                    color: '#ef4444', 
                                                    padding: '6px 12px', 
                                                    borderRadius: '6px', 
                                                    fontWeight: 'bold', 
                                                    fontSize: '14px' 
                                                }}>
                                                    FRS: {Number(batch.frs_score).toFixed(1)}
                                                </span>
                                                <span style={{ 
                                                    backgroundColor: `${getPromoColor(batch.promotion_type)}20`, 
                                                    color: getPromoColor(batch.promotion_type), 
                                                    padding: '6px 12px', 
                                                    borderRadius: '6px', 
                                                    fontWeight: 'bold', 
                                                    fontSize: '14px' 
                                                }}>
                                                    {batch.promotion_type}
                                                </span>
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '12px', color: textMuted, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px' }}>Discount</div>
                                            <div style={{ fontSize: '36px', fontWeight: '900', color: textColor, lineHeight: 1 }}>{batch.discount_percent}%</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* RIGHT PANEL */}
                        <div style={{ flex: 1 }}>
                            {selectedBatch ? (
                                <div style={{ backgroundColor: cardBgColor, borderRadius: '12px', padding: '32px', border: `1px solid ${borderCol}`, position: 'sticky', top: '32px' }}>
                                    <h2 style={{ margin: '0 0 24px 0', borderBottom: `1px solid ${borderCol}`, paddingBottom: '16px' }}>Recommendation Analysis</h2>
                                    
                                    <div style={{ backgroundColor: isDark ? '#0f172a' : '#f8fafc', padding: '24px', borderRadius: '8px', borderLeft: `4px solid ${getPromoColor(selectedBatch.promotion_type)}`, marginBottom: '32px' }}>
                                        <div style={{ fontSize: '16px', lineHeight: '1.6', fontWeight: '500' }}>
                                            "{selectedBatch.rationale}"
                                        </div>
                                    </div>

                                    <div style={{ marginBottom: '32px' }}>
                                        <div style={{ fontSize: '13px', textTransform: 'uppercase', color: textMuted, fontWeight: 'bold', marginBottom: '8px' }}>Recommended Action</div>
                                        <div style={{ fontSize: '20px', fontWeight: 'bold', color: textColor }}>
                                            Launch <span style={{ color: getPromoColor(selectedBatch.promotion_type) }}>{selectedBatch.promotion_type}</span> strategy
                                        </div>
                                    </div>

                                    <button 
                                        onClick={openModal}
                                        style={{ 
                                            width: '100%', 
                                            padding: '16px', 
                                            borderRadius: '8px', 
                                            border: 'none', 
                                            backgroundColor: '#10b981', 
                                            color: '#ffffff', 
                                            fontSize: '16px', 
                                            fontWeight: 'bold', 
                                            cursor: 'pointer',
                                            boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.3)'
                                        }}
                                    >
                                        Approve Clearance
                                    </button>
                                </div>
                            ) : (
                                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: textMuted, border: `2px dashed ${borderCol}`, borderRadius: '12px', padding: '64px' }}>
                                    Select a high-risk batch to view detailed clearance analysis.
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>

            {/* Clearance Modal Overlay */}
            {isModalOpen && selectedBatch && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
                    <div style={{ backgroundColor: cardBgColor, width: '100%', maxWidth: '500px', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', border: `1px solid ${borderCol}` }}>
                        <div style={{ backgroundColor: navBg, padding: '20px 24px', color: 'white' }}>
                            <h3 style={{ margin: 0, fontSize: '20px' }}>Approve Clearance — {selectedBatch.product_name}</h3>
                        </div>
                        
                        <div style={{ padding: '24px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', backgroundColor: isDark ? '#0f172a' : '#f8fafc', padding: '16px', borderRadius: '8px' }}>
                                <div>
                                    <div style={{ fontSize: '12px', color: textMuted, fontWeight: 'bold' }}>BATCH ID</div>
                                    <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{selectedBatch.batch_id}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '12px', color: textMuted, fontWeight: 'bold' }}>FRS SCORE</div>
                                    <div style={{ fontWeight: 'bold', fontSize: '16px', color: '#ef4444' }}>{Number(selectedBatch.frs_score).toFixed(1)}</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '12px', color: textMuted, fontWeight: 'bold' }}>PROMO DISCOUNT</div>
                                    <div style={{ fontWeight: 'bold', fontSize: '16px', color: getPromoColor(selectedBatch.promotion_type) }}>{selectedBatch.discount_percent}% OFF</div>
                                </div>
                            </div>

                            {actionError && (
                                <div style={{ color: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '12px', borderRadius: '6px', marginBottom: '16px', fontSize: '14px', fontWeight: 'bold' }}>
                                    {actionError}
                                </div>
                            )}

                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>Assign Distributor</label>
                                <select 
                                    value={selectedDistributorId}
                                    onChange={(e) => setSelectedDistributorId(e.target.value)}
                                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: `1px solid ${borderCol}`, backgroundColor: isDark ? '#334155' : '#ffffff', color: textColor, boxSizing: 'border-box' }}
                                >
                                    <option value="">Select Distributor...</option>
                                    {distributors.map(d => (
                                        <option key={d.id} value={d.id}>{d.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ marginBottom: '24px' }}>
                                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>Clearance Reason</label>
                                <input 
                                    type="text" 
                                    value={clearanceReason}
                                    onChange={(e) => setClearanceReason(e.target.value)}
                                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: `1px solid ${borderCol}`, backgroundColor: isDark ? '#334155' : '#ffffff', color: textColor, boxSizing: 'border-box' }}
                                />
                            </div>

                            <div style={{ marginBottom: '32px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                <input 
                                    type="checkbox" 
                                    id="confirmClearance"
                                    checked={confirmCheck}
                                    onChange={(e) => setConfirmCheck(e.target.checked)}
                                    style={{ marginTop: '4px', width: '18px', height: '18px', cursor: 'pointer' }}
                                />
                                <label htmlFor="confirmClearance" style={{ fontSize: '14px', color: textMuted, cursor: 'pointer', lineHeight: '1.4' }}>
                                    I confirm this clearance is final and the batch will be marked as Cleared, removing it from standard inventory.
                                </label>
                            </div>

                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                <button 
                                    onClick={() => setIsModalOpen(false)}
                                    style={{ padding: '12px 24px', borderRadius: '8px', border: `1px solid ${borderCol}`, backgroundColor: 'transparent', color: textColor, fontWeight: 'bold', cursor: 'pointer' }}
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={submitClearance}
                                    disabled={actionLoading}
                                    style={{ padding: '12px 24px', borderRadius: '8px', border: 'none', backgroundColor: '#ef4444', color: 'white', fontWeight: 'bold', cursor: actionLoading ? 'wait' : 'pointer', opacity: actionLoading ? 0.7 : 1 }}
                                >
                                    {actionLoading ? 'Processing...' : 'Confirm Clearance'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {successMsg && (
                <div style={{ position: 'fixed', bottom: '24px', right: '24px', backgroundColor: '#10b981', color: 'white', padding: '16px 24px', borderRadius: '8px', fontWeight: 'bold', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 2000, display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '20px' }}>✓</span> {successMsg}
                </div>
            )}
        </div>
    );
};

export default ClearanceRecommendations;
