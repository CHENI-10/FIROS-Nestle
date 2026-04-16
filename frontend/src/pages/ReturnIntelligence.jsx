import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const ReturnIntelligence = () => {
    const navigate = useNavigate();
    const [theme, setTheme] = useState(sessionStorage.getItem('theme') || 'light');
    const [activeTab, setActiveTab] = useState('log_return'); // 'log_return' or 'history'
    
    // Form State
    const [batchId, setBatchId] = useState('');
    const [distributorId, setDistributorId] = useState('');
    const [returnReason, setReturnReason] = useState('');
    
    const [distributors, setDistributors] = useState([]);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);
    const [submitLoading, setSubmitLoading] = useState(false);
    const [error, setError] = useState(null);
    const [successResult, setSuccessResult] = useState(null);

    // Evaluation & DSS State
    const [evaluationLoading, setEvaluationLoading] = useState(false);
    const [evaluationResult, setEvaluationResult] = useState(null);
    const [managerDecision, setManagerDecision] = useState('');
    const [overrideReason, setOverrideReason] = useState('');

    // Evidence State
    const [dispatchEvidence, setDispatchEvidence] = useState(null);
    const [evidenceLoading, setEvidenceLoading] = useState(false);
    const [evidenceError, setEvidenceError] = useState('');

    // Resolve State
    const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
    const [resolvingReturn, setResolvingReturn] = useState(null);
    const [resolveDecision, setResolveDecision] = useState('');
    const [resolveOverrideReason, setResolveOverrideReason] = useState('');
    const [resolveError, setResolveError] = useState('');
    const [resolveLoading, setResolveLoading] = useState(false);

    const isDark = theme === 'dark';
    const bgColor = isDark ? '#0f172a' : '#f8fafc';
    const textColor = isDark ? '#f1f5f9' : '#1e293b';
    const cardBgColor = isDark ? '#1e293b' : '#ffffff';
    const navBg = isDark ? '#1e293b' : '#3D1C02';
    const textMuted = isDark ? '#94a3b8' : '#64748b';
    const inputBg = isDark ? '#334155' : '#ffffff';
    const borderCol = isDark ? '#475569' : '#cbd5e1';

    useEffect(() => {
        fetchDistributors();
        if (activeTab === 'history') {
            fetchHistory();
        }
    }, [activeTab]);

    const fetchDistributors = async () => {
        const token = sessionStorage.getItem('token');
        try {
            const res = await fetch('/api/dashboard/distributors', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setDistributors(data.map(d => ({
                    id: d.distributor_id,
                    name: d.distributor_name
                })));
            }
        } catch (err) {
            console.error("Failed to load distributors", err);
        }
    };

    const fetchHistory = async () => {
        setLoading(true);
        const token = sessionStorage.getItem('token');
        try {
            const res = await fetch('/api/dashboard/returns', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to fetch return history');
            const data = await res.json();
            setHistory(data);
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

    const openResolveModal = (record) => {
        setResolvingReturn(record);
        setResolveDecision('');
        setResolveOverrideReason('');
        setResolveError('');
        setIsResolveModalOpen(true);
    };

    const handleResolveSubmit = async () => {
        if (!resolveDecision) {
            setResolveError('Please select a final decision');
            return;
        }
        
        setResolveError('');
        
        if (resolveDecision !== resolvingReturn.system_recommendation && !resolveOverrideReason.trim()) {
            setResolveError('An override justification is required when diverging from system advice.');
            return;
        }

        setResolveLoading(true);
        const token = sessionStorage.getItem('token');

        try {
            const payload = {
                manager_decision: resolveDecision,
                override_reason: resolveOverrideReason
            };

            const res = await fetch(`/api/dashboard/returns/${resolvingReturn.return_id}/resolve`, {
                method: 'PATCH',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const result = await res.json();

            if (!res.ok) {
                throw new Error(result.error || 'Failed to resolve return request');
            }

            setIsResolveModalOpen(false);
            setSuccessResult(true);
            fetchHistory(); // refresh the view

        } catch (err) {
            console.error(err);
            setResolveError(err.message);
        } finally {
            setResolveLoading(false);
        }
    };

    const handleBatchChange = (e) => {
        setBatchId(e.target.value);
        setDispatchEvidence(null);
        setEvidenceError('');
        setEvaluationResult(null);
        setSuccessResult(null);
    };

    const handleBatchBlur = async () => {
        if (!batchId.trim()) return;
        setEvidenceLoading(true);
        setEvidenceError('');
        const token = sessionStorage.getItem('token');
        try {
            const res = await fetch('/api/dashboard/dispatches', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const responseData = await res.json();
                const data = responseData.dispatches || responseData;
                // Find the latest dispatch for this batch (returns happen after dispatch, regardless of collection status)
                const activeDispatch = data.find(d => d.batch_id === batchId);
                if (activeDispatch) {
                    setDispatchEvidence(activeDispatch);
                    setDistributorId(activeDispatch.distributor_id);
                } else {
                    setEvidenceError("No dispatch record found for this batch ID. Make sure the batch has actually been dispatched.");
                }
            } else {
                setEvidenceError("Failed to verify batch dispatch status.");
            }
        } catch (err) {
            console.error(err);
            setEvidenceError("Error communicating with server.");
        } finally {
            setEvidenceLoading(false);
        }
    };

    const handleEvaluate = async (e) => {
        if (e) e.preventDefault();
        setError(null);
        setEvaluationResult(null);
        setSuccessResult(null);

        if (!batchId || !distributorId || !returnReason) {
            setError("All fields are required before evaluation.");
            return;
        }

        setEvaluationLoading(true);
        const token = sessionStorage.getItem('token');

        try {
            const res = await fetch('/api/dashboard/returns/evaluate', {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ batch_id: batchId })
            });

            const result = await res.json();

            if (!res.ok) {
                throw new Error(result.error || 'Failed to evaluate return');
            }

            setEvaluationResult(result);
            setManagerDecision(result.recommendation); // Default action
            setOverrideReason('');

        } catch (err) {
            console.error(err);
            setError(err.message);
        } finally {
            setEvaluationLoading(false);
        }
    };

    const handleSubmitAction = async () => {
        setError(null);

        if (managerDecision !== evaluationResult.recommendation && !overrideReason.trim()) {
            setError("An override justification is strictly required when diverging from system advice.");
            return;
        }

        setSubmitLoading(true);
        const token = sessionStorage.getItem('token');

        try {
            const payload = {
                batch_id: batchId,
                distributor_id: distributorId,
                return_reason: returnReason,
                system_recommendation: evaluationResult.recommendation,
                manager_decision: managerDecision,
                override_reason: overrideReason,
                frs_at_dispatch: evaluationResult.frs_at_dispatch
            };

            const res = await fetch('/api/dashboard/returns', {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const result = await res.json();

            if (!res.ok) {
                throw new Error(result.error || 'Failed to submit return records');
            }

            setSuccessResult(true);
            setEvaluationResult(null);
            setBatchId('');
            setDistributorId('');
            setReturnReason('');

        } catch (err) {
            console.error(err);
            setError(err.message);
        } finally {
            setSubmitLoading(false);
        }
    };

    const getRecommendationColor = (rec) => {
        const lower = String(rec).toLowerCase();
        if (lower === 'accept') return '#10b981'; // Green
        if (lower === 'review') return '#f59e0b'; // Amber
        if (lower === 'reject') return '#ef4444'; // Red
        return '#64748b';
    };

    return (
        <div style={{ minHeight: '100vh', backgroundColor: bgColor, color: textColor, fontFamily: 'inherit' }}>
            {/* Navbar */}
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
                {/* Header elements */}
                <div style={{ marginBottom: '32px' }}>
                    <button
                        onClick={() => navigate('/dashboard')}
                        style={{ background: 'transparent', border: 'none', color: isDark ? '#60a5fa' : '#2563eb', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', padding: 0 }}
                    >
                        <span>←</span> Back to Dashboard
                    </button>
                    <h1 style={{ margin: '0 0 8px 0', fontSize: '32px' }}>Return Intelligence Module</h1>
                    <p style={{ margin: 0, color: textMuted }}>Evaluate distributor returns and determine liability based on FRS constraints and distribution times.</p>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: '24px', borderBottom: `2px solid ${borderCol}`, marginBottom: '32px' }}>
                    <button 
                        onClick={() => setActiveTab('log_return')}
                        style={{ 
                            background: 'none', border: 'none', padding: '12px 0', 
                            fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', 
                            color: activeTab === 'log_return' ? (isDark ? '#60a5fa' : '#2563eb') : textMuted,
                            borderBottom: activeTab === 'log_return' ? `3px solid ${isDark ? '#60a5fa' : '#2563eb'}` : '3px solid transparent',
                            transform: 'translateY(2px)' // adjust tab alignment with border
                        }}
                    >
                        Log Return
                    </button>
                    <button 
                        onClick={() => setActiveTab('history')}
                        style={{ 
                            background: 'none', border: 'none', padding: '12px 0', 
                            fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', 
                            color: activeTab === 'history' ? (isDark ? '#60a5fa' : '#2563eb') : textMuted,
                            borderBottom: activeTab === 'history' ? `3px solid ${isDark ? '#60a5fa' : '#2563eb'}` : '3px solid transparent',
                            transform: 'translateY(2px)'
                        }}
                    >
                        Return History
                    </button>
                </div>

                {/* Log Return Tab */}
                {activeTab === 'log_return' && (
                    <div style={{ display: 'flex', gap: '32px', alignItems: 'flex-start' }}>
                        {/* Form Section */}
                        <div style={{ flex: 1, backgroundColor: cardBgColor, padding: '32px', borderRadius: '12px', border: `1px solid ${borderCol}` }}>
                            <h2 style={{ marginTop: 0, marginBottom: '24px' }}>Submit Return Evaluation</h2>
                            
                            {error && (
                                <div style={{ padding: '16px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '8px', marginBottom: '24px', fontWeight: 'bold' }}>
                                    {error}
                                </div>
                            )}

                            <form style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                <div>
                                    <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: textColor }}>Batch ID</label>
                                    <input 
                                        type="text" 
                                        value={batchId}
                                        onChange={handleBatchChange}
                                        onBlur={handleBatchBlur}
                                        placeholder="e.g. BATCH-A001"
                                        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: `1px solid ${borderCol}`, backgroundColor: inputBg, color: textColor, boxSizing: 'border-box' }}
                                    />
                                    {evidenceLoading && <div style={{ marginTop: '8px', fontSize: '13px', color: textMuted }}>Verifying dispatch record...</div>}
                                </div>

                                {dispatchEvidence && (
                                    <div style={{ backgroundColor: '#f0f7ff', borderLeft: '4px solid #3b82f6', borderRadius: '8px', padding: '16px' }}>
                                        <div style={{ fontWeight: 'bold', color: '#1e3a8a', marginBottom: '12px' }}>📋 Dispatch Evidence Found</div>
                                        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '12px' }}>
                                            <div style={{ flex: 1, minWidth: '100px' }}>
                                                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>FRS at Dispatch</div>
                                                <div style={{ fontSize: '18px', fontWeight: 'bold', color: Number(dispatchEvidence.frs_at_dispatch) >= 80 ? '#10b981' : Number(dispatchEvidence.frs_at_dispatch) >= 60 ? '#f59e0b' : '#ef4444' }}>
                                                    {Number(dispatchEvidence.frs_at_dispatch).toFixed(1)}
                                                </div>
                                            </div>
                                            <div style={{ flex: 1, minWidth: '100px' }}>
                                                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Days Since Dispatch</div>
                                                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#334155' }}>
                                                    {Math.floor((new Date() - new Date(dispatchEvidence.dispatch_timestamp)) / (1000 * 60 * 60 * 24))} Days
                                                </div>
                                            </div>
                                            <div style={{ flex: 1, minWidth: '120px' }}>
                                                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Dispatched To</div>
                                                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#334155' }}>
                                                    {dispatchEvidence.distributor_name}
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#64748b', borderTop: '1px solid #cbd5e1', paddingTop: '8px' }}>
                                            Dispatched on {new Date(dispatchEvidence.dispatch_timestamp).toLocaleDateString()} — Original dispatch condition verified
                                        </div>
                                    </div>
                                )}

                                {evidenceError && (
                                    <div style={{ backgroundColor: '#fef2f2', borderLeft: '4px solid #ef4444', borderRadius: '8px', padding: '12px', color: '#b91c1c', fontSize: '14px', fontWeight: '500' }}>
                                        {evidenceError}
                                    </div>
                                )}
                                
                                <div>
                                    <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: textColor }}>Distributor</label>
                                    <select 
                                        value={distributorId}
                                        onChange={(e) => setDistributorId(e.target.value)}
                                        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: `1px solid ${borderCol}`, backgroundColor: inputBg, color: textColor, boxSizing: 'border-box' }}
                                    >
                                        <option value="">Select Distributor...</option>
                                        {distributors.map(d => (
                                            <option key={d.id} value={d.id}>{d.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: textColor }}>Return Reason</label>
                                    <textarea 
                                        value={returnReason}
                                        onChange={(e) => setReturnReason(e.target.value)}
                                        rows="4"
                                        placeholder="Enter details about the return context..."
                                        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: `1px solid ${borderCol}`, backgroundColor: inputBg, color: textColor, resize: 'vertical', boxSizing: 'border-box' }}
                                    ></textarea>
                                </div>

                                {!evaluationResult && !successResult && (
                                    <button 
                                        type="button" 
                                        onClick={handleEvaluate}
                                        disabled={evaluationLoading}
                                        style={{ 
                                            padding: '16px', borderRadius: '8px', border: 'none', backgroundColor: '#3D1C02', 
                                            color: 'white', fontWeight: 'bold', fontSize: '16px', cursor: evaluationLoading ? 'wait' : 'pointer',
                                            marginTop: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
                                        }}
                                    >
                                        {evaluationLoading ? 'Evaluating Data...' : 'Evaluate Return Request'}
                                    </button>
                                )}
                            </form>
                        </div>

                        {/* Evaluation & Decision Support Panel */}
                        {evaluationResult && !successResult && (
                            <div style={{ flex: 1, backgroundColor: cardBgColor, padding: '32px', borderRadius: '12px', border: `1px solid ${getRecommendationColor(evaluationResult.recommendation)}`, boxShadow: `0 10px 25px -5px ${getRecommendationColor(evaluationResult.recommendation)}40` }}>
                                <div style={{ fontSize: '14px', fontWeight: 'bold', color: textMuted, letterSpacing: '1px', marginBottom: '16px', textTransform: 'uppercase' }}>
                                    System Intelligence Report
                                </div>
                                
                                <div style={{ textAlign: 'center', margin: '24px 0' }}>
                                    <div style={{ 
                                        display: 'inline-block',
                                        backgroundColor: getRecommendationColor(evaluationResult.recommendation),
                                        color: '#ffffff',
                                        fontSize: '32px',
                                        fontWeight: 'bold',
                                        padding: '12px 36px',
                                        borderRadius: '50px',
                                        letterSpacing: '2px',
                                        textTransform: 'uppercase',
                                        boxShadow: 'inset 0 -4px 0 rgba(0,0,0,0.2)'
                                    }}>
                                        {evaluationResult.recommendation}
                                    </div>
                                </div>

                                <div style={{ backgroundColor: isDark ? '#0f172a' : '#f8fafc', padding: '20px', borderRadius: '8px', marginBottom: '24px' }}>
                                    <div style={{ fontSize: '16px', lineHeight: '1.6', fontWeight: 'bold', textAlign: 'center', color: textColor }}>
                                        {evaluationResult.reason}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${borderCol}`, paddingTop: '24px', marginBottom: '24px' }}>
                                    <div>
                                        <div style={{ color: textMuted, fontSize: '12px', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 'bold' }}>FRS at Dispatch</div>
                                        <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{Number(evaluationResult.frs_at_dispatch).toFixed(1)}</div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ color: textMuted, fontSize: '12px', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 'bold' }}>Days Out</div>
                                        <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{evaluationResult.days_since_dispatch} Days</div>
                                    </div>
                                </div>

                                <div style={{ backgroundColor: isDark ? '#1e293b' : '#ffffff', border: `2px solid ${borderCol}`, borderRadius: '8px', padding: '20px' }}>
                                    <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '16px', color: textColor }}>Manager Action Required</div>
                                    <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: textMuted, fontSize: '14px' }}>Final Recommendation Decision</label>
                                    <select 
                                        value={managerDecision}
                                        onChange={(e) => setManagerDecision(e.target.value)}
                                        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: `1px solid ${managerDecision !== evaluationResult.recommendation ? '#ef4444' : borderCol}`, backgroundColor: inputBg, color: textColor, boxSizing: 'border-box', marginBottom: '16px', fontWeight: 'bold' }}
                                    >
                                        <option value="accept">ACCEPT Return (Nestlé Liability)</option>
                                        <option value="review">REVIEW Return (Hold for QA Inspection)</option>
                                        <option value="reject">REJECT Return (Distributor Liability)</option>
                                    </select>

                                    {managerDecision !== evaluationResult.recommendation && (
                                        <div style={{ marginBottom: '16px' }}>
                                            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#ef4444', fontSize: '14px' }}>⚠️ System Override Justification (Mandatory)</label>
                                            <textarea 
                                                value={overrideReason}
                                                onChange={(e) => setOverrideReason(e.target.value)}
                                                rows="3"
                                                placeholder="Provide detailed manager justification or reference physical inspection report IDs..."
                                                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ef4444', backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#fef2f2', color: textColor, resize: 'vertical', boxSizing: 'border-box' }}
                                            ></textarea>
                                        </div>
                                    )}

                                    <button 
                                        onClick={handleSubmitAction}
                                        disabled={submitLoading}
                                        style={{ 
                                            width: '100%', padding: '16px', borderRadius: '8px', border: 'none', backgroundColor: '#3b82f6', 
                                            color: 'white', fontWeight: 'bold', fontSize: '16px', cursor: submitLoading ? 'wait' : 'pointer',
                                            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
                                        }}
                                    >
                                        {submitLoading ? 'Committing...' : 'Confirm & Update Database'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Success State */}
                        {successResult && (
                            <div style={{ flex: 1, backgroundColor: cardBgColor, padding: '48px 32px', borderRadius: '12px', border: `1px solid #10b981`, textAlign: 'center' }}>
                                <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
                                <h3 style={{ color: textColor, marginBottom: '8px', fontSize: '24px' }}>Database Updated Successfully</h3>
                                <p style={{ color: textMuted, marginBottom: '24px' }}>The batch status has been moved to "Returned" and the manager decision log has been committed to the ledger.</p>
                                <button 
                                    onClick={() => setSuccessResult(null)}
                                    style={{ 
                                        padding: '12px 24px', borderRadius: '8px', border: `1px solid ${borderCol}`, backgroundColor: 'transparent', 
                                        color: textColor, fontWeight: 'bold', cursor: 'pointer'
                                    }}
                                >
                                    Process Another Return
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Return History Tab */}
                {activeTab === 'history' && (
                    <div style={{ backgroundColor: cardBgColor, padding: '32px', borderRadius: '12px', border: `1px solid ${borderCol}`, overflow: 'hidden' }}>
                        {loading ? (
                            <div style={{ textAlign: 'center', padding: '64px', fontWeight: 'bold' }}>Loading Return Histories...</div>
                        ) : error ? (
                            <div style={{ textAlign: 'center', padding: '64px', color: '#ef4444' }}>{error}</div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: isDark ? '#334155' : '#f8fafc', color: textMuted, fontSize: '14px', borderBottom: `2px solid ${borderCol}` }}>
                                            <th style={{ padding: '16px', fontWeight: 'bold' }}>ID</th>
                                            <th style={{ padding: '16px', fontWeight: 'bold' }}>Product & Batch</th>
                                            <th style={{ padding: '16px', fontWeight: 'bold' }}>Distributor</th>
                                            <th style={{ padding: '16px', fontWeight: 'bold' }}>Reason</th>
                                            <th style={{ padding: '16px', fontWeight: 'bold' }}>Dispatch Info</th>
                                            <th style={{ padding: '16px', fontWeight: 'bold' }}>Recommendation</th>
                                            <th style={{ padding: '16px', fontWeight: 'bold' }}>Date</th>
                                            <th style={{ padding: '16px', fontWeight: 'bold' }}>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {history.length === 0 ? (
                                            <tr>
                                                <td colSpan="8" style={{ padding: '32px', textAlign: 'center', color: textMuted }}>No returned batches found.</td>
                                            </tr>
                                        ) : history.map(row => (
                                            <tr key={row.return_id} style={{ borderBottom: `1px solid ${borderCol}` }}>
                                                <td style={{ padding: '16px', fontWeight: 'bold', color: textMuted }}>#{row.return_id}</td>
                                                <td style={{ padding: '16px' }}>
                                                    <div style={{ fontWeight: 'bold', color: textColor }}>{row.product_name}</div>
                                                    <div style={{ fontSize: '13px', color: textMuted }}>{row.batch_id}</div>
                                                </td>
                                                <td style={{ padding: '16px', fontWeight: 'bold' }}>{row.distributor_name}</td>
                                                <td style={{ padding: '16px', color: textMuted, maxWidth: '200px' }}>
                                                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                                        {row.return_reason || 'N/A'}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '16px' }}>
                                                    <div><span style={{color: textMuted}}>FRS: </span><span style={{fontWeight: 'bold'}}>{Number(row.frs_at_dispatch).toFixed(1)}</span></div>
                                                    <div style={{ fontSize: '13px', color: textMuted, marginTop: '4px' }}>{row.days_since_dispatch} Days Out</div>
                                                </td>
                                                <td style={{ padding: '16px' }}>
                                                    <div style={{ marginBottom: '8px' }}>
                                                        <span style={{ 
                                                            backgroundColor: getRecommendationColor(row.decision),
                                                            color: 'white',
                                                            padding: '6px 12px',
                                                            borderRadius: '20px',
                                                            fontSize: '12px',
                                                            fontWeight: 'bold',
                                                            letterSpacing: '0.5px',
                                                            textTransform: 'uppercase',
                                                            display: 'inline-block'
                                                        }}>
                                                            {row.decision}
                                                        </span>
                                                    </div>
                                                    {row.system_recommendation && row.system_recommendation !== row.decision && (
                                                        <div style={{ fontSize: '11px', color: '#ef4444', fontWeight: 'bold', maxWidth: '150px' }}>
                                                            ⚠️ OVERRIDE (Sys: {row.system_recommendation.toUpperCase()})
                                                        </div>
                                                    )}
                                                </td>
                                                <td style={{ padding: '16px', color: textMuted, fontSize: '14px' }}>
                                                    {new Date(row.decided_at).toLocaleDateString()}
                                                </td>
                                                <td style={{ padding: '16px' }}>
                                                    {row.decision === 'review' && (
                                                        <button 
                                                            onClick={() => openResolveModal(row)}
                                                            style={{
                                                                background: isDark ? 'rgba(59, 130, 246, 0.2)' : '#eff6ff', 
                                                                color: '#3b82f6', 
                                                                border: 'none', 
                                                                padding: '6px 12px', 
                                                                borderRadius: '6px', 
                                                                fontWeight: 'bold', 
                                                                cursor: 'pointer',
                                                                fontSize: '12px'
                                                            }}
                                                        >
                                                            Resolve Review
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* Resolve Modal Overlay */}
            {isResolveModalOpen && resolvingReturn && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
                    <div style={{ backgroundColor: cardBgColor, width: '100%', maxWidth: '500px', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', border: `1px solid ${borderCol}` }}>
                        <div style={{ backgroundColor: navBg, padding: '20px 24px', color: 'white' }}>
                            <h3 style={{ margin: 0, fontSize: '20px' }}>Resolve Pending Review</h3>
                        </div>
                        
                        <div style={{ padding: '24px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', backgroundColor: isDark ? '#0f172a' : '#f8fafc', padding: '16px', borderRadius: '8px' }}>
                                <div>
                                    <div style={{ fontSize: '12px', color: textMuted, fontWeight: 'bold' }}>BATCH ID</div>
                                    <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{resolvingReturn.batch_id}</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '12px', color: textMuted, fontWeight: 'bold' }}>SYSTEM REC</div>
                                    <div style={{ fontWeight: 'bold', fontSize: '16px', color: getRecommendationColor(resolvingReturn.system_recommendation) }}>{resolvingReturn.system_recommendation.toUpperCase()}</div>
                                </div>
                            </div>

                            {resolveError && (
                                <div style={{ color: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '12px', borderRadius: '6px', marginBottom: '16px', fontSize: '14px', fontWeight: 'bold' }}>
                                    {resolveError}
                                </div>
                            )}

                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>Final Decision</label>
                                <select 
                                    value={resolveDecision}
                                    onChange={(e) => setResolveDecision(e.target.value)}
                                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: `1px solid ${borderCol}`, backgroundColor: isDark ? '#334155' : '#ffffff', color: textColor, boxSizing: 'border-box' }}
                                >
                                    <option value="">Select final action...</option>
                                    <option value="accept">ACCEPT Return (Nestlé Liability)</option>
                                    <option value="reject">REJECT Return (Distributor Liability)</option>
                                </select>
                            </div>

                            <div style={{ marginBottom: '24px' }}>
                                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>Override / Inspection Notes</label>
                                <textarea 
                                    value={resolveOverrideReason}
                                    onChange={(e) => setResolveOverrideReason(e.target.value)}
                                    rows="3"
                                    placeholder="Enter physical inspection results or justification..."
                                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: resolveDecision && resolveDecision !== resolvingReturn.system_recommendation ? '1px solid #ef4444' : `1px solid ${borderCol}`, backgroundColor: isDark ? '#334155' : '#ffffff', color: textColor, resize: 'vertical', boxSizing: 'border-box' }}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                <button 
                                    onClick={() => setIsResolveModalOpen(false)}
                                    style={{ padding: '12px 24px', borderRadius: '8px', border: `1px solid ${borderCol}`, backgroundColor: 'transparent', color: textColor, fontWeight: 'bold', cursor: 'pointer' }}
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={handleResolveSubmit}
                                    disabled={resolveLoading}
                                    style={{ padding: '12px 24px', borderRadius: '8px', border: 'none', backgroundColor: '#3b82f6', color: 'white', fontWeight: 'bold', cursor: resolveLoading ? 'wait' : 'pointer', opacity: resolveLoading ? 0.7 : 1 }}
                                >
                                    {resolveLoading ? 'Committing...' : 'Confirm Resolution'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReturnIntelligence;
