import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

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

  useEffect(() => {
    const token = sessionStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    fetchAlerts();
    const interval = setInterval(fetchAlerts, 60000);
    return () => clearInterval(interval);
  }, [navigate]);

  useEffect(() => {
    sessionStorage.setItem('theme', theme);
  }, [theme]);

  const fetchAlerts = async () => {
    try {
      const token = sessionStorage.getItem('token');
      const res = await axios.get(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/dashboard/alerts/all`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAlerts(res.data.alerts || []);
      setSummary(res.data.summary || {
        total_alerts: 0, unread_count: 0, high_risk_count: 0,
        medium_risk_count: 0, zone_c_count: 0, expiry_count: 0
      });
      setLoading(false);
    } catch (err) {
      console.error('Error fetching alerts:', err);
      if (err.response?.status === 401 || err.response?.status === 403) {
        sessionStorage.removeItem('token');
        navigate('/login');
      }
      setLoading(false);
    }
  };

  const markAsRead = async (alertId) => {
    try {
      const token = sessionStorage.getItem('token');
      await axios.patch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/dashboard/alerts/${alertId}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchAlerts();
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
    setTheme(theme === 'light' ? 'dark' : 'light');
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
    if (type === 'zone_c_breach') return { icon: '🍼', color: '#f97316' }; // Orange
    if (type === 'expiry_proximity') return { icon: '⏰', color: '#f97316' }; // Orange
    if (riskBand === 'high') return { icon: '🔴', color: '#ef4444' }; // Red
    if (riskBand === 'medium') return { icon: '🟡', color: '#f59e0b' }; // Yellow/Amber
    if (riskBand === 'low') return { icon: '🟢', color: '#22c55e' }; // Green
    return { icon: '🔔', color: '#6b7280' };
  };

  const getAlertLabel = (type, riskBand) => {
    if (type === 'zone_c_breach') return 'ZONE C BREACH';
    if (type === 'expiry_proximity') return 'EXPIRY ALERT';
    if (riskBand === 'high') return 'HIGH RISK';
    if (riskBand === 'medium') return 'MEDIUM RISK';
    if (riskBand === 'low') return 'LOW RISK';
    return 'ALERT';
  };

  const getAlertBgColor = (type, riskBand) => {
    if (riskBand === 'high') return 'rgba(239, 68, 68, 0.1)'; // Subtle Red
    if (riskBand === 'medium') return 'rgba(245, 158, 11, 0.1)'; // Subtle Amber
    if (riskBand === 'low') return 'rgba(34, 197, 94, 0.1)'; // Subtle Green
    if (type === 'expiry_proximity') return 'rgba(249, 115, 22, 0.1)'; // Subtle Orange
    return 'rgba(107, 114, 128, 0.1)';
  };

  const getBadgeColors = (type, riskBand) => {
    if (type === 'zone_c_breach') return { bg: '#fff7ed', color: '#f97316' }; // Orange
    if (riskBand === 'high') return { bg: '#fef2f2', color: '#ef4444' }; // Red
    if (riskBand === 'medium') return { bg: '#fffbeb', color: '#f59e0b' }; // Amber
    if (riskBand === 'low') return { bg: '#f0fdf4', color: '#22c55e' }; // Green
    if (type === 'expiry_proximity') return { bg: '#fff7ed', color: '#f97316' };
    return { bg: '#f3f4f6', color: '#6b7280' };
  };

  const getTimeAgo = (dateStr) => {
    if (!dateStr) return '';
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays > 0) return `${diffDays} days ago`;
    return `${diffHours} hours ago`;
  };

  const getDaysUntilExpiry = (expiryDate) => {
    if (!expiryDate) return null;
    const diffMs = new Date(expiryDate).getTime() - Date.now();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  };

  const getZoneLetter = (zoneId) => {
    const id = String(zoneId).toUpperCase();
    if (['A', 'B', 'C', 'D'].includes(id)) return id;
    const map = { '1': 'A', '2': 'B', '3': 'C', '4': 'D' };
    return map[id] || id;
  };

  const getZoneStyles = (zoneId, isDark) => {
    const letter = getZoneLetter(zoneId);
    const colors = {
      'A': { bg: '#3b82f6', text: '#ffffff' }, // Blue
      'B': { bg: '#8b5cf6', text: '#ffffff' }, // Purple
      'C': { bg: '#f59e0b', text: '#ffffff' }, // Orange
      'D': { bg: '#06b6d4', text: '#ffffff' }  // Cyan
    };

    if (colors[letter]) {
      return {
        backgroundColor: colors[letter].bg,
        color: colors[letter].text
      };
    }

    return {
      backgroundColor: isDark ? '#334155' : '#f1f5f9',
      color: isDark ? '#f8f9fa' : '#1e293b'
    };
  };

  const isDark = theme === 'dark';

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: isDark ? '#0f172a' : '#faf7f2',
        color: isDark ? '#f1f5f9' : '#1e293b',
        fontFamily: 'Arial, sans-serif'
      }}>
        <h2>Loading Alerts...</h2>
      </div>
    );
  }

  // --- STYLING ---
  const pageContainerStyle = {
    minHeight: '100vh',
    backgroundColor: isDark ? '#0f172a' : '#faf7f2',
    color: isDark ? '#f1f5f9' : '#1e293b',
    fontFamily: 'Arial, sans-serif'
  };

  const navbarStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 24px',
    backgroundColor: isDark ? '#1e293b' : '#3D1C02',
    color: 'white',
    marginBottom: '0'
  };

  const logoStyle = {
    backgroundColor: isDark ? '#3D1C02' : '#ffffff',
    color: isDark ? 'white' : '#3D1C02',
    padding: '4px 8px',
    fontWeight: 'bold',
    borderRadius: '4px',
    marginRight: '12px'
  };

  const navCenterStyle = {
    fontSize: '20px',
    fontWeight: 'bold'
  };

  const navRightStyle = {
    display: 'flex',
    gap: '16px',
    alignItems: 'center'
  };

  const navBtnStyle = {
    background: 'none',
    border: 'none',
    color: 'white',
    cursor: 'pointer',
    fontSize: '18px'
  };

  const logoutBtnStyle = {
    background: 'rgba(0,0,0,0.2)',
    border: 'none',
    color: 'white',
    padding: '8px 16px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 'bold',
    transition: 'all 0.2s'
  };

  const backLinkContainerStyle = {
    padding: '16px 24px'
  };

  const backLinkStyle = {
    color: isDark ? '#94a3b8' : '#3D1C02',
    textDecoration: 'none',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  };

  const containerStyle = {
    maxWidth: '1200px',
    margin: '0 auto'
  };

  const summaryGridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '16px',
    padding: '24px 24px 0 24px'
  };

  const summaryCardStyle = {
    backgroundColor: isDark ? '#1e293b' : 'white',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    textAlign: 'center'
  };

  const summaryLabelStyle = {
    fontSize: '12px',
    textTransform: 'uppercase',
    fontWeight: 'bold',
    marginBottom: '8px'
  };

  const summaryNumberStyle = {
    fontSize: '48px',
    fontWeight: 'bold',
    margin: '10px 0'
  };

  const summarySubStyle = {
    fontSize: '12px',
    color: 'grey'
  };

  const filterBarStyle = {
    display: 'flex',
    gap: '8px',
    padding: '16px 24px',
    flexWrap: 'wrap',
    alignItems: 'center'
  };

  const filterBtnStyle = (isActive) => ({
    padding: '6px 16px',
    borderRadius: '20px',
    border: isActive ? 'none' : '1px solid #ccc',
    cursor: 'pointer',
    fontSize: '13px',
    backgroundColor: isActive ? '#3D1C02' : (isDark ? '#334155' : '#f8f9fa'),
    color: isActive ? 'white' : (isDark ? '#f1f5f9' : '#1e293b')
  });

  const searchBoxStyle = {
    padding: '8px 16px',
    borderRadius: '8px',
    border: '1px solid #ccc',
    backgroundColor: isDark ? '#1e293b' : 'white',
    color: isDark ? 'white' : 'black',
    marginLeft: 'auto',
    width: '250px'
  };

  const listContainerStyle = {
    padding: '0 24px 24px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  };

  const alertCardStyle = (color) => ({
    backgroundColor: isDark ? '#1e293b' : 'white',
    borderRadius: '12px',
    padding: '16px 20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    borderLeft: `4px solid ${color}`,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  });

  const cardTopStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  };

  const alertTypeBadgeStyle = (bg, col) => ({
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: 'bold',
    backgroundColor: bg,
    color: col
  });

  const newBadgeStyle = {
    backgroundColor: '#ef4444',
    color: 'white',
    padding: '2px 8px',
    borderRadius: '10px',
    fontSize: '10px',
    fontWeight: 'bold',
    marginLeft: '8px'
  };

  const timestampStyle = {
    fontSize: '12px',
    color: 'grey',
    marginLeft: '12px'
  };

  const readBtnStyle = {
    padding: '4px 12px',
    borderRadius: '6px',
    backgroundColor: 'transparent',
    border: '1px solid grey',
    cursor: 'pointer',
    fontSize: '12px',
    color: 'grey'
  };

  const midRowStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginTop: '4px'
  };

  const productNameStyle = {
    fontSize: '16px',
    fontWeight: 'bold',
    margin: 0
  };

  const infoBadgeStyle = (bdgColor = null) => ({
    backgroundColor: bdgColor ? bdgColor : (isDark ? '#334155' : '#f1f5f9'),
    color: isDark ? '#f8f9fa' : '#1e293b',
    padding: '2px 10px',
    borderRadius: '8px',
    fontSize: '12px',
    marginLeft: '8px',
    fontWeight: 'bold'
  });

  const msgBoxStyle = (bgColor, borderColor) => ({
    padding: '10px 14px',
    borderRadius: '8px',
    fontSize: '13px',
    fontStyle: 'italic',
    backgroundColor: bgColor,
    border: `1px solid ${borderColor}`,
    marginTop: '8px'
  });

  const bottomRowStyle = {
    display: 'flex',
    gap: '16px',
    fontSize: '12px',
    marginTop: '8px',
    color: isDark ? '#cbd5e1' : '#475569'
  };

  return (
    <div style={pageContainerStyle}>
      <nav style={navbarStyle}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={logoStyle}>FIROS</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 'bold', fontSize: '16px' }}>Nestlé Lanka</span>
            <span style={{ fontSize: '10px', opacity: 0.8 }}>FRESHNESS SYSTEM</span>
          </div>
        </div>

        <div style={navCenterStyle}>
          🔔 Alert Centre
        </div>

        <div style={navRightStyle}>
          <button style={navBtnStyle} onClick={toggleTheme}>
            {isDark ? '☀️' : '🌙'}
          </button>
          <button style={logoutBtnStyle} onClick={handleLogout}>
            Logout
          </button>
        </div>
      </nav>

      <div style={backLinkContainerStyle}>
        <Link to="/dashboard" style={backLinkStyle}>
          ← Back to Dashboard
        </Link>
      </div>

      <div style={containerStyle}>
        {/* SUMMARY CARDS */}
        <div style={summaryGridStyle}>
          <div style={summaryCardStyle}>
            <div style={{ ...summaryLabelStyle, color: 'grey' }}>Total Alerts</div>
            <div style={summaryNumberStyle}>{summary.total_alerts}</div>
            <div style={summarySubStyle}>All Time</div>
          </div>

          <div style={summaryCardStyle}>
            <div style={{ ...summaryLabelStyle, color: '#ef4444' }}>Unread Alerts</div>
            <div style={{ ...summaryNumberStyle, color: '#ef4444' }}>{summary.unread_count}</div>
            <div style={summarySubStyle}>Need Attention</div>
          </div>

          <div style={summaryCardStyle}>
            <div style={{ ...summaryLabelStyle, color: '#f97316' }}>Zone C Breaches</div>
            <div style={{ ...summaryNumberStyle, color: '#f97316' }}>{summary.zone_c_count}</div>
            <div style={summarySubStyle}>Infant Product Alerts</div>
          </div>

          <div style={summaryCardStyle}>
            <div style={{ ...summaryLabelStyle, color: '#f97316' }}>Expiry Proximity</div>
            <div style={{ ...summaryNumberStyle, color: '#f97316' }}>{summary.expiry_count}</div>
            <div style={summarySubStyle}>Expiring Within 60 Days</div>
          </div>
        </div>

        {/* FILTER BAR */}
        <div style={filterBarStyle}>
          {['All', 'Unread', 'High Risk', 'Medium Risk', 'Zone C Breach', 'Expiry'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={filterBtnStyle(filter === f)}
            >
              {f}
            </button>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', marginLeft: 'auto', position: 'relative' }}>
            <span style={{ position: 'absolute', left: '10px', fontSize: '14px' }}>🔍</span>
            <input
              type="text"
              placeholder="Search product or batch..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ ...searchBoxStyle, paddingLeft: '32px' }}
            />
          </div>
        </div>

        {/* ALERTS LIST */}
        <div style={listContainerStyle}>
          {filteredAlerts.length === 0 ? (
            <div style={{ ...summaryCardStyle, padding: '40px', color: 'grey' }}>
              <div style={{ fontSize: '32px', marginBottom: '10px' }}>✅</div>
              <p style={{ fontSize: '16px', fontWeight: 'bold', margin: '0' }}>No alerts found for the selected filter.</p>
            </div>
          ) : (
            filteredAlerts.map(alert => {
              const config = getAlertConfig(alert.alert_type, alert.risk_band);
              const label = getAlertLabel(alert.alert_type, alert.risk_band);
              const bdg = getBadgeColors(alert.alert_type, alert.risk_band);
              const daysUntilExpiry = getDaysUntilExpiry(alert.expiry_date);

              return (
                <div key={alert.alert_id} style={alertCardStyle(config.color)}>
                  <div style={cardTopStyle}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={alertTypeBadgeStyle(bdg.bg, bdg.color)}>
                        {config.icon} {label}
                      </span>
                      {!alert.is_read && <span style={newBadgeStyle}>NEW</span>}
                      <span style={timestampStyle}>{getTimeAgo(alert.created_at)}</span>
                    </div>
                    {!alert.is_read && (
                      <button style={readBtnStyle} onClick={() => markAsRead(alert.alert_id)}>
                        Mark as Read
                      </button>
                    )}
                  </div>

                  <div style={midRowStyle}>
                    <p style={productNameStyle}>{alert.product_name}</p>
                    <span style={infoBadgeStyle()}>Batch: {alert.batch_id}</span>
                    <span style={{ ...infoBadgeStyle(), ...getZoneStyles(alert.zone_id, isDark) }}>
                      Zone {getZoneLetter(alert.zone_id)}
                    </span>
                    {alert.frs_score !== null && (
                      <span style={infoBadgeStyle()}>FRS: {alert.frs_score}%</span>
                    )}
                  </div>

                  <div style={msgBoxStyle(getAlertBgColor(alert.alert_type, alert.risk_band), config.color)}>
                    {alert.message}
                  </div>

                  <div style={bottomRowStyle}>
                    <div>
                      <strong>Expiry Date:</strong> {alert.expiry_date ? new Date(alert.expiry_date).toLocaleDateString() : 'N/A'}
                    </div>
                    {daysUntilExpiry !== null && (
                      <div style={{
                        color: daysUntilExpiry < 30 ? '#ef4444' : (daysUntilExpiry < 60 ? '#f59e0b' : '#22c55e'),
                        fontWeight: 'bold'
                      }}>
                        Days to Expire: {daysUntilExpiry} days
                      </div>
                    )}
                    <div>
                      <strong>Status:</strong> {alert.status?.replace('_', ' ').toUpperCase() || 'UNKNOWN'}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default Alerts;
