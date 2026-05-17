import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import Pagination from '../components/Pagination';
const AnimatedCounter = ({ value }) => {
    const [count, setCount] = React.useState(0);

    React.useEffect(() => {
        let startTimestamp = null;
        const totalDuration = 1000;
        const endValue = parseFloat(value);
        if (isNaN(endValue)) return;

        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / totalDuration, 1);
            const easeProgress = 1 - Math.pow(1 - progress, 4);
            setCount(easeProgress * endValue);
            
            if (progress < 1) {
                window.requestAnimationFrame(step);
            } else {
                setCount(endValue);
            }
        };
        window.requestAnimationFrame(step);
    }, [value]);

    const isDecimal = value.toString().includes('.');
    return <>{isDecimal ? count.toFixed(1) : Math.round(count)}</>;
};

const Alerts = () => {
    const navigate = useNavigate();
    const [theme, setTheme] = useState(sessionStorage.getItem('theme') || 'light');
    const [alerts, setAlerts] = useState([]);
    const [summary, setSummary] = useState({
        total_alerts: 0,
        unread_count: 0,
        high_risk_count: 0,
        medium_risk_count: 0,
        zone_c_count: 0,
        expiry_count: 0
    });
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('All');
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 });

    const isDark = theme === 'dark';
    const bgColor = isDark ? '#0f172a' : '#faf7f2';
    const textColor = isDark ? '#f1f5f9' : '#1e293b';
    const cardBgColor = isDark ? '#1e293b' : 'white';
    const textMuted = isDark ? '#94a3b8' : '#64748b';
    const navBg = isDark ? '#1e293b' : '#3D1C02';

    const fetchAlerts = React.useCallback(async (page = 1) => {
        try {
            const token = sessionStorage.getItem('token');
            const res = await axios.get(`/api/dashboard/alerts/all?page=${page}&limit=25`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setAlerts(res.data.alerts || []);
            setSummary(res.data.summary || {
                total_alerts: 0, unread_count: 0, high_risk_count: 0,
                medium_risk_count: 0, zone_c_count: 0, expiry_count: 0
            });
            if (res.data.pagination) setPagination(res.data.pagination);
            setLoading(false);
        } catch (err) {
            console.error('Error fetching alerts:', err);
            if (err.response?.status === 401 || err.response?.status === 403) {
                sessionStorage.removeItem('token');
                navigate('/login');
            }
            setLoading(false);
        }
    }, [navigate]);

    useEffect(() => {
        const token = sessionStorage.getItem('token');
        if (!token) {
            navigate('/login');
            return;
        }
        fetchAlerts(currentPage);
        const interval = setInterval(() => fetchAlerts(currentPage), 60000);
        return () => clearInterval(interval);
    }, [navigate, fetchAlerts, currentPage]);

    const handlePageChange = (newPage) => {
        setCurrentPage(newPage);
    };

    const markAsRead = async (alertId) => {
        try {
            const token = sessionStorage.getItem('token');
            await axios.patch(`/api/dashboard/alerts/${alertId}/read`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchAlerts(currentPage);
        } catch (err) {
            console.error('Error marking as read:', err);
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
        window.dispatchEvent(new Event('theme-changed'));
    };

    const filteredAlerts = alerts.filter(alert => {
        let matchFilter = true;
        if (filter === 'Unread') matchFilter = !alert.is_read;
        else if (filter === 'High Risk') matchFilter = alert.risk_band === 'high';
        else if (filter === 'Medium Risk') matchFilter = alert.risk_band === 'medium';
        else if (filter === 'Zone C Breach') matchFilter = alert.alert_type === 'zone_c_breach';
        else if (filter === 'Expiry') matchFilter = alert.alert_type === 'expiry_proximity';

        let matchSearch = true;
        if (searchTerm) {
            const lowerSearch = searchTerm.toLowerCase();
            matchSearch =
                (alert.product_name && alert.product_name.toLowerCase().includes(lowerSearch)) ||
                (alert.batch_id && String(alert.batch_id).toLowerCase().includes(lowerSearch));
        }
        return matchFilter && matchSearch;
    });

    const dynamicSummary = {
        total_alerts: filteredAlerts.length,
        unread_count: filteredAlerts.filter(a => !a.is_read).length,
        zone_c_count: filteredAlerts.filter(a => a.alert_type === 'zone_c_breach').length,
        expiry_count: filteredAlerts.filter(a => a.alert_type === 'expiry_proximity').length
    };

    const getAlertConfig = (type, riskBand) => {
        const renderDot = (col) => <div style={{width: 8, height: 8, borderRadius: '50%', backgroundColor: col, display: 'inline-block', marginRight: 6}} />;
        if (type === 'zone_c_breach') return { icon: renderDot('#f97316'), color: '#f97316' };
        if (type === 'expiry_proximity') return { icon: renderDot('#f97316'), color: '#f97316' };
        if (riskBand === 'high') return { icon: renderDot('#ef4444'), color: '#ef4444' };
        if (riskBand === 'medium') return { icon: renderDot('#f59e0b'), color: '#f59e0b' };
        if (riskBand === 'low') return { icon: renderDot('#22c55e'), color: '#22c55e' };
        return { icon: renderDot('#64748b'), color: '#64748b' };
    };

    const getBadgeColors = (type, riskBand) => {
        if (type === 'zone_c_breach') return { bg: isDark ? 'rgba(249, 115, 22, 0.2)' : '#fff7ed', color: '#f97316' };
        if (riskBand === 'high') return { bg: isDark ? 'rgba(239, 68, 68, 0.2)' : '#fef2f2', color: '#ef4444' };
        if (riskBand === 'medium') return { bg: isDark ? 'rgba(245, 158, 11, 0.2)' : '#fffbeb', color: '#f59e0b' };
        if (riskBand === 'low') return { bg: isDark ? 'rgba(34, 197, 94, 0.2)' : '#f0fdf4', color: '#22c55e' };
        if (type === 'expiry_proximity') return { bg: isDark ? 'rgba(249, 115, 22, 0.2)' : '#fff7ed', color: '#f97316' };
        return { bg: isDark ? '#334155' : '#faf7f2', color: textMuted };
    };

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', backgroundColor: bgColor, padding: '40px' }}>
                <style>{`
                    @keyframes pulseSkeleton { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
                    .skeleton-item { animation: pulseSkeleton 1.5s infinite ease-in-out; }
                    .loading-msg {
                        background: linear-gradient(135deg, #1a3a5c 0%, #295380 100%);
                        color: #f8fafc; padding: 12px 24px; border-radius: 30px; display: inline-block;
                        font-weight: 800; font-size: 16px; box-shadow: 0 4px 15px rgba(26, 58, 92, 0.4);
                        letter-spacing: 0.5px; border: 1px solid rgba(200, 169, 110, 0.3);
                        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 9999;
                    }
                `}</style>
                <div style={{ textAlign: 'center' }} className="skeleton-item">
                    <div className="loading-msg">🚨 Scanning Alert Intelligence Matrix...</div>
                </div>
                <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
                    <div className="skeleton-item" style={{ height: '40px', width: '300px', backgroundColor: isDark ? '#334155' : '#e2e8f0', borderRadius: '8px', marginBottom: '32px' }} />
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '32px' }}>
                        {[1,2,3,4].map(i => <div key={i} className="skeleton-item" style={{ height: '120px', backgroundColor: isDark ? '#1e293b' : '#fdfaf5', borderRadius: '16px', border: `1px solid ${isDark ? '#334155' : '#e8dfd0'}` }} />)}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {[1,2,3,4,5].map(i => <div key={i} className="skeleton-item" style={{ height: '80px', backgroundColor: isDark ? '#1e293b' : '#fdfaf5', borderRadius: '12px', border: `1px solid ${isDark ? '#334155' : '#e8dfd0'}` }} />)}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', backgroundColor: bgColor, color: textColor, fontFamily: 'inherit' }}>
            <nav style={{
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                padding: '20px 40px',
                background: 'transparent',
                position: 'sticky',
                top: 0,
                zIndex: 100
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '15px',
                    background: isDark ? 'rgba(30, 41, 59, 0.4)' : 'rgba(255, 255, 255, 0.4)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    padding: '8px 15px',
                    borderRadius: '20px',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.05)'
                }}>
                    <button onClick={toggleTheme} style={{
                        background: 'rgba(255, 255, 255, 0.2)',
                        border: '1px solid rgba(255, 255, 255, 0.3)',
                        fontSize: '16px',
                        cursor: 'pointer',
                        borderRadius: '50%',
                        width: '34px',
                        height: '34px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: isDark ? '#f8fafc' : '#1e293b'
                    }}>
                        {isDark ? '☀️' : '🌙'}
                    </button>
                    <button onClick={handleLogout} style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        color: '#ef4444',
                        fontWeight: '700',
                        padding: '6px 14px',
                        fontSize: '13px',
                        borderRadius: '12px',
                        cursor: 'pointer'
                    }}>Logout</button>
                </div>
            </nav>

            <main style={{ padding: '32px 48px', maxWidth: '1400px', margin: '0 auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '32px' }}>
                    <div>
                        <h1 style={{ margin: '0 0 8px 0', fontSize: '32px' }}>Alert Intelligence Centre</h1>
                        <p style={{ margin: 0, color: textMuted }}>Real-time monitoring of biological risk bands and zone breaches.</p>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '32px' }}>
                    <div style={{ backgroundColor: cardBgColor, padding: '24px', borderRadius: '16px', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, textAlign: 'center' }}>
                        <div style={{ fontSize: '12px', textTransform: 'uppercase', color: textMuted, fontWeight: 'bold' }}>Total Logged</div>
                        <div style={{ fontSize: '48px', fontWeight: 'bold', margin: '8px 0' }}><AnimatedCounter value={dynamicSummary.total_alerts} /></div>
                    </div>
                    <div style={{ backgroundColor: cardBgColor, padding: '24px', borderRadius: '16px', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, textAlign: 'center', boxShadow: dynamicSummary.unread_count > 0 ? '0 4px 20px rgba(239, 68, 68, 0.15)' : 'none' }}>
                        <div style={{ fontSize: '12px', textTransform: 'uppercase', color: '#ef4444', fontWeight: 'bold' }}>Urgent Attention</div>
                        <div style={{ fontSize: '48px', fontWeight: 'bold', margin: '8px 0', color: '#ef4444' }}><AnimatedCounter value={dynamicSummary.unread_count} /></div>
                    </div>
                    <div style={{ backgroundColor: cardBgColor, padding: '24px', borderRadius: '16px', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, textAlign: 'center' }}>
                        <div style={{ fontSize: '12px', textTransform: 'uppercase', color: '#f97316', fontWeight: 'bold' }}>Infant Formula Breaches</div>
                        <div style={{ fontSize: '48px', fontWeight: 'bold', margin: '8px 0', color: '#f97316' }}><AnimatedCounter value={dynamicSummary.zone_c_count} /></div>
                    </div>
                    <div style={{ backgroundColor: cardBgColor, padding: '24px', borderRadius: '16px', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, textAlign: 'center' }}>
                        <div style={{ fontSize: '12px', textTransform: 'uppercase', color: '#f59e0b', fontWeight: 'bold' }}>Expiry Impending</div>
                        <div style={{ fontSize: '48px', fontWeight: 'bold', margin: '8px 0', color: '#f59e0b' }}><AnimatedCounter value={dynamicSummary.expiry_count} /></div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', alignItems: 'center', backgroundColor: cardBgColor, padding: '16px', borderRadius: '16px', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
                    <div style={{ display: 'flex', gap: '8px', flex: 1, flexWrap: 'wrap' }}>
                        {['All', 'Unread', 'High Risk', 'Medium Risk', 'Zone C Breach', 'Expiry'].map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                style={{
                                    padding: '8px 16px', borderRadius: '24px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold',
                                    backgroundColor: filter === f ? (isDark ? '#C8A96E' : '#3D1C02') : 'transparent',
                                    color: filter === f ? 'white' : textMuted,
                                    border: filter === f ? 'none' : `1px solid ${isDark ? '#475569' : '#cbd5e1'}`
                                }}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                    <input
                        type="text"
                        placeholder="Search product or batch..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ padding: '10px 16px', borderRadius: '8px', border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`, backgroundColor: isDark ? '#0f172a' : '#faf7f2', color: textColor, width: '280px', outline: 'none' }}
                    />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {filteredAlerts.length === 0 ? (
                        <div style={{ padding: '64px', textAlign: 'center', backgroundColor: cardBgColor, borderRadius: '16px', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
                            <div style={{ width: '48px', height: '48px', margin: '0 auto 16px', borderRadius: '50%', border: '4px solid #10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div style={{ width: '12px', height: '24px', borderBottom: '4px solid #10b981', borderRight: '4px solid #10b981', transform: 'rotate(45deg)', marginTop: '-4px' }} />
                            </div>
                            <h3 style={{ margin: '0 0 8px 0' }}>All Clear</h3>
                            <p style={{ color: textMuted, margin: 0 }}>No active alerts targeting this filter criteria.</p>
                        </div>
                    ) : (
                        filteredAlerts.map(alert => {
                            const config = getAlertConfig(alert.alert_type, alert.risk_band);
                            const bdg = getBadgeColors(alert.alert_type, alert.risk_band);
                            const isUnread = !alert.is_read;

                            return (
                                <div key={alert.alert_id} style={{ 
                                    backgroundColor: cardBgColor, 
                                    borderRadius: '16px', 
                                    padding: '24px', 
                                    border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                    borderLeft: `6px solid ${config.color}`,
                                    position: 'relative',
                                    boxShadow: isUnread ? '0 4px 15px rgba(0,0,0,0.05)' : 'none',
                                    transition: 'all 0.2s',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    opacity: isUnread ? 1 : 0.7
                                }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                                            <span style={{ backgroundColor: bdg.bg, color: bdg.color, padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>
                                                {config.icon} {alert.alert_type.replace(/_/g, ' ').toUpperCase()}
                                            </span>
                                            {isUnread && <span style={{ backgroundColor: '#ef4444', color: 'white', padding: '2px 8px', borderRadius: '8px', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px' }}>NEW</span>}
                                            <span style={{ color: textMuted, fontSize: '13px' }}>{new Date(alert.created_at).toLocaleString()}</span>
                                        </div>
                                        
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                                            <h3 style={{ margin: 0, fontSize: '20px' }}>{alert.product_name}</h3>
                                            <span style={{ backgroundColor: isDark ? '#334155' : '#f1f5f9', color: textColor, padding: '4px 10px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold' }}>Batch: {alert.batch_id}</span>
                                            {alert.frs_score !== null && (
                                                <span style={{ backgroundColor: bdg.bg, color: bdg.color, padding: '4px 10px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold' }}>Score: {Number(alert.frs_score).toFixed(1)}</span>
                                            )}
                                        </div>

                                        <p style={{ margin: '0 0 16px 0', color: textMuted, fontSize: '15px', fontStyle: 'italic' }}>"{alert.message}"</p>

                                        <div style={{ display: 'flex', gap: '24px', fontSize: '13px', color: textMuted, fontWeight: 'bold' }}>
                                            <span>ZONE: {String(alert.zone_id).toUpperCase()}</span>
                                            <span>EXPIRES: {alert.expiry_date ? new Date(alert.expiry_date).toLocaleDateString() : 'N/A'}</span>
                                            <span>ACTION STATUS: {alert.status?.replace('_', ' ').toUpperCase() || 'UNKNOWN'}</span>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'flex-end', marginLeft: '32px' }}>
                                        <button 
                                            onClick={() => navigate('/recommendations', { state: { autoSelectBatchId: alert.batch_id } })}
                                            style={{ 
                                                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', 
                                                color: '#C8A96E', 
                                                border: '1px solid #C8A96E', 
                                                padding: '12px 24px', 
                                                borderRadius: '8px', 
                                                fontWeight: 'bold', 
                                                cursor: 'pointer',
                                                whiteSpace: 'nowrap',
                                                boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
                                            }}
                                        >
                                            Take Action →
                                        </button>
                                        {isUnread && (
                                            <button 
                                                onClick={() => markAsRead(alert.alert_id)}
                                                style={{ background: 'transparent', border: 'none', color: textMuted, textDecoration: 'underline', cursor: 'pointer', fontSize: '13px' }}
                                            >
                                                Mark as Read
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                    {filteredAlerts.length > 0 && (
                        <Pagination 
                            currentPage={pagination.page}
                            totalPages={pagination.totalPages}
                            totalItems={pagination.total}
                            onPageChange={handlePageChange}
                            isDark={isDark}
                        />
                    )}
                </div>
            </main>
        </div>
    );
};

export default Alerts;
