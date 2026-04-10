import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

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
    const isDark = theme === 'dark';
    const bgColor = isDark ? '#0f172a' : '#f8fafc';
    const textColor = isDark ? '#f1f5f9' : '#1e293b';
    const cardBgColor = isDark ? '#1e293b' : 'white';
    const navBg = isDark ? '#1e293b' : '#3D1C02';
    const textMuted = isDark ? '#94a3b8' : '#64748b';

    const fetchDispatches = async () => {
        const token = sessionStorage.getItem('token');
        if (!token) {
            navigate('/login');
            return;
        }

        try {
            const response = await fetch('/api/dashboard/dispatches', {
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
            setDispatches(data);
            setError(null);
        } catch (err) {
            console.error("Error fetching dispatches", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDispatches();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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
            await fetchDispatches();

        } catch (err) {
            console.error(err);
            setCollectError(err.message);
        } finally {
            setIsCollecting(false);
        }
    };

    const printCertificate = () => {
        window.print();
    };

    return (
        <div style={{ minHeight: '100vh', backgroundColor: bgColor, color: textColor, fontFamily: 'inherit' }}>
            <style>{`
                @media print {
                    nav, .back-btn, .action-column, .hide-on-print { display: none !important; }
                    .cert-modal-content { 
                        box-shadow: none !important; 
                        border: 2px solid #ccc !important;
                        position: relative !important;
                        top: 0 !important;
                        left: 0 !important;
                        transform: none !important;
                        width: 100% !important;
                        max-width: none !important;
                    }
                    .print-backdrop {
                        position: static !important;
                        background: white !important;
                        color: black !important;
                        padding: 0 !important;
                    }
                }
            `}</style>
            
            <nav className="hide-on-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', backgroundColor: navBg, color: 'white' }}>
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

            <main className="hide-on-print" style={{ padding: '32px 48px', maxWidth: '1400px', margin: '0 auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '32px' }}>
                    <div>
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="back-btn"
                            style={{ background: 'transparent', border: 'none', color: isDark ? '#60a5fa' : '#2563eb', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', padding: 0 }}
                        >
                            <span>←</span> Back to Dashboard
                        </button>
                        <h1 style={{ margin: '0 0 8px 0', fontSize: '32px' }}>Dispatch Certificate Vault</h1>
                        <p style={{ margin: 0, color: textMuted }}>Immutable ledger of all warehouse dispatches and verified FRS handovers.</p>
                    </div>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '64px', fontWeight: 'bold', fontSize: '18px' }}>Tracking Ledger...</div>
                ) : error ? (
                    <div style={{ textAlign: 'center', padding: '64px', color: '#ef4444' }}>{error}</div>
                ) : dispatches.length === 0 ? (
                    <div style={{ backgroundColor: cardBgColor, padding: '48px', borderRadius: '12px', textAlign: 'center', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
                        <div style={{ fontSize: '14px', fontWeight: 'bold', color: textMuted, letterSpacing: '1px', marginBottom: '16px' }}>[ NO RECORDS DETECTED ]</div>
                        <h3 style={{ margin: '0 0 8px 0' }}>No dispatch ledger found</h3>
                        <p style={{ color: textMuted, margin: 0 }}>Batches processed out of the warehouse will permanently appear here.</p>
                    </div>
                ) : (
                    <div style={{ backgroundColor: cardBgColor, borderRadius: '12px', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, overflow: 'hidden' }}>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ backgroundColor: isDark ? '#334155' : '#f8fafc', color: textMuted, fontSize: '14px', borderBottom: `2px solid ${isDark ? '#475569' : '#e2e8f0'}` }}>
                                        <th style={{ padding: '16px 24px', fontWeight: 'bold' }}>Dispatch ID</th>
                                        <th style={{ padding: '16px 24px', fontWeight: 'bold' }}>Batch & Product</th>
                                        <th style={{ padding: '16px 24px', fontWeight: 'bold' }}>Distributor Assigned</th>
                                        <th style={{ padding: '16px 24px', fontWeight: 'bold' }}>Dispatch FRS</th>
                                        <th style={{ padding: '16px 24px', fontWeight: 'bold' }}>Status</th>
                                        <th style={{ padding: '16px 24px', fontWeight: 'bold' }} className="action-column">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {dispatches.map(record => {
                                        const isCollected = !!record.collected_timestamp;
                                        
                                        return (
                                            <tr key={record.dispatch_id} style={{ borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
                                                <td style={{ padding: '16px 24px', fontWeight: 'bold' }}>#{record.dispatch_id}</td>
                                                <td style={{ padding: '16px 24px' }}>
                                                    <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{record.product_name}</div>
                                                    <div style={{ fontSize: '13px', color: textMuted }}>Batch: {record.batch_id}</div>
                                                </td>
                                                <td style={{ padding: '16px 24px' }}>
                                                    <div style={{ fontWeight: 'bold' }}>{record.distributor_name}</div>
                                                    <div style={{ fontSize: '13px', color: textMuted }}>Authorized via System</div>
                                                </td>
                                                <td style={{ padding: '16px 24px' }}>
                                                    <span style={{ 
                                                        backgroundColor: isDark ? '#1e293b' : '#f1f5f9', 
                                                        padding: '6px 12px', 
                                                        borderRadius: '6px', 
                                                        color: record.risk_band_at_dispatch === 'low' ? '#22c55e' : (record.risk_band_at_dispatch === 'medium' ? '#f59e0b' : '#ef4444'),
                                                        fontWeight: 'bold'
                                                    }}>
                                                        {Number(record.frs_at_dispatch).toFixed(1)}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '16px 24px' }}>
                                                    {isCollected ? (
                                                        <div style={{ color: '#16a34a', fontSize: '13px', fontWeight: 'bold' }}>
                                                            [ VERIFIED ]
                                                        </div>
                                                    ) : (
                                                        <div style={{ color: '#d97706', fontSize: '13px', fontWeight: 'bold' }}>
                                                            [ PENDING PICKUP ]
                                                        </div>
                                                    )}
                                                </td>
                                                <td style={{ padding: '16px 24px' }} className="action-column">
                                                    <div style={{ display: 'flex', gap: '12px' }}>
                                                        <button 
                                                            onClick={() => setSelectedCert(record)}
                                                            style={{ 
                                                                background: isDark ? 'rgba(59, 130, 246, 0.2)' : '#eff6ff', 
                                                                color: '#3b82f6', 
                                                                border: 'none', 
                                                                padding: '8px 16px', 
                                                                borderRadius: '6px', 
                                                                fontWeight: 'bold', 
                                                                cursor: 'pointer' 
                                                            }}
                                                        >
                                                            View Certificate
                                                        </button>
                                                        {!isCollected && (
                                                            <button 
                                                                onClick={() => setConfirmCollectId(record.dispatch_id)}
                                                                disabled={isCollecting}
                                                                style={{ 
                                                                    background: isDark ? '#334155' : '#e2e8f0', 
                                                                    color: isDark ? '#f8fafc' : '#1e293b', 
                                                                    border: 'none', 
                                                                    padding: '8px 16px', 
                                                                    borderRadius: '6px', 
                                                                    fontWeight: 'bold', 
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
                        </div>
                    </div>
                )}
            </main>

            {/* Certificate Modal Overlay */}
            {selectedCert && (
                <div className="print-backdrop" style={{ 
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
                    backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '24px', overflowY: 'auto'
                }}>
                    <div className="cert-modal-content" style={{ 
                        backgroundColor: '#ffffff', color: '#1e293b', width: '100%', maxWidth: '800px', 
                        borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
                        position: 'relative'
                    }}>
                        {/* Certificate Header Banner */}
                        <div style={{ backgroundColor: '#0f172a', padding: '32px 40px', color: 'white', borderTopLeftRadius: '16px', borderTopRightRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h2 style={{ margin: '0 0 8px 0', fontSize: '28px', color: '#C8A96E', letterSpacing: '1px', textTransform: 'uppercase' }}>Certified Dispatch Record</h2>
                                <div style={{ fontSize: '14px', color: '#94a3b8' }}>Nestlé FIROS Standard Protocol</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontWeight: 'bold', fontSize: '24px' }}>#{selectedCert.dispatch_id.toString().padStart(6, '0')}</div>
                                <div style={{ fontSize: '13px', color: '#94a3b8', fontStyle: 'italic' }}>System Generated</div>
                            </div>
                        </div>

                        {/* Certificate Body */}
                        <div style={{ padding: '40px' }}>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '32px', borderBottom: '1px solid #e2e8f0', paddingBottom: '32px', marginBottom: '32px' }}>
                                <div>
                                    <div style={{ fontSize: '12px', textTransform: 'uppercase', color: '#64748b', fontWeight: 'bold', marginBottom: '4px' }}>Distributor Assigned</div>
                                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a' }}>{selectedCert.distributor_name}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '12px', textTransform: 'uppercase', color: '#64748b', fontWeight: 'bold', marginBottom: '4px' }}>Warehouse Output Zone</div>
                                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a' }}>Zone {selectedCert.zone_at_dispatch}</div>
                                    <div style={{ fontSize: '13px', color: '#64748b' }}>Release authorized by: {selectedCert.approved_by_name}</div>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '32px', marginBottom: '32px' }}>
                                <div>
                                    <div style={{ fontSize: '12px', textTransform: 'uppercase', color: '#64748b', fontWeight: 'bold', marginBottom: '8px' }}>Commodity Handover</div>
                                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                                            <span style={{ color: '#64748b' }}>Product Name:</span>
                                            <span style={{ fontWeight: 'bold' }}>{selectedCert.product_name}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                                            <span style={{ color: '#64748b' }}>Batch Serial:</span>
                                            <span style={{ fontWeight: 'bold' }}>{selectedCert.batch_id}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                                            <span style={{ color: '#64748b' }}>Quantity:</span>
                                            <span style={{ fontWeight: 'bold' }}>{selectedCert.quantity} units</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: '#64748b' }}>Expiry Valid Until:</span>
                                            <span style={{ fontWeight: 'bold' }}>{new Date(selectedCert.expiry_date).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <div style={{ fontSize: '12px', textTransform: 'uppercase', color: '#64748b', fontWeight: 'bold', marginBottom: '8px' }}>Frozen FRS Handover</div>
                                    <div style={{ 
                                        backgroundColor: selectedCert.risk_band_at_dispatch === 'low' ? '#f0fdf4' : (selectedCert.risk_band_at_dispatch === 'medium' ? '#fffbeb' : '#fef2f2'), 
                                        border: `1px solid ${selectedCert.risk_band_at_dispatch === 'low' ? '#bbf7d0' : (selectedCert.risk_band_at_dispatch === 'medium' ? '#fde68a' : '#fecaca')}`,
                                        borderRadius: '8px', 
                                        padding: '24px 16px',
                                        textAlign: 'center',
                                        height: 'calc(100% - 22px)'
                                    }}>
                                        <div style={{ fontSize: '36px', fontWeight: 'bold', color: selectedCert.risk_band_at_dispatch === 'low' ? '#16a34a' : (selectedCert.risk_band_at_dispatch === 'medium' ? '#d97706' : '#dc2626'), lineHeight: '1' }}>
                                            {Number(selectedCert.frs_at_dispatch).toFixed(1)}
                                        </div>
                                        <div style={{ fontSize: '13px', fontWeight: 'bold', marginTop: '8px', color: '#64748b' }}>SCORE / 100</div>
                                    </div>
                                </div>
                            </div>

                            <div style={{ backgroundColor: '#f8fafc', padding: '24px', borderRadius: '8px', fontSize: '13px', color: '#64748b', lineHeight: '1.6', marginBottom: '32px' }}>
                                <strong>Compliance Verification Protocol:</strong><br />
                                This timestamped certificate serves as verified documentation that the identified batch was released from the facility while maintaining the recorded Freshness Score. Distributor quality claims regarding this shipment will be validated against this official ledger. This record is immutable and permanently secured within the centralized distribution database.
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderTop: '2px dashed #e2e8f0', paddingTop: '32px' }}>
                                <div>
                                    <div style={{ color: '#0f172a', fontWeight: 'bold' }}>System Authorized Release</div>
                                    <div style={{ color: '#64748b', fontSize: '14px' }}>{new Date(selectedCert.dispatch_timestamp).toLocaleString()}</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    {selectedCert.collected_timestamp ? (
                                        <>
                                            <div style={{ color: '#16a34a', fontWeight: 'bold' }}>[ VERIFIED PHYSICAL HANDOVER ]</div>
                                            <div style={{ color: '#64748b', fontSize: '14px' }}>{new Date(selectedCert.collected_timestamp).toLocaleString()}</div>
                                        </>
                                    ) : (
                                        <>
                                            <div style={{ color: '#d97706', fontWeight: 'bold' }}>[ PENDING TRANSPORT TRUCK ]</div>
                                            <div style={{ color: '#64748b', fontSize: '14px' }}>Awaiting terminal scan verification...</div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Modal Action Footer (Hidden on Print) */}
                        <div className="hide-on-print" style={{ backgroundColor: '#f8fafc', padding: '16px 40px', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px', display: 'flex', justifyContent: 'flex-end', gap: '16px', borderTop: '1px solid #e2e8f0' }}>
                            <button 
                                onClick={() => setSelectedCert(null)}
                                style={{ background: 'transparent', border: '1px solid #cbd5e1', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', color: '#334155' }}
                            >
                                Close
                            </button>
                            <button 
                                onClick={printCertificate}
                                style={{ background: '#0f172a', border: 'none', color: 'white', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                            >
                                <span style={{ fontSize: '12px' }}>[ EXPORT DOCUMENT ]</span> Save as PDF
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Native Alert Overlays */}
            {confirmCollectId && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ backgroundColor: cardBgColor, padding: '32px', borderRadius: '12px', width: '100%', maxWidth: '400px', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
                        <h3 style={{ margin: '0 0 16px 0', fontSize: '20px' }}>Authorize Handover</h3>
                        <p style={{ color: textMuted, marginBottom: '24px', fontSize: '14px', lineHeight: '1.5' }}>
                            You are verifying that the distributor has physically picked up this batch. This action will be permanently recorded in the immutable ledger and cannot be undone.
                        </p>
                        
                        {collectError && (
                            <div style={{ padding: '12px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '6px', marginBottom: '24px', fontSize: '13px' }}>
                                {collectError}
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button 
                                onClick={() => { setConfirmCollectId(null); setCollectError(''); }}
                                style={{ padding: '10px 16px', borderRadius: '6px', border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`, backgroundColor: 'transparent', color: textColor, fontWeight: 'bold', cursor: 'pointer' }}
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={processCollection}
                                disabled={isCollecting}
                                style={{ padding: '10px 16px', borderRadius: '6px', border: 'none', backgroundColor: '#10b981', color: 'white', fontWeight: 'bold', cursor: isCollecting ? 'wait' : 'pointer', opacity: isCollecting ? 0.7 : 1 }}
                            >
                                {isCollecting ? 'Verifying...' : 'Confirm Registration'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {successMsg && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ backgroundColor: cardBgColor, padding: '32px', borderRadius: '12px', width: '100%', maxWidth: '400px', textAlign: 'center', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
                        <div style={{ width: '48px', height: '48px', margin: '0 auto 16px', borderRadius: '50%', border: '3px solid #10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ width: '12px', height: '20px', borderBottom: '3px solid #10b981', borderRight: '3px solid #10b981', transform: 'rotate(45deg)', marginTop: '-6px' }} />
                        </div>
                        <h3 style={{ margin: '0 0 12px 0', fontSize: '20px' }}>Log Updated</h3>
                        <p style={{ color: textMuted, marginBottom: '24px', fontSize: '14px' }}>{successMsg}</p>
                        <button 
                            onClick={() => setSuccessMsg('')}
                            style={{ padding: '12px 24px', borderRadius: '8px', border: 'none', backgroundColor: isDark ? '#334155' : '#e2e8f0', color: textColor, fontWeight: 'bold', cursor: 'pointer', width: '100%' }}
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DispatchCertificates;
