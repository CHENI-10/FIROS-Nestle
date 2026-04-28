import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Pagination from '../components/Pagination';
import './DispatchCertificates.css';

const DispatchCertificates = () => {
    const navigate = useNavigate();
    const [theme, setTheme] = useState(sessionStorage.getItem('theme') || 'light');
    const [dispatches, setDispatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedCert, setSelectedCert] = useState(null);
    const [isCollecting, setIsCollecting] = useState(false);
    const [confirmCollectId, setConfirmCollectId] = useState(null);
    const [successMsg, setSuccessMsg] = useState('');
    const [collectError, setCollectError] = useState('');
    const [activeTab, setActiveTab] = useState('dispatches'); // 'dispatches' or 'clearance'
    const [clearances, setClearances] = useState([]);
    const [tabLoading, setTabLoading] = useState(false);
    const [confirmClearanceId, setConfirmClearanceId] = useState(null);
    const [selectedClearanceCert, setSelectedClearanceCert] = useState(null);
    // Pagination state
    const [dispatchPage, setDispatchPage] = useState(1);
    const [dispatchPagination, setDispatchPagination] = useState({ total: 0, page: 1, totalPages: 1 });
    const [clearancePage, setClearancePage] = useState(1);
    const [clearancePagination, setClearancePagination] = useState({ total: 0, page: 1, totalPages: 1 });
    const isDark = theme === 'dark';
    const bgColor = isDark ? '#0f172a' : '#f8fafc';
    const textColor = isDark ? '#f1f5f9' : '#1e293b';
    const cardBgColor = isDark ? '#1e293b' : 'white';
    const navBg = isDark ? '#1e293b' : '#3D1C02';
    const textMuted = isDark ? '#94a3b8' : '#64748b';

    const fetchDispatches = async (page = 1) => {
        const token = sessionStorage.getItem('token');
        if (!token) {
            navigate('/login');
            return;
        }

        try {
            const response = await fetch(`/api/dashboard/dispatches?page=${page}&limit=25`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    sessionStorage.removeItem('token');
                    navigate('/login');
                    return;
                }
                throw new Error('Failed to fetch dispatches');
            }

            const data = await response.json();
            setDispatches(data.dispatches || []);
            if (data.pagination) setDispatchPagination(data.pagination);
            setError(null);
        } catch (err) {
            console.error("Error fetching dispatches", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchClearances = async (page = 1) => {
        setTabLoading(true);
        const token = sessionStorage.getItem('token');
        try {
            const response = await fetch(`/api/dashboard/clearance-ledger?page=${page}&limit=25`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setClearances(data.clearances || data);
                if (data.pagination) setClearancePagination(data.pagination);
            }
        } catch (err) {
            console.error("Error fetching clearance ledger", err);
        } finally {
            setTabLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'dispatches') {
            fetchDispatches(dispatchPage);
        } else {
            fetchClearances(clearancePage);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, dispatchPage, clearancePage]);

    const handleDispatchPageChange = (newPage) => {
        setDispatchPage(newPage);
    };

    const handleClearancePageChange = (newPage) => {
        setClearancePage(newPage);
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
        document.documentElement.classList.toggle('dark', newTheme === 'dark');
    };

    const processCollection = async () => {
        setIsCollecting(true);
        setCollectError('');
        const token = sessionStorage.getItem('token');
        try {
            const response = await fetch(`/api/dashboard/dispatches/${confirmCollectId}/collect`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Failed to process physical handover');
            }

            setConfirmCollectId(null);
            setSuccessMsg('Handover Verification Registered successfully.');
            if (selectedCert) setSelectedCert(null);
            await fetchDispatches(dispatchPage);

        } catch (err) {
            console.error(err);
            setCollectError(err.message);
        } finally {
            setIsCollecting(false);
        }
    };

    const processClearancePickup = async () => {
        setIsCollecting(true);
        setCollectError('');
        const token = sessionStorage.getItem('token');
        try {
            const response = await fetch(`/api/dashboard/clearance/${confirmClearanceId}/collect`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Failed to verify clearance pickup');

            setConfirmClearanceId(null);
            setSuccessMsg('Clearance Pickup Verified Successfully.');
            await fetchClearances(clearancePage);
        } catch (err) {
            setCollectError(err.message);
        } finally {
            setIsCollecting(false);
        }
    };

    const printCertificate = () => {
        window.print();
    };

    return (
        <div className="dc-root" style={{ backgroundColor: bgColor, color: textColor }}>
            <nav className="dc-nav hide-on-print" style={{ backgroundColor: navBg }}>
                <div className="dc-nav-brand">
                    FIROS <span className="dc-nav-brand-sub">NESTLÉ LANKA</span>
                </div>
                <div className="dc-nav-actions">
                    <button onClick={toggleTheme} className="dc-theme-btn">
                        {isDark ? '☀️' : '🌙'}
                    </button>
                    <button onClick={handleLogout} className="dc-logout-btn">Logout</button>
                </div>
            </nav>

            <main className="dc-main hide-on-print">
                <div className="dc-page-header">
                    <div>
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="back-btn dc-back-btn"
                            style={{ color: isDark ? '#60a5fa' : '#2563eb' }}
                        >
                            <span>←</span> Back to Dashboard
                        </button>
                        <h1 className="dc-page-title">Dispatch Certificate Vault</h1>
                        <p className="dc-page-subtitle" style={{ color: textMuted }}>Immutable ledger of all warehouse dispatches and verified FRS handovers.</p>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="dc-tabs" style={{ borderBottom: `2px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
                    <button
                        onClick={() => setActiveTab('dispatches')}
                        className="dc-tab-btn"
                        style={{
                            color: activeTab === 'dispatches' ? (isDark ? '#60a5fa' : '#2563eb') : textMuted,
                            borderBottom: activeTab === 'dispatches' ? `3px solid ${isDark ? '#60a5fa' : '#2563eb'}` : '3px solid transparent'
                        }}
                    >
                        Standard Dispatches
                    </button>
                    <button
                        onClick={() => setActiveTab('clearance')}
                        className="dc-tab-btn"
                        style={{
                            color: activeTab === 'clearance' ? (isDark ? '#60a5fa' : '#2563eb') : textMuted,
                            borderBottom: activeTab === 'clearance' ? `3px solid ${isDark ? '#60a5fa' : '#2563eb'}` : '3px solid transparent'
                        }}
                    >
                        Clearance Ledger
                    </button>
                </div>

                {loading ? (
                    <div className="dc-loading">	Tracking Ledger...</div>
                ) : tabLoading ? (
                    <div className="dc-loading" style={{ color: textMuted }}>Refreshing Ledger...</div>
                ) : error ? (
                    <div className="dc-error">{error}</div>
                ) : dispatches.length === 0 ? (
                    <div className="dc-empty-state" style={{ backgroundColor: cardBgColor, border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
                        <div className="dc-empty-label" style={{ color: textMuted }}>[ NO RECORDS DETECTED ]</div>
                        <h3 className="dc-empty-title">No dispatch ledger found</h3>
                        <p className="dc-empty-body" style={{ color: textMuted }}>Batches processed out of the warehouse will permanently appear here.</p>
                    </div>
                ) : (
                    <div className="dc-table-card" style={{ backgroundColor: cardBgColor, border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
                        <div className="dc-table-scroll">
                            {activeTab === 'dispatches' ? (
                                <>
                                    <table className="dc-table">
                                        <thead>
                                            <tr style={{ backgroundColor: isDark ? '#334155' : '#f8fafc', color: textMuted, borderBottom: `2px solid ${isDark ? '#475569' : '#e2e8f0'}` }}>
                                                <th>Dispatch ID</th>
                                                <th>Batch &amp; Product</th>
                                                <th>Distributor Assigned</th>
                                                <th>Dispatch FRS</th>
                                                <th>Status</th>
                                                <th className="action-column">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {dispatches.map(record => {
                                                const isCollected = !!record.collected_timestamp;
                                                return (
                                                    <tr key={record.dispatch_id} style={{ borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
                                                        <td className="dc-cell-bold">#{record.dispatch_id}</td>
                                                        <td>
                                                            <div className="dc-cell-product-name">{record.product_name}</div>
                                                            <div className="dc-cell-sub" style={{ color: textMuted }}>Batch: {record.batch_id}</div>
                                                        </td>
                                                        <td>
                                                            <div className="dc-cell-bold">{record.distributor_name}</div>
                                                            <div className="dc-cell-sub" style={{ color: textMuted }}>Authorized via System</div>
                                                        </td>
                                                        <td>
                                                            <span className="dc-frs-badge" style={{
                                                                backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                                                                color: record.risk_band_at_dispatch === 'low' ? '#22c55e' : (record.risk_band_at_dispatch === 'medium' ? '#f59e0b' : '#ef4444')
                                                            }}>
                                                                {Number(record.frs_at_dispatch).toFixed(1)}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            {record.status === 'returned' ? (
                                                                <div className="dc-status dc-status--returned">[ RETURNED ]</div>
                                                            ) : isCollected ? (
                                                                <div className="dc-status dc-status--verified">[ VERIFIED ]</div>
                                                            ) : (
                                                                <div className="dc-status dc-status--pending">[ PENDING PICKUP ]</div>
                                                            )}
                                                        </td>
                                                        <td className="action-column">
                                                            <div className="dc-action-group">
                                                                <button
                                                                    onClick={() => setSelectedCert(record)}
                                                                    className="dc-btn-view-cert"
                                                                    style={{ background: isDark ? 'rgba(59,130,246,0.2)' : '#eff6ff' }}
                                                                >
                                                                    View Certificate
                                                                </button>
                                                                {!isCollected && record.status !== 'returned' && (
                                                                    <button
                                                                        onClick={() => setConfirmCollectId(record.dispatch_id)}
                                                                        disabled={isCollecting}
                                                                        className="dc-btn-handover"
                                                                        style={{
                                                                            background: isDark ? '#334155' : '#e2e8f0',
                                                                            color: isDark ? '#f8fafc' : '#1e293b',
                                                                            cursor: isCollecting ? 'wait' : 'pointer'
                                                                        }}
                                                                    >
                                                                        Physical Handover
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                    <Pagination 
                                        currentPage={dispatchPagination.page}
                                        totalPages={dispatchPagination.totalPages}
                                        totalItems={dispatchPagination.total}
                                        onPageChange={handleDispatchPageChange}
                                        isDark={isDark}
                                    />
                                </>
                            ) : (
                                <>
                                    <table className="dc-table">
                                        <thead>
                                            <tr style={{ backgroundColor: isDark ? '#334155' : '#f8fafc', color: textMuted, borderBottom: `2px solid ${isDark ? '#475569' : '#e2e8f0'}` }}>
                                                <th>Clearance ID</th>
                                                <th>Batch &amp; Product</th>
                                                <th>Distributor / Reason</th>
                                                <th>Promo %</th>
                                                <th>Action Date</th>
                                                <th>FRS Score</th>
                                                <th>Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {clearances.length === 0 ? (
                                                <tr>
                                                    <td colSpan="7" style={{ padding: '48px', textAlign: 'center', color: textMuted }}>No clearance records found.</td>
                                                </tr>
                                            ) : clearances.map(record => (
                                                <tr key={record.clearance_id} style={{ borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
                                                    <td className="dc-cell-bold">#{record.clearance_id}</td>
                                                    <td>
                                                        <div className="dc-cell-product-name">{record.product_name}</div>
                                                        <div className="dc-cell-sub" style={{ color: textMuted }}>Batch: {record.batch_id}</div>
                                                    </td>
                                                    <td>
                                                        <div className="dc-cell-bold">{record.distributor_name || (record.reason === 'long in warehouse' ? 'Expired Salvage' : 'Direct Clearance')}</div>
                                                        <div className="dc-cell-sub" style={{ color: textMuted }}>{record.reason} {!!record.collected_timestamp && <span className="dc-picked-up-badge">[ PICKED UP ]</span>}</div>
                                                    </td>
                                                    <td><div style={{ fontWeight: 'bold', color: '#3b82f6' }}>{record.discount_applied ? `${record.discount_applied}%` : 'VAR'}</div></td>
                                                    <td>
                                                        <div>{new Date(record.cleared_at).toLocaleDateString()}</div>
                                                        <div className="dc-cell-sub" style={{ color: textMuted }}>Approved by {record.approved_by_name}</div>
                                                    </td>
                                                    <td>
                                                        <span className="dc-frs-badge" style={{
                                                            backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                                                            color: record.frs_score >= 80 ? '#22c55e' : (record.frs_score >= 60 ? '#f59e0b' : '#ef4444')
                                                        }}>
                                                            {record.frs_score !== null && record.frs_score !== undefined ? Number(record.frs_score).toFixed(1) : 'REC.'}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <div className="dc-action-group--clr">
                                                            <button
                                                                onClick={() => setSelectedClearanceCert(record)}
                                                                className="dc-btn-view-clr-cert"
                                                            >
                                                                View Certificate
                                                            </button>
                                                            {!record.collected_timestamp ? (
                                                            <button
                                                                onClick={() => setConfirmClearanceId(record.clearance_id)}
                                                                disabled={isCollecting}
                                                                className="dc-btn-verify-pickup"
                                                                style={{
                                                                    background: isDark ? '#334155' : '#e2e8f0',
                                                                    color: isDark ? '#f8fafc' : '#1e293b',
                                                                    cursor: isCollecting ? 'wait' : 'pointer'
                                                                }}
                                                            >
                                                                Verify Pickup
                                                            </button>
                                                        ) : (
                                                            <span className="dc-handover-complete">Handover Complete</span>
                                                        )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    <Pagination 
                                        currentPage={clearancePagination.page}
                                        totalPages={clearancePagination.totalPages}
                                        totalItems={clearancePagination.total}
                                        onPageChange={handleClearancePageChange}
                                        isDark={isDark}
                                    />
                                </>
                            )}
                        </div>
                    </div>
                )}
            </main>

            {/* Certificate Modal Overlay */}
            {selectedCert && (
                <div className="print-backdrop dc-modal-backdrop">
                    <div className="cert-modal-content dc-modal-box">
                        <div className="dc-modal-header">
                            <div>
                                <h2 className="dc-modal-header-title">Certified Dispatch Record</h2>
                                <div className="dc-modal-header-sub">Nestlé FIROS Standard Protocol</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div className="dc-modal-header-id">#{selectedCert.dispatch_id.toString().padStart(6, '0')}</div>
                                <div className="dc-modal-header-gen">System Generated</div>
                            </div>
                        </div>

                        <div className="dc-modal-body">
                            <div className="dc-modal-info-grid">
                                <div>
                                    <div className="dc-modal-label">Distributor Assigned</div>
                                    <div className="dc-modal-value">{selectedCert.distributor_name}</div>
                                </div>
                                <div>
                                    <div className="dc-modal-label">Warehouse Output Zone</div>
                                    <div className="dc-modal-value">Zone {selectedCert.zone_at_dispatch}</div>
                                    <div className="dc-modal-value-sub">Release authorized by: {selectedCert.approved_by_name}</div>
                                </div>
                            </div>

                            <div className="dc-commodity-grid">
                                <div>
                                    <div className="dc-commodity-label">Commodity Handover</div>
                                    <div className="dc-commodity-table">
                                        {[['Product Name:', selectedCert.product_name], ['Batch Serial:', selectedCert.batch_id], ['Quantity:', `${selectedCert.quantity} units`], ['Expiry Valid Until:', new Date(selectedCert.expiry_date).toLocaleDateString()]].map(([k, v]) => (
                                            <div key={k} className="dc-commodity-row">
                                                <span className="dc-commodity-row-key">{k}</span>
                                                <span className="dc-commodity-row-val">{v}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <div className="dc-commodity-label">Frozen FRS Handover</div>
                                    <div className="dc-frs-box" style={{
                                        backgroundColor: selectedCert.risk_band_at_dispatch === 'low' ? '#f0fdf4' : (selectedCert.risk_band_at_dispatch === 'medium' ? '#fffbeb' : '#fef2f2'),
                                        border: `1px solid ${selectedCert.risk_band_at_dispatch === 'low' ? '#bbf7d0' : (selectedCert.risk_band_at_dispatch === 'medium' ? '#fde68a' : '#fecaca')}`
                                    }}>
                                        <div className="dc-frs-score" style={{ color: selectedCert.risk_band_at_dispatch === 'low' ? '#16a34a' : (selectedCert.risk_band_at_dispatch === 'medium' ? '#d97706' : '#dc2626') }}>
                                            {Number(selectedCert.frs_at_dispatch).toFixed(1)}
                                        </div>
                                        <div className="dc-frs-label">SCORE / 100</div>
                                    </div>
                                </div>
                            </div>

                            <div className="dc-compliance-note">
                                <strong>Compliance Verification Protocol:</strong><br />
                                This timestamped certificate serves as verified documentation that the identified batch was released from the facility while maintaining the recorded Freshness Score. Distributor quality claims regarding this shipment will be validated against this official ledger. This record is immutable and permanently secured within the centralized distribution database.
                            </div>

                            <div className="dc-modal-footer-timestamps">
                                <div>
                                    <div className="dc-timestamp-approved">System Authorized Release</div>
                                    <div className="dc-timestamp-date">{new Date(selectedCert.dispatch_timestamp).toLocaleString()}</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    {selectedCert.collected_timestamp ? (
                                        <>
                                            <div className="dc-verified-stamp">[ VERIFIED PHYSICAL HANDOVER ]</div>
                                            <div className="dc-stamp-sub">{new Date(selectedCert.collected_timestamp).toLocaleString()}</div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="dc-pending-stamp">[ PENDING TRANSPORT TRUCK ]</div>
                                            <div className="dc-stamp-sub">Awaiting terminal scan verification...</div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="dc-modal-action-footer hide-on-print">
                            <button onClick={() => setSelectedCert(null)} className="dc-btn-close-modal">Close</button>
                            <button onClick={printCertificate} className="dc-btn-export">
                                <span className="dc-btn-export-label">[ EXPORT DOCUMENT ]</span> Save as PDF
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== Clearance Certificate Modal ===== */}
            {selectedClearanceCert && (() => {
                const rec = selectedClearanceCert;
                const riskColor = rec.frs_score >= 80 ? '#16a34a' : (rec.frs_score >= 60 ? '#d97706' : '#dc2626');
                const riskBg   = rec.frs_score >= 80 ? '#f0fdf4' : (rec.frs_score >= 60 ? '#fffbeb' : '#fef2f2');
                const riskBorder = rec.frs_score >= 80 ? '#bbf7d0' : (rec.frs_score >= 60 ? '#fde68a' : '#fecaca');
                return (
                    <div className="print-backdrop dc-clr-modal-backdrop">
                        <div className="cert-modal-content dc-clr-modal-box">
                            <div className="dc-clr-header">
                                <div>
                                    <div className="dc-clr-header-eyebrow">Clearance Dispatch Certificate</div>
                                    <h2 className="dc-clr-header-title">Promotional Clearance Release</h2>
                                    <div className="dc-clr-header-sub">Nestlé FIROS Clearance Protocol · Risk-Adjusted Dispatch</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div className="dc-clr-header-id">CLR-{rec.clearance_id.toString().padStart(6, '0')}</div>
                                    <div className="dc-clr-header-gen">System Generated</div>
                                </div>
                            </div>

                            <div className="dc-clr-reason-banner">
                                <span className="dc-clr-reason-icon">⚠️</span>
                                <div>
                                    <span className="dc-clr-reason-label">Clearance Trigger: </span>
                                    <span className="dc-clr-reason-value">{rec.reason}</span>
                                </div>
                            </div>

                            <div className="dc-clr-body">
                                <div className="dc-clr-top-grid">
                                    <div>
                                        <div className="dc-clr-label">Assigned Distributor</div>
                                        <div className="dc-clr-value-lg">{rec.distributor_name || 'Direct Clearance'}</div>
                                        <div className="dc-clr-value-sub">Release authorized by: {rec.approved_by_name}</div>
                                    </div>
                                    <div>
                                        <div className="dc-clr-label">Promotional Discount Applied</div>
                                        <div className="dc-clr-promo-row">
                                            <div className="dc-clr-promo-pct">{rec.discount_applied ? `${rec.discount_applied}%` : 'VAR'}</div>
                                            <div className="dc-clr-promo-off">OFF RRP</div>
                                        </div>
                                        <div className="dc-clr-promo-note">
                                            {rec.discount_applied
                                                ? `Clearance price reduction: ${rec.discount_applied}% below retail price`
                                                : 'Variable promotional pricing — see distributor agreement'}
                                        </div>
                                    </div>
                                </div>

                                <div className="dc-clr-mid-grid">
                                    <div>
                                        <div className="dc-clr-commodity-label">Commodity Details</div>
                                        <div className="dc-clr-commodity-table">
                                            {[
                                                ['Product', rec.product_name],
                                                ['Batch Serial', rec.batch_id],
                                                ['Pack Size', rec.pack_size || '—'],
                                                ['Quantity', `${rec.quantity ?? '—'} units`],
                                                ['Expiry Date', rec.expiry_date ? new Date(rec.expiry_date).toLocaleDateString() : '—'],
                                                ['Storage Zone', rec.zone ? `Zone ${rec.zone}` : '—'],
                                            ].map(([label, val]) => (
                                                <div key={label} className="dc-clr-commodity-row">
                                                    <span className="dc-clr-row-key">{label}:</span>
                                                    <span className="dc-clr-row-val">{val}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="dc-clr-frs-label">Frozen FRS Score</div>
                                        <div className="dc-clr-frs-box" style={{ backgroundColor: riskBg, border: `1px solid ${riskBorder}` }}>
                                            <div className="dc-clr-frs-score" style={{ color: riskColor }}>
                                                {rec.frs_score !== null && rec.frs_score !== undefined ? Number(rec.frs_score).toFixed(1) : '—'}
                                            </div>
                                            <div className="dc-clr-frs-sublabel">SCORE / 100</div>
                                            <div className="dc-clr-frs-band" style={{ color: riskColor }}>
                                                {rec.frs_score >= 80 ? 'Low Risk' : rec.frs_score >= 60 ? 'Medium Risk' : 'High Risk'}
                                            </div>
                                            <div className="dc-clr-frs-note">Score locked at clearance approval time</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="dc-clr-compliance-note">
                                    <strong>Clearance Compliance Protocol:</strong><br />
                                    This certificate documents that the identified high-risk or clearance-flagged batch was released under a manager-authorized promotional pricing event. The Freshness Risk Score (FRS) recorded above represents the batch condition at the moment of clearance approval and is permanently frozen for audit and dispute resolution purposes. Any future distributor quality complaints against this batch will be evaluated against this official locked score. This record is immutable within the FIROS ledger.
                                </div>

                                <div className="dc-clr-footer-timestamps">
                                    <div>
                                        <div className="dc-clr-ts-approved">Clearance Approved</div>
                                        <div className="dc-clr-ts-date">{new Date(rec.cleared_at).toLocaleString()}</div>
                                        <div className="dc-clr-ts-by">By: {rec.approved_by_name}</div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        {rec.collected_timestamp ? (
                                            <>
                                                <div className="dc-verified-stamp">[ VERIFIED PHYSICAL HANDOVER ]</div>
                                                <div className="dc-stamp-sub">{new Date(rec.collected_timestamp).toLocaleString()}</div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="dc-pending-stamp">[ PENDING DISTRIBUTORS TRUCK ]</div>
                                                <div className="dc-stamp-sub">Awaiting terminal scan verification...</div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="dc-clr-action-footer hide-on-print">
                                <button onClick={() => setSelectedClearanceCert(null)} className="dc-clr-btn-close">Close</button>
                                <button onClick={printCertificate} className="dc-clr-btn-export">
                                    <span className="dc-clr-btn-export-label">[ EXPORT DOCUMENT ]</span> Save as PDF
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Native Alert Overlays */}
            {confirmCollectId && (
                <div className="dc-confirm-backdrop">
                    <div className="dc-confirm-box" style={{ backgroundColor: cardBgColor, border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
                        <h3 className="dc-confirm-title">Authorize Handover</h3>
                        <p className="dc-confirm-body" style={{ color: textMuted }}>
                            You are verifying that the distributor has physically picked up this batch. This action will be permanently recorded in the immutable ledger and cannot be undone.
                        </p>
                        {collectError && <div className="dc-confirm-error">{collectError}</div>}
                        <div className="dc-confirm-actions">
                            <button
                                onClick={() => { setConfirmCollectId(null); setCollectError(''); }}
                                className="dc-btn-cancel"
                                style={{ border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`, color: textColor }}
                            >Cancel</button>
                            <button
                                onClick={processCollection}
                                disabled={isCollecting}
                                className="dc-btn-confirm-green"
                                style={{ cursor: isCollecting ? 'wait' : 'pointer', opacity: isCollecting ? 0.7 : 1 }}
                            >{isCollecting ? 'Verifying...' : 'Confirm Registration'}</button>
                        </div>
                    </div>
                </div>
            )}
            {confirmClearanceId && (
                <div className="dc-clr-confirm-backdrop">
                    <div className="dc-clr-confirm-box" style={{ backgroundColor: cardBgColor }}>
                        <h3 className="dc-confirm-title" style={{ color: textColor }}>Verify Clearance Handover</h3>
                        <p className="dc-confirm-body" style={{ color: textMuted }}>
                            You are confirming the physical exit of this clearance batch from the facility. This action is immutable and will finalize the audit trail.
                        </p>
                        {collectError && <div className="dc-confirm-error">{collectError}</div>}
                        <div className="dc-confirm-actions">
                            <button
                                onClick={() => { setConfirmClearanceId(null); setCollectError(''); }}
                                className="dc-btn-cancel"
                                style={{ border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`, color: textColor }}
                            >Cancel</button>
                            <button
                                onClick={processClearancePickup}
                                disabled={isCollecting}
                                className="dc-btn-confirm-blue"
                                style={{ cursor: isCollecting ? 'wait' : 'pointer', opacity: isCollecting ? 0.7 : 1 }}
                            >{isCollecting ? 'Verifying...' : 'Verify Physical Exit'}</button>
                        </div>
                    </div>
                </div>
            )}

            {successMsg && (
                <div className="dc-success-backdrop">
                    <div className="dc-success-box" style={{ backgroundColor: cardBgColor, border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
                        <div className="dc-success-icon-ring">
                            <div className="dc-success-checkmark" />
                        </div>
                        <h3 className="dc-success-title">Log Updated</h3>
                        <p className="dc-success-msg" style={{ color: textMuted }}>{successMsg}</p>
                        <button
                            onClick={() => setSuccessMsg('')}
                            className="dc-btn-success-close"
                            style={{ backgroundColor: isDark ? '#334155' : '#e2e8f0', color: textColor }}
                        >Close</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DispatchCertificates;
