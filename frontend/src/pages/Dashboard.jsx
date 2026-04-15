import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';

const Dashboard = () => {
    const navigate = useNavigate();
    const [theme, setTheme] = useState(sessionStorage.getItem('theme') || 'light');
    const [data, setData] = useState(null);
    const [batches, setBatches] = useState([]);
    const [zones, setZones] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [expiryTimeline, setExpiryTimeline] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [showAlerts, setShowAlerts] = useState(false);
    const role = sessionStorage.getItem('role');
    const dropdownRef = useRef(null);

    const [riskFilter, setRiskFilter] = useState('All');
    const [zoneFilter, setZoneFilter] = useState('All Zones');

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowAlerts(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        sessionStorage.setItem('theme', theme);
        document.body.className = theme;
    }, [theme]);

    const fetchAllData = React.useCallback(async () => {
        const token = sessionStorage.getItem('token');
        if (!token) {
            navigate('/login');
            return;
        }

        try {
            const headers = { 'Authorization': `Bearer ${token}` };
            const [dashRes, zonesRes, alertsRes, expiryRes] = await Promise.all([
                fetch('/api/dashboard', { headers }),
                fetch('/api/dashboard/zones', { headers }),
                fetch('/api/dashboard/alerts', { headers }),
                fetch('/api/dashboard/expiry-timeline', { headers })
            ]);

            if (dashRes.status === 401 || dashRes.status === 403) {
                sessionStorage.removeItem('token');
                navigate('/login');
                return;
            }

            const dashData = await dashRes.json();
            const zonesData = await zonesRes.json();
            const alertsData = await alertsRes.json();
            const expiryData = await expiryRes.json();

            setData(dashData);
            setBatches(Array.isArray(dashData?.batches) ? dashData.batches : []);

            const finalZones = Array.isArray(zonesData) ? zonesData : [];
            setZones(finalZones);
            console.log('Zone data:', finalZones);

            setAlerts(Array.isArray(alertsData) ? alertsData : []);
            setExpiryTimeline(Array.isArray(expiryData) ? expiryData : []);
            setLastUpdated(new Date());
            setError(null);
        } catch (err) {
            console.error("Fetch error", err);
            setError("Failed to refresh dashboard data.");
        } finally {
            if (loading) setLoading(false);
        }
    }, [navigate, loading]);

    useEffect(() => {
        fetchAllData();
        const interval = setInterval(fetchAllData, 60000);
        return () => clearInterval(interval);
    }, [fetchAllData]);

    const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

    const handleLogout = () => {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('role');
        navigate('/login');
    };

    if (loading && !data) {
        return (
            <div className={`dashboard-container ${theme} flex-center fullscreen`}>
                <div className="spinner"></div>
                <h2 style={{ marginTop: '20px' }}>Loading FIROS Dashboard...</h2>
            </div>
        );
    }

    if (error && !data) {
        return (
            <div className={`dashboard-container ${theme} flex-center fullscreen`}>
                <div className="error-card">
                    <h2>Connection Error</h2>
                    <p>{error}</p>
                    <button onClick={fetchAllData} className="btn-primary">Retry</button>
                </div>
            </div>
        );
    }

    const { overall_freshness_percent = 0, total_batches = 0, high_risk_count = 0 } = data || {};
    const filteredBatches = (Array.isArray(batches) ? batches : []).filter(b => {
        const bdRisk = b.risk_band ? b.risk_band.toLowerCase() : 'unknown';
        const fltRisk = riskFilter.toLowerCase().replace(' risk', '');
        if (riskFilter !== 'All' && bdRisk !== fltRisk) return false;

        const zoneMap = { 1: 'Zone A', 2: 'Zone B', 3: 'Zone C', 4: 'Zone D' };
        const bZone = zoneMap[b.zone_id] || `Zone ${b.zone_id}`;
        if (zoneFilter !== 'All Zones' && bZone !== zoneFilter) return false;

        return true;
    });

    const getRiskColor = (risk) => {
        if (risk === 'low') return 'var(--green)';
        if (risk === 'medium') return 'var(--amber)';
        if (risk === 'high') return 'var(--red)';
        return 'var(--text-muted)';
    };

    const getFreshnessColor = (pct) => {
        if (pct >= 75) return 'var(--green)';
        if (pct >= 50) return 'var(--amber)';
        return 'var(--red)';
    };

    const getZoneName = (zoneId) => {
        const map = { 1: 'Zone A', 2: 'Zone B', 3: 'Zone C', 4: 'Zone D' };
        return map[zoneId] || `Zone ${zoneId}`;
    };

    const getZoneMeta = (zoneLetter) => {
        const map = {
            'A': { name: 'Powdered Beverages, Noodles & Seasonings', icon: '🍜' },
            'B': { name: 'Dairy & Condensed Products', icon: '🥛' },
            'C': { name: 'Infant & Nutrition Products', icon: '🍼' },
            'D': { name: 'Cold Storage Products', icon: '❄️' }
        };
        return map[zoneLetter] || { name: `Products`, icon: '📦' };
    };

    const getZoneLetter = (zoneId) => {
        const id = String(zoneId).toUpperCase();
        if (['A', 'B', 'C', 'D'].includes(id)) return id;
        const map = { '1': 'A', '2': 'B', '3': 'C', '4': 'D' };
        return map[id] || id;
    };

    return (
        <div className={`dashboard-container ${theme}`}>
            <nav className="top-nav">
                <div className="logo-section">
                    <h1 className="logo-text">FIROS</h1>
                    <span className="subtitle">Nestlé Lanka Warehouse</span>
                </div>

                <div className="nav-actions">
                    <div className="last-updated">
                        Last Updated: {lastUpdated ? lastUpdated.toLocaleTimeString() : ''}
                    </div>

                    {role === 'admin' && (
                        <button
                            onClick={() => navigate('/batch-registration')}
                            className="nav-btn-secondary"
                            style={{
                                padding: '8px 16px',
                                backgroundColor: 'transparent',
                                border: '1px solid var(--nestle-gold-main)',
                                borderRadius: '8px',
                                color: 'var(--nestle-gold-main)',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                fontSize: '13px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                transition: 'all 0.2s ease'
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.backgroundColor = 'var(--nestle-gold-main)';
                                e.currentTarget.style.color = '#3D1C02';
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.color = 'var(--nestle-gold-main)';
                            }}
                        >
                            <span style={{ fontSize: '16px' }}>📦</span> Register Batches
                        </button>
                    )}

                    <div ref={dropdownRef} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span
                            onClick={() => navigate('/alerts')}
                            style={{ cursor: 'pointer', color: 'var(--amber)', fontWeight: 'bold', fontSize: '14px', textDecoration: 'none' }}
                            onMouseOver={(e) => e.target.style.textDecoration = 'underline'}
                            onMouseOut={(e) => e.target.style.textDecoration = 'none'}
                        >
                            View All Alerts →
                        </span>
                        <div className="alert-bell-wrapper" style={{ cursor: 'pointer' }} onClick={() => navigate('/alerts')}>
                            <svg className="bell-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                            </svg>
                            {alerts.length > 0 && <span className="alert-badge">{alerts.length}</span>}
                        </div>
                        {showAlerts && (
                            <div className="alerts-dropdown-panel">
                                <div className="alerts-dropdown-header">
                                    <h3>Alerts ({alerts.length})</h3>
                                    <button onClick={() => setShowAlerts(false)}>×</button>
                                </div>
                                <div className="alerts-dropdown-body">
                                    {alerts.length === 0 && <p style={{ padding: '15px', margin: 0, color: 'var(--text-muted)' }}>No active alerts.</p>}
                                    {alerts.map(al => {
                                        let alClass = 'ad-blue';
                                        if (al.alert_type === 'high_risk_crossing' || al.alert_type === 'zone_c_breach') alClass = 'ad-red';
                                        else if (al.alert_type === 'medium_risk_crossing') alClass = 'ad-amber';
                                        else if (al.alert_type === 'expiry_proximity') alClass = 'ad-orange';

                                        const timeAgo = Math.floor((new Date() - new Date(al.created_at)) / 60000);
                                        let timeStr = 'Just now';
                                        if (timeAgo >= 60) timeStr = `${Math.floor(timeAgo / 60)}h ${timeAgo % 60}m ago`;
                                        else if (timeAgo > 0) timeStr = `${timeAgo}m ago`;

                                        return (
                                            <div key={al.alert_id} className={`alerts-dropdown-item ${alClass}`}>
                                                <p className="ad-msg">{al.message}</p>
                                                <span className="ad-time">{timeStr}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    <button className="theme-toggle" onClick={toggleTheme}>
                        {theme === 'light' ? '🌙' : '☀️'}
                    </button>

                    <button className="logout-btn" onClick={handleLogout}>Logout</button>
                </div>
            </nav>

            <main className="dashboard-main">
                <section className="stats-row">
                    <div className="stat-card pulse-card">
                        <div className="stat-value" style={{ color: getFreshnessColor(overall_freshness_percent) }}>
                            {overall_freshness_percent}%
                        </div>
                        <div className="stat-title">Overall Freshness Score</div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-value" style={{ color: 'var(--blue)' }}>{total_batches}</div>
                        <div className="stat-title">Batches In Storage</div>
                    </div>

                    <div className={`stat-card ${high_risk_count > 0 ? 'flash-card' : ''}`}>
                        <div className="stat-value" style={{ color: 'var(--red)' }}>{high_risk_count}</div>
                        <div className="stat-title">Urgent Action Required</div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-value" style={{ color: 'var(--amber)' }}>{alerts.length}</div>
                        <div className="stat-title">Active Alerts</div>
                    </div>
                </section>

                <div style={{ padding: '0 20px', marginBottom: '25px', marginTop: '10px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                    <button
                        onClick={() => navigate('/recommendations')}
                        style={{
                            background: 'linear-gradient(135deg, #C8A96E 0%, #3D1C02 100%)',
                            color: 'white',
                            padding: '16px 24px',
                            border: 'none',
                            borderRadius: '12px',
                            fontSize: '18px',
                            fontWeight: 'bold',
                            letterSpacing: '0.5px',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            boxShadow: '0 4px 15px rgba(61, 28, 2, 0.2)',
                            transition: 'all 0.3s ease'
                        }}
                        onMouseOver={(e) => {
                            e.currentTarget.style.transform = 'translateY(-3px)';
                            e.currentTarget.style.boxShadow = '0 8px 25px rgba(61, 28, 2, 0.3)';
                        }}
                        onMouseOut={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 4px 15px rgba(61, 28, 2, 0.2)';
                        }}
                    >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '20px' }}>📋</span> Action Recommendations
                        </span>
                        <span style={{ fontSize: '24px' }}>→</span>
                    </button>

                    <button
                        onClick={() => navigate('/clearance')}
                        style={{
                            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                            color: 'white',
                            padding: '16px 24px',
                            border: '2px solid #ef4444',
                            borderRadius: '12px',
                            fontSize: '18px',
                            fontWeight: 'bold',
                            letterSpacing: '0.5px',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
                            transition: 'all 0.3s ease'
                        }}
                        onMouseOver={(e) => {
                            e.currentTarget.style.transform = 'translateY(-3px)';
                            e.currentTarget.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.3)';
                        }}
                        onMouseOut={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.2)';
                        }}
                    >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#f87171' }}>
                            <span style={{ fontSize: '20px' }}>🔥</span> Clearance Promotions
                        </span>
                        <span style={{ fontSize: '24px', color: '#f87171' }}>→</span>
                    </button>

                    <button
                        onClick={() => navigate('/certificates')}
                        style={{
                            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                            color: 'white',
                            padding: '16px 24px',
                            border: '2px solid #C8A96E',
                            borderRadius: '12px',
                            fontSize: '18px',
                            fontWeight: 'bold',
                            letterSpacing: '0.5px',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
                            transition: 'all 0.3s ease'
                        }}
                        onMouseOver={(e) => {
                            e.currentTarget.style.transform = 'translateY(-3px)';
                            e.currentTarget.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.3)';
                        }}
                        onMouseOut={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.2)';
                        }}
                    >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#C8A96E' }}>
                            <span style={{ fontSize: '20px' }}>📜</span> Dispatch Certificates
                        </span>
                        <span style={{ fontSize: '24px', color: '#C8A96E' }}>→</span>
                    </button>

                    <button
                        onClick={() => navigate('/returns')}
                        style={{
                            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                            color: 'white',
                            padding: '16px 24px',
                            border: '2px solid #2563eb',
                            borderRadius: '12px',
                            fontSize: '18px',
                            fontWeight: 'bold',
                            letterSpacing: '0.5px',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
                            transition: 'all 0.3s ease'
                        }}
                        onMouseOver={(e) => {
                            e.currentTarget.style.transform = 'translateY(-3px)';
                            e.currentTarget.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.3)';
                        }}
                        onMouseOut={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.2)';
                        }}
                    >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#60a5fa' }}>
                            <span style={{ fontSize: '20px' }}>↩️</span> Return Intelligence
                        </span>
                        <span style={{ fontSize: '24px', color: '#60a5fa' }}>→</span>
                    </button>
                </div>

                <h2 className="section-title">Warehouse Zones Status</h2>
                <section className="zones-row">
                    {(Array.isArray(zones) ? zones : []).map(zone => {
                        const zoneLetter = getZoneLetter(zone.zone_id);
                        const zoneMeta = getZoneMeta(zoneLetter);

                        const now = new Date();
                        const lastReading = zone.last_reading_at ? new Date(zone.last_reading_at) : null;
                        const minutesAgo = lastReading ? Math.floor((now - lastReading) / (1000 * 60)) : null;
                        const isStale = !lastReading || minutesAgo > 60;

                        let timeText = "No readings yet";
                        if (minutesAgo !== null) {
                            if (minutesAgo < 1) timeText = "Just now";
                            else if (minutesAgo < 60) timeText = `${minutesAgo} mins ago`;
                            else timeText = `${Math.floor(minutesAgo / 60)} hours ago`;
                        }

                        return (
                            <div key={zone.zone_id} className="zone-card">
                                <div className="zone-card-top" style={{ alignItems: 'flex-start' }}>
                                    <div className={`zone-badge badge-${zoneLetter.toLowerCase()}`} style={{ width: '42px', height: '42px', fontSize: '18px' }}>
                                        {zoneLetter}
                                    </div>
                                    <div className="zone-new-name" style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '0' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ fontSize: '14px', background: 'var(--hover-bg)', padding: '4px', borderRadius: '6px', display: 'flex' }}>{zoneMeta.icon}</span>
                                            <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                Zone {zoneLetter}
                                            </span>
                                        </div>
                                        <span style={{ fontSize: '12.5px', lineHeight: '1.3', color: 'var(--text-main)', paddingRight: '5px' }}>{zoneMeta.name}</span>
                                    </div>
                                </div>
                                <div className="zone-card-reading">
                                    <div className="time-ago-new">{timeText}</div>
                                </div>
                                <div className="zone-status-text">
                                    {isStale ? (
                                        <span className="status-stale">● STALE DATA</span>
                                    ) : (
                                        <span className="status-fresh">● LIVE</span>
                                    )}
                                </div>
                                <div className={`zone-bottom-bar ${isStale ? 'bar-stale' : 'bar-fresh'}`}></div>
                            </div>
                        );
                    })}
                </section>

                <div className="dashboard-grid">
                    <div className="main-panel">
                        <div className="panel-header">
                            <h2>Batch Inventory</h2>
                            <div className="filters">
                                <select value={riskFilter} onChange={e => setRiskFilter(e.target.value)}>
                                    <option>All</option>
                                    <option>High Risk</option>
                                    <option>Medium Risk</option>
                                    <option>Low Risk</option>
                                </select>
                                <select value={zoneFilter} onChange={e => setZoneFilter(e.target.value)}>
                                    <option>All Zones</option>
                                    <option>Zone A</option>
                                    <option>Zone B</option>
                                    <option>Zone C</option>
                                    <option>Zone D</option>
                                </select>
                            </div>
                        </div>

                        <div className="table-responsive">
                            <table className="batch-table">
                                <thead>
                                    <tr>
                                        <th>Batch ID</th>
                                        <th>Product</th>
                                        <th>Zone</th>
                                        <th>Days In</th>
                                        <th>FRS Score</th>
                                        <th>Risk</th>
                                        <th>Expiry</th>
                                        <th>Status</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(Array.isArray(filteredBatches) ? filteredBatches : []).map(b => (
                                        <tr key={b.batch_id} className={`row-${b.risk_band || 'unknown'}-risk`}>
                                            <td>{b.batch_id}</td>
                                            <td>{b.product_name}</td>
                                            <td>{getZoneName(b.zone_id)}</td>
                                            <td>{b.days_in_warehouse}</td>
                                            <td>
                                                <span className="frs-badge" style={{ backgroundColor: getRiskColor(b.risk_band), color: '#fff' }}>
                                                    {b.frs_score ?? 'N/A'}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`risk-pill pill-${b.risk_band || 'unknown'}`}>
                                                    {(b.risk_band || 'unknown').toUpperCase()}
                                                </span>
                                            </td>
                                            <td>{new Date(b.expiry_date).toLocaleDateString()}</td>
                                            <td>{b.status.replace('_', ' ').toUpperCase()}</td>
                                            <td>
                                                <button
                                                    onClick={() => navigate(`/batch-detail/${b.batch_id}`)}
                                                    style={{
                                                        background: 'none',
                                                        border: '1px solid var(--nestle-gold-main)',
                                                        color: 'var(--nestle-gold-main)',
                                                        padding: '4px 8px',
                                                        borderRadius: '4px',
                                                        fontSize: '11px',
                                                        cursor: 'pointer',
                                                        fontWeight: 'bold'
                                                    }}
                                                >
                                                    View Details
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredBatches.length === 0 && (
                                        <tr><td colSpan="8" className="text-center">No batches found.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="side-panel">
                        <div className="panel-card timeline-panel">
                            <h2>Expiry Timeline (30 Days)</h2>
                            <div className="timeline-list">
                                {expiryTimeline.length === 0 && <p className="empty-text">No imminent expirations.</p>}
                                {(Array.isArray(expiryTimeline) ? expiryTimeline : []).map(exp => {
                                    let expClass = 'exp-yellow';
                                    if (exp.days_until_expiry <= 7) expClass = 'exp-red';
                                    else if (exp.days_until_expiry <= 15) expClass = 'exp-amber';

                                    return (
                                        <div key={exp.batch_id} className={`timeline-item ${expClass}`}>
                                            <div className="tl-head">
                                                <strong>{exp.product_name}</strong>
                                                <span>Batch: {exp.batch_id}</span>
                                            </div>
                                            <div className="tl-body">
                                                <span>{exp.days_until_expiry} Days Left</span>
                                                <span>FRS: {exp.frs_score}</span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        <div className="panel-card alerts-panel">
                            <h2>Recent Alerts</h2>
                            <div className="alerts-list">
                                {alerts.length === 0 && <p className="empty-text">No active alerts.</p>}
                                {(Array.isArray(alerts) ? alerts : []).map(al => {
                                    let alClass = 'al-blue', icon = 'ℹ️';
                                    if (al.alert_type === 'zone_c_breach' || al.alert_type === 'high_risk_crossing') {
                                        alClass = 'al-red'; icon = '⚠️';
                                    } else if (al.alert_type === 'medium_risk_crossing') {
                                        alClass = 'al-amber'; icon = '⚡';
                                    } else if (al.alert_type === 'expiry_proximity') {
                                        alClass = 'al-orange'; icon = '⏰';
                                    }

                                    return (
                                        <div key={al.alert_id} className={`alert-card ${alClass}`}>
                                            <div className="al-icon">{icon}</div>
                                            <div className="al-content">
                                                <p className="al-msg">{al.message}</p>
                                                <small>{new Date(al.created_at).toLocaleString()}</small>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Dashboard;
