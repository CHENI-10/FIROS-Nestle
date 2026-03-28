import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './BatchDetail.css';

const BatchDetail = () => {
    const { batchId } = useParams();
    const navigate = useNavigate();
    const [theme] = useState(sessionStorage.getItem('theme') || 'light');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [data, setData] = useState(null);

    useEffect(() => {
        const fetchBatchDetails = async () => {
            const token = sessionStorage.getItem('token');
            if (!token) {
                navigate('/login');
                return;
            }

            try {
                const response = await fetch(`http://localhost:5000/api/dashboard/batches/${batchId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!response.ok) {
                    if (response.status === 401 || response.status === 403) {
                        sessionStorage.removeItem('token');
                        navigate('/login');
                        return;
                    }
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || `Server Error (${response.status})`);
                }

                const result = await response.json();
                setData(result);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchBatchDetails();
    }, [batchId, navigate]);

    if (loading) {
        return (
            <div className={`batch-detail-container ${theme} flex-center fullscreen`}>
                <div className="spinner"></div>
                <h2 style={{marginTop: '20px'}}>Loading Batch Details...</h2>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className={`batch-detail-container ${theme} flex-center fullscreen`}>
                <div className="error-card">
                    <h2>Error</h2>
                    <p>{error || "Batch details unavailable"}</p>
                    <button onClick={() => navigate('/dashboard')} className="btn-primary">Back to Dashboard</button>
                </div>
            </div>
        );
    }

    const { batch, logs } = data;

    const getRiskColor = (risk) => {
        if (risk === 'low') return '#22c55e';
        if (risk === 'medium') return '#f59e0b';
        if (risk === 'high') return '#ef4444';
        return '#64748b';
    };

    const getZoneName = (zoneId) => {
        const map = { 1: 'Beverages & Noodles', 2: 'Dairy & Condensed', 3: 'Infant & Nutrition', 4: 'Cold Storage' };
        // Handle both '1' and 'A' formats
        const letterMap = { 'A': 'Beverages & Noodles', 'B': 'Dairy & Condensed', 'C': 'Infant & Nutrition', 'D': 'Cold Storage' };
        return map[zoneId] || letterMap[zoneId] || `Zone ${zoneId}`;
    };

    return (
        <div className={`batch-detail-container ${theme}`}>
            <nav style={{ 
                padding: '12px 32px', 
                backgroundColor: theme === 'dark' ? '#1a1a1a' : '#4d2600', 
                color: 'white',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                position: 'sticky',
                top: 0,
                zIndex: 100
            }}>
                <div className="nav-logo">FIROS <span style={{ color: '#C8A96E', marginLeft: '6px' }}>NESTLÉ</span></div>
                <button onClick={() => navigate('/dashboard')} className="close-btn">
                    Close Details
                </button>
            </nav>

            <main className="detail-main">
                <div className="detail-header">
                    <div className="header-left">
                        <span className="batch-tag">BATCH ID: {batch.batch_id}</span>
                        <h1>{batch.product_name}</h1>
                        <p style={{ color: '#94a3b8', margin: 0, fontWeight: 600 }}>Pack Size: {batch.pack_size}</p>
                    </div>
                    <div className="detail-card frs-hero-card" style={{ minWidth: '220px' }}>
                        <div className="frs-big-value">{Number(batch.frs_score).toFixed(0)}</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 800, letterSpacing: '2px', opacity: 0.8, marginBottom: '20px' }}>FRESHNESS SCORE</div>
                        <span className="risk-badge-large" style={{ backgroundColor: getRiskColor(batch.risk_band) }}>
                            {batch.risk_band} Risk
                        </span>
                    </div>
                </div>

                <div className="detail-grid">
                    <div className="detail-card">
                        <h3 className="section-h">📦 Inventory Breakdown</h3>
                        <div className="info-grid">
                            <div className="info-item">
                                <label>Warehouse Zone</label>
                                <span>{getZoneName(batch.zone_id)}</span>
                            </div>
                            <div className="info-item">
                                <label>Storage Environment</label>
                                <span>Zone {batch.zone_id} Status: Optimal</span>
                            </div>
                            <div className="info-item">
                                <label>Current Quantity</label>
                                <span>{batch.quantity.toLocaleString()} Units</span>
                            </div>
                            <div className="info-item">
                                <label>Days in Warehouse</label>
                                <span>{batch.days_in_warehouse} Days</span>
                            </div>
                            <div className="info-item">
                                <label>Manufacturing Date</label>
                                <span>{new Date(batch.manufacturing_date).toLocaleDateString()}</span>
                            </div>
                            <div className="info-item">
                                <label>Expiry Date</label>
                                <span style={{ color: getRiskColor(batch.risk_band) }}>{new Date(batch.expiry_date).toLocaleDateString()}</span>
                            </div>
                        </div>
                    </div>

                    <div className="detail-card">
                        <h3 className="section-h">📏 Quality Analytics</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div className="analytic-row">
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <span style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: 700 }}>SHELF LIFE REMAINING</span>
                                    <span style={{ fontWeight: 800 }}>{Number(batch.slr_percent_raw).toFixed(1)}%</span>
                                </div>
                                <div style={{ width: '100%', height: '8px', background: 'rgba(0,0,0,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                                    <div style={{ width: `${batch.slr_percent_raw}%`, height: '100%', background: getRiskColor(batch.risk_band), transition: 'width 1s ease' }}></div>
                                </div>
                            </div>
                            
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', background: 'rgba(0,0,0,0.02)', borderRadius: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8', fontWeight: 800 }}>TEMP BREACHES</label>
                                    <strong style={{ fontSize: '1.2rem', color: batch.total_temp_breach_windows > 0 ? '#ef4444' : 'inherit' }}>{batch.total_temp_breach_windows}</strong>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <label style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8', fontWeight: 800 }}>HUMIDITY BREACHES</label>
                                    <strong style={{ fontSize: '1.2rem', color: batch.total_humidity_breach_windows > 0 ? '#ef4444' : 'inherit' }}>{batch.total_humidity_breach_windows}</strong>
                                </div>
                            </div>

                            <div style={{ 
                                padding: '16px', 
                                background: 'rgba(200,169,110,0.1)', 
                                border: '1px solid rgba(200,169,110,0.2)',
                                borderRadius: '16px', 
                                fontSize: '0.85rem',
                                color: '#854d0e',
                                fontWeight: 500,
                                lineHeight: '1.5'
                            }}>
                                <strong>System Note:</strong> Freshness Score (FRS) is calculated using weighted environmental penalties (Temp: {batch.temp_sensitivity_label}, Humid: {batch.humidity_sensitivity_label}).
                            </div>
                        </div>
                    </div>
                </div>

                <div className="logs-section">
                    <h3 className="section-h">📉 Historical Logs (Zone {batch.zone_id})</h3>
                    <div className="logs-table-wrapper">
                        <table className="logs-table">
                            <thead>
                                <tr>
                                    <th>Timestamp</th>
                                    <th>Temperature (°C)</th>
                                    <th>Humidity (%)</th>
                                    <th>Condition Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.length === 0 && (
                                    <tr><td colSpan="4" style={{ textAlign: 'center', padding: '48px', color: '#94a3b8', fontWeight: 600 }}>No telemetry data captured since batch arrival.</td></tr>
                                )}
                                {logs.map(log => {
                                    const isTempBreach = log.temperature > batch.max_safe_temp;
                                    const isHumidBreach = batch.max_safe_humidity && log.humidity > batch.max_safe_humidity;
                                    const isBreach = isTempBreach || isHumidBreach;

                                    return (
                                        <tr key={log.log_id} className={isBreach ? 'breach-row' : ''}>
                                            <td style={{ fontWeight: 600 }}>{new Date(log.logged_at).toLocaleString()}</td>
                                            <td style={{ color: isTempBreach ? '#ef4444' : 'inherit', fontWeight: 800 }}>
                                                {Number(log.temperature).toFixed(1)}°C {isTempBreach && '⚠️'}
                                            </td>
                                            <td style={{ color: isHumidBreach ? '#ef4444' : 'inherit', fontWeight: 800 }}>
                                                {log.humidity !== null ? `${Number(log.humidity).toFixed(1)}%` : 'N/A'} {isHumidBreach && '⚠️'}
                                            </td>
                                            <td>
                                                <span className={`status-pill ${isBreach ? 'pill-breach' : 'pill-optimal'}`}>
                                                    <span className={`status-dot ${isBreach ? 'pulse-red' : ''}`} style={{ backgroundColor: isBreach ? '#ef4444' : '#22c55e' }}></span>
                                                    {isBreach ? 'Threshold Breach' : 'Optimal'}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default BatchDetail;
