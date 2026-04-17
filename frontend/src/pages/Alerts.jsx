import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import Pagination from '../components/Pagination';

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
    const bgColor = isDark ? '#0f172a' : '#f8fafc';
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
        document.documentElement.classList.toggle('dark', newTheme === 'dark');
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
        return { bg: isDark ? '#334155' : '#f8fafc', color: textMuted };
    };

    if (loading) {
        return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: bgColor, color: textColor }}><h2>Loading Alerts Matrix...</h2></div>;
    }

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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '32px' }}>
                    <div>
                        <button
                            onClick={() => navigate('/dashboard')}
                            style={{ background: 'transparent', border: 'none', color: isDark ? '#60a5fa' : '#2563eb', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', padding: 0 }}
                        >
                            <span>←</span> Back to Dashboard
                        </button>
                        <h1 style={{ margin: '0 0 8px 0', fontSize: '32px' }}>Alert Intelligence Centre</h1>
                        <p style={{ margin: 0, color: textMuted }}>Real-time monitoring of biological risk bands and zone breaches.</p>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '32px' }}>
                    <div style={{ backgroundColor: cardBgColor, padding: '24px', borderRadius: '16px', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, textAlign: 'center' }}>
                        <div style={{ fontSize: '12px', textTransform: 'uppercase', color: textMuted, fontWeight: 'bold' }}>Total Logged</div>
                        <div style={{ fontSize: '48px', fontWeight: 'bold', margin: '8px 0' }}>{summary.total_alerts}</div>
                    </div>
                    <div style={{ backgroundColor: cardBgColor, padding: '24px', borderRadius: '16px', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, textAlign: 'center', boxShadow: summary.unread_count > 0 ? '0 4px 20px rgba(239, 68, 68, 0.15)' : 'none' }}>
                        <div style={{ fontSize: '12px', textTransform: 'uppercase', color: '#ef4444', fontWeight: 'bold' }}>Urgent Attention</div>
                        <div style={{ fontSize: '48px', fontWeight: 'bold', margin: '8px 0', color: '#ef4444' }}>{summary.unread_count}</div>
                    </div>
                    <div style={{ backgroundColor: cardBgColor, padding: '24px', borderRadius: '16px', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, textAlign: 'center' }}>
                        <div style={{ fontSize: '12px', textTransform: 'uppercase', color: '#f97316', fontWeight: 'bold' }}>Infant Formula Breaches</div>
                        <div style={{ fontSize: '48px', fontWeight: 'bold', margin: '8px 0', color: '#f97316' }}>{summary.zone_c_count}</div>
                    </div>
                    <div style={{ backgroundColor: cardBgColor, padding: '24px', borderRadius: '16px', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, textAlign: 'center' }}>
                        <div style={{ fontSize: '12px', textTransform: 'uppercase', color: '#f59e0b', fontWeight: 'bold' }}>Expiry Impending</div>
                        <div style={{ fontSize: '48px', fontWeight: 'bold', margin: '8px 0', color: '#f59e0b' }}>{summary.expiry_count}</div>
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
                        style={{ padding: '10px 16px', borderRadius: '8px', border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`, backgroundColor: isDark ? '#0f172a' : '#f8fafc', color: textColor, width: '280px', outline: 'none' }}
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
