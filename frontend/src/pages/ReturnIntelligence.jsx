import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Pagination from '../components/Pagination';
import './ReturnIntelligence.css';

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

    // Pagination state
    const [historyPage, setHistoryPage] = useState(1);
    const [historyPagination, setHistoryPagination] = useState({ total: 0, page: 1, totalPages: 1 });

    const isDark = theme === 'dark';

    useEffect(() => {
        fetchDistributors();
        if (activeTab === 'history') {
            fetchHistory(historyPage);
        }
    }, [activeTab, historyPage]);

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

    const fetchHistory = async (page = 1) => {
        setLoading(true);
        const token = sessionStorage.getItem('token');
        try {
            const res = await fetch(`/api/dashboard/returns?page=${page}&limit=25`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to fetch return history');
            const data = await res.json();
            setHistory(data.records || data);
            if (data.pagination) setHistoryPagination(data.pagination);
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
            fetchHistory(historyPage);

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
            // 1. Check Standard Dispatches
            const dispRes = await fetch('/api/dashboard/dispatches?limit=1000', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (dispRes.ok) {
                const responseData = await dispRes.json();
                const data = responseData.dispatches || responseData;
                const activeDispatch = data.find(d => d.batch_id === batchId);
                
                if (activeDispatch) {
                    setDispatchEvidence({
                        ...activeDispatch,
                        type: 'Standard Dispatch'
                    });
                    setDistributorId(activeDispatch.distributor_id);
                    setEvidenceLoading(false);
                    return;
                }
            }

            // 2. If not found in dispatches, check Clearance Ledger
            const clrRes = await fetch('/api/dashboard/clearance-ledger?limit=1000', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (clrRes.ok) {
                const responseData = await clrRes.json();
                const data = responseData.clearances || responseData;
                const activeClearance = data.find(c => c.batch_id === batchId);

                if (activeClearance) {
                    if (!activeClearance.distributor_name) {
                        setEvidenceError("This batch was cleared without a distributor assignment and cannot be returned through the system.");
                        setEvidenceLoading(false);
                        return;
                    }

                    setDispatchEvidence({
                        ...activeClearance,
                        type: 'Clearance Release',
                        frs_at_dispatch: activeClearance.frs_score, // Mapping clearance FRS to the same field
                        dispatch_timestamp: activeClearance.cleared_at // Mapping clearance time to the same field
                    });
                    setDistributorId(activeClearance.distributor_id);
                    setEvidenceLoading(false);
                    return;
                }
            }

            setEvidenceError("No outbound record found for this batch ID in either Dispatch or Clearance ledgers.");
            
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
            setManagerDecision(result.recommendation);
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
        if (lower === 'accept') return '#10b981';
        if (lower === 'review') return '#f59e0b';
        if (lower === 'reject') return '#ef4444';
        return '#64748b';
    };

    const getFrsColor = (frs) => {
        const val = Number(frs);
        if (val >= 80) return '#10b981';
        if (val >= 60) return '#f59e0b';
        return '#ef4444';
    };

    return (
        <div className={`ri-page ${theme}`}>
            {/* Navbar */}
            <nav className="ri-nav">
                <div className="ri-nav-logo">
                    FIROS <span>NESTLÉ LANKA</span>
                </div>
                <div className="ri-nav-actions">
                    <button onClick={toggleTheme} className="ri-theme-btn">
                        {isDark ? '☀️' : '🌙'}
                    </button>
                    <button onClick={handleLogout} className="ri-logout-btn">
                        Logout
                    </button>
                </div>
            </nav>

            <main className="ri-main">
                {/* Page Header */}
                <div className="ri-header">
                    <button onClick={() => navigate('/dashboard')} className="ri-back-btn">
                        <span>←</span> Back to Dashboard
                    </button>
                    <h1 className="ri-page-title">Return Intelligence Module</h1>
                    <p className="ri-page-subtitle">
                        Evaluate distributor returns and determine liability based on FRS constraints and distribution times.
                    </p>
                </div>

                {/* Tabs */}
                <div className="ri-tabs">
                    <button
                        onClick={() => setActiveTab('log_return')}
                        className={`ri-tab-btn ${activeTab === 'log_return' ? 'active' : ''}`}
                    >
                        Log Return
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`ri-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
                    >
                        Return History
                    </button>
                </div>

                {/* Log Return Tab */}
                {activeTab === 'log_return' && (
                    <div className="ri-log-return-layout">
                        {/* Form Section */}
                        <div className="ri-card">
                            <h2>Submit Return Evaluation</h2>

                            {error && (
                                <div className="ri-error-banner">{error}</div>
                            )}

                            <form className="ri-form">
                                <div className="ri-form-group">
                                    <label className="ri-label">Batch ID</label>
                                    <input
                                        type="text"
                                        value={batchId}
                                        onChange={handleBatchChange}
                                        onBlur={handleBatchBlur}
                                        placeholder="e.g. BATCH-A001"
                                        className="ri-input"
                                    />
                                    {evidenceLoading && (
                                        <div className="ri-input-hint">Verifying dispatch record...</div>
                                    )}
                                </div>

                                {dispatchEvidence && (
                                    <div className="ri-evidence-box" style={{ borderLeft: `4px solid ${dispatchEvidence.type === 'Clearance Release' ? '#ef4444' : '#3b82f6'}` }}>
                                        <div className="ri-evidence-title">
                                            {dispatchEvidence.type === 'Clearance Release' ? '🔥 Clearance Evidence Found' : '📋 Dispatch Evidence Found'}
                                        </div>
                                        <div className="ri-evidence-stats">
                                            <div className="ri-evidence-stat">
                                                <div className="ri-evidence-stat-label">FRS at {dispatchEvidence.type === 'Clearance Release' ? 'Clearance' : 'Dispatch'}</div>
                                                <div
                                                    className="ri-evidence-stat-value"
                                                    style={{ color: getFrsColor(dispatchEvidence.frs_at_dispatch) }}
                                                >
                                                    {Number(dispatchEvidence.frs_at_dispatch).toFixed(1)}
                                                </div>
                                            </div>
                                            <div className="ri-evidence-stat">
                                                <div className="ri-evidence-stat-label">Days Outbound</div>
                                                <div className="ri-evidence-stat-value">
                                                    {Math.floor((new Date() - new Date(dispatchEvidence.dispatch_timestamp)) / (1000 * 60 * 60 * 24))} Days
                                                </div>
                                            </div>
                                            <div className="ri-evidence-stat" style={{ minWidth: '120px' }}>
                                                <div className="ri-evidence-stat-label">Released To</div>
                                                <div className="ri-evidence-stat-value">
                                                    {dispatchEvidence.distributor_name}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="ri-evidence-footer">
                                            {dispatchEvidence.type === 'Clearance Release' ? 'Cleared' : 'Dispatched'} on {new Date(dispatchEvidence.dispatch_timestamp).toLocaleDateString()} — Original condition verified
                                        </div>
                                    </div>
                                )}

                                {evidenceError && (
                                    <div className="ri-evidence-error">{evidenceError}</div>
                                )}

                                <div className="ri-form-group">
                                    <label className="ri-label">Distributor</label>
                                    <select
                                        value={distributorId}
                                        onChange={(e) => setDistributorId(e.target.value)}
                                        className="ri-select"
                                    >
                                        <option value="">Select Distributor...</option>
                                        {distributors.map(d => (
                                            <option key={d.id} value={d.id}>{d.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="ri-form-group">
                                    <label className="ri-label">Return Reason</label>
                                    <textarea
                                        value={returnReason}
                                        onChange={(e) => setReturnReason(e.target.value)}
                                        rows="4"
                                        placeholder="Enter details about the return context..."
                                        className="ri-textarea"
                                    />
                                </div>

                                {!evaluationResult && !successResult && (
                                    <button
                                        type="button"
                                        onClick={handleEvaluate}
                                        disabled={evaluationLoading}
                                        className="ri-btn-primary"
                                    >
                                        {evaluationLoading ? 'Evaluating Data...' : 'Evaluate Return Request'}
                                    </button>
                                )}
                            </form>
                        </div>

                        {/* Evaluation & Decision Support Panel */}
                        {evaluationResult && !successResult && (
                            <div
                                className="ri-dss-panel"
                                style={{
                                    border: `1px solid ${getRecommendationColor(evaluationResult.recommendation)}`,
                                    boxShadow: `0 10px 25px -5px ${getRecommendationColor(evaluationResult.recommendation)}40`
                                }}
                            >
                                <div className="ri-dss-label">System Intelligence Report</div>

                                <div className="ri-recommendation-badge-wrapper">
                                    <div
                                        className="ri-recommendation-badge"
                                        style={{ backgroundColor: getRecommendationColor(evaluationResult.recommendation) }}
                                    >
                                        {evaluationResult.recommendation}
                                    </div>
                                </div>

                                <div className="ri-reason-box">
                                    <div className="ri-reason-text">{evaluationResult.reason}</div>
                                </div>

                                <div className="ri-dss-metrics">
                                    <div>
                                        <div className="ri-dss-metric-label">FRS at Dispatch</div>
                                        <div className="ri-dss-metric-value">
                                            {Number(evaluationResult.frs_at_dispatch).toFixed(1)}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div className="ri-dss-metric-label">Days Out</div>
                                        <div className="ri-dss-metric-value">
                                            {evaluationResult.days_since_dispatch} Days
                                        </div>
                                    </div>
                                </div>

                                <div className="ri-action-box">
                                    <div className="ri-action-box-title">Manager Action Required</div>
                                    <label className="ri-label-muted">Final Recommendation Decision</label>
                                    <select
                                        value={managerDecision}
                                        onChange={(e) => setManagerDecision(e.target.value)}
                                        className={`ri-select ${managerDecision !== evaluationResult.recommendation ? 'override-required' : ''}`}
                                        style={{ marginBottom: '16px' }}
                                    >
                                        <option value="accept">ACCEPT Return (Nestlé Liability)</option>
                                        <option value="review">REVIEW Return (Hold for QA Inspection)</option>
                                        <option value="reject">REJECT Return (Distributor Liability)</option>
                                    </select>

                                    {managerDecision !== evaluationResult.recommendation && (
                                        <div className="ri-override-textarea">
                                            <label className="ri-label-danger">⚠️ System Override Justification (Mandatory)</label>
                                            <textarea
                                                value={overrideReason}
                                                onChange={(e) => setOverrideReason(e.target.value)}
                                                rows="3"
                                                placeholder="Provide detailed manager justification or reference physical inspection report IDs..."
                                                className="ri-textarea"
                                                style={{ border: '1px solid #ef4444', backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#fef2f2' }}
                                            />
                                        </div>
                                    )}

                                    <button
                                        onClick={handleSubmitAction}
                                        disabled={submitLoading}
                                        className="ri-btn-confirm"
                                    >
                                        {submitLoading ? 'Committing...' : 'Confirm & Update Database'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Success State */}
                        {successResult && (
                            <div className="ri-success-card">
                                <div className="ri-success-icon">✅</div>
                                <h3 className="ri-success-title">Database Updated Successfully</h3>
                                <p className="ri-success-text">
                                    The batch status has been moved to "Returned" and the manager decision log has been committed to the ledger.
                                </p>
                                <button
                                    onClick={() => setSuccessResult(null)}
                                    className="ri-btn-ghost"
                                >
                                    Process Another Return
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Return History Tab */}
                {activeTab === 'history' && (
                    <div className="ri-history-card">
                        {loading ? (
                            <div className="ri-loading">Loading Return Histories...</div>
                        ) : error ? (
                            <div className="ri-error-msg">{error}</div>
                        ) : (
                            <div className="ri-table-wrapper">
                                <table className="ri-table">
                                    <thead>
                                        <tr>
                                            <th>ID</th>
                                            <th>Product &amp; Batch</th>
                                            <th>Distributor</th>
                                            <th>Reason</th>
                                            <th>Dispatch Info</th>
                                            <th>Recommendation</th>
                                            <th>Date</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {history.length === 0 ? (
                                            <tr>
                                                <td colSpan="8" style={{ padding: '32px', textAlign: 'center' }} className="ri-loading">
                                                    No returned batches found.
                                                </td>
                                            </tr>
                                        ) : history.map(row => (
                                            <tr key={row.return_id}>
                                                <td className="ri-td-id">#{row.return_id}</td>
                                                <td>
                                                    <div className="ri-td-product-name">{row.product_name}</div>
                                                    <div className="ri-td-batch-id">{row.batch_id}</div>
                                                </td>
                                                <td style={{ fontWeight: 'bold' }}>{row.distributor_name}</td>
                                                <td>
                                                    <div className="ri-td-reason">{row.return_reason || 'N/A'}</div>
                                                </td>
                                                <td>
                                                    <div className="ri-dispatch-frs">
                                                        <span style={{ fontWeight: 'normal' }}>FRS: </span>
                                                        {Number(row.frs_at_dispatch).toFixed(1)}
                                                    </div>
                                                    <div className="ri-dispatch-days">{row.days_since_dispatch} Days Out</div>
                                                </td>
                                                <td>
                                                    <div>
                                                        <span
                                                            className="ri-decision-badge"
                                                            style={{ backgroundColor: getRecommendationColor(row.decision) }}
                                                        >
                                                            {row.decision}
                                                        </span>
                                                    </div>
                                                    {row.system_recommendation && row.system_recommendation !== row.decision && (
                                                        <div className="ri-override-warning">
                                                            ⚠️ OVERRIDE (Sys: {row.system_recommendation.toUpperCase()})
                                                        </div>
                                                    )}
                                                </td>
                                                <td style={{ fontSize: '14px' }}>
                                                    {new Date(row.decided_at).toLocaleDateString()}
                                                </td>
                                                <td>
                                                    {row.decision === 'review' && (
                                                        <button
                                                            onClick={() => openResolveModal(row)}
                                                            className="ri-btn-resolve"
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
                        <Pagination
                            currentPage={historyPagination.page}
                            totalPages={historyPagination.totalPages}
                            totalItems={historyPagination.total}
                            onPageChange={(newPage) => setHistoryPage(newPage)}
                            isDark={isDark}
                        />
                    </div>
                )}
            </main>

            {/* Resolve Modal */}
            {isResolveModalOpen && resolvingReturn && (
                <div className="ri-modal-overlay">
                    <div className="ri-modal">
                        <div className="ri-modal-header">
                            <h3>Resolve Pending Review</h3>
                        </div>

                        <div className="ri-modal-body">
                            <div className="ri-modal-batch-summary">
                                <div>
                                    <div className="ri-modal-batch-label">BATCH ID</div>
                                    <div className="ri-modal-batch-value">{resolvingReturn.batch_id}</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div className="ri-modal-batch-label">SYSTEM REC</div>
                                    <div
                                        className="ri-modal-batch-value"
                                        style={{ color: getRecommendationColor(resolvingReturn.system_recommendation) }}
                                    >
                                        {resolvingReturn.system_recommendation.toUpperCase()}
                                    </div>
                                </div>
                            </div>

                            {resolveError && (
                                <div className="ri-modal-error">{resolveError}</div>
                            )}

                            <div className="ri-modal-field">
                                <label className="ri-label">Final Decision</label>
                                <select
                                    value={resolveDecision}
                                    onChange={(e) => setResolveDecision(e.target.value)}
                                    className="ri-select"
                                >
                                    <option value="">Select final action...</option>
                                    <option value="accept">ACCEPT Return (Nestlé Liability)</option>
                                    <option value="reject">REJECT Return (Distributor Liability)</option>
                                </select>
                            </div>

                            <div className="ri-modal-field">
                                <label className="ri-label">Override / Inspection Notes</label>
                                <textarea
                                    value={resolveOverrideReason}
                                    onChange={(e) => setResolveOverrideReason(e.target.value)}
                                    rows="3"
                                    placeholder="Enter physical inspection results or justification..."
                                    className="ri-textarea"
                                    style={
                                        resolveDecision && resolveDecision !== resolvingReturn.system_recommendation
                                            ? { border: '1px solid #ef4444' }
                                            : {}
                                    }
                                />
                            </div>

                            <div className="ri-modal-footer">
                                <button
                                    onClick={() => setIsResolveModalOpen(false)}
                                    className="ri-btn-cancel"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleResolveSubmit}
                                    disabled={resolveLoading}
                                    className="ri-btn-submit"
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
