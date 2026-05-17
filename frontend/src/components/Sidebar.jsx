import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const Sidebar = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const role = sessionStorage.getItem('role');
    const [theme, setTheme] = React.useState(sessionStorage.getItem('theme') || 'light');

    React.useEffect(() => {
        const handleThemeChange = () => setTheme(sessionStorage.getItem('theme') || 'light');
        window.addEventListener('theme-changed', handleThemeChange);
        return () => window.removeEventListener('theme-changed', handleThemeChange);
    }, []);

    const isDark = theme === 'dark';

    const navItems = [
        { path: '/dashboard', icon: '📊', label: 'Dashboard' },
        { path: '/certificates', icon: '📜', label: 'Dispatch Ledger' },
        { path: '/returns', icon: '↩️', label: 'Returns', roles: ['admin', 'manager'] },
        { path: '/recommendations', icon: '📋', label: 'Action Recommendations', roles: ['admin', 'manager'] },
        { path: '/clearance', icon: '🔥', label: 'Clearance Promotions', roles: ['admin', 'manager'] },
        { path: '/dashboard/root-cause', icon: '🔍', label: 'Root Cause Analytics', roles: ['manager'] },
        { path: '/dashboard/my-distributors', icon: '🚚', label: 'Distributor Fleet', roles: ['manager', 'admin'] },
        { path: '/dashboard/market-intelligence', icon: '📈', label: 'Market Intelligence', roles: ['admin', 'manager', 'warehouse_manager'] },
    ];

    const filteredItems = navItems.filter(item => !item.roles || item.roles.includes(role));

    return (
        <>
            {/* ── System Name Header ── sits parallel to the top nav bar, between top and sidebar */}
            <div style={{
                position: 'fixed',
                left: '85px',
                top: '60px', // lower than the search bar row, floating in the empty gap
                zIndex: 9999,
                fontFamily: "'Outfit', sans-serif",
                userSelect: 'none',
            }}>
                {/* Enhanced gradient text for FIROS */}
                <div style={{
                    fontSize: '42px',
                    fontWeight: '900',
                    letterSpacing: '3px',
                    background: isDark
                        ? 'linear-gradient(135deg, #C8A96E 0%, #F5D898 50%, #C8A96E 100%)'
                        : 'linear-gradient(135deg, #3D1C02 0%, #7C3D12 50%, #3D1C02 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    lineHeight: 1,
                }}>FIROS</div>
                <div style={{
                    color: isDark ? '#94a3b8' : '#A67956',
                    fontSize: '15px',
                    fontWeight: '700',
                    letterSpacing: '2px',
                    marginTop: '6px',
                    textTransform: 'uppercase',
                    opacity: 0.85,
                }}>NESTLÉ LANKA</div>
            </div>

            {/* ── Navigation Box ── vertically centered, with proper height to fit all items */}
            <div style={{
                position: 'fixed',
                left: '20px',
                top: '50%',
                transform: 'translateY(-45%)', // slight downward offset so it sits below the header
                background: isDark ? 'rgba(26, 12, 1, 0.92)' : 'rgba(61, 28, 2, 0.88)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: `1px solid ${isDark ? 'rgba(200, 169, 110, 0.15)' : 'rgba(255, 255, 255, 0.18)'}`,
                borderRadius: '24px',
                padding: '20px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                boxShadow: isDark
                    ? '0 16px 48px rgba(0, 0, 0, 0.7)'
                    : '0 16px 48px rgba(0, 0, 0, 0.45)',
                width: '260px',
                // Let height grow naturally to fit all nav items – no maxHeight clipping
                height: 'fit-content',
                transition: 'background 0.3s ease, border 0.3s ease',
                zIndex: 9999,
                boxSizing: 'border-box',
            }}>

                {/* Nav Items */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {filteredItems.map((item, idx) => {
                        const isActive = location.pathname === item.path || (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
                        return (
                            <div
                                key={idx}
                                onClick={() => navigate(item.path)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '15px',
                                    padding: '12px 16px',
                                    borderRadius: '14px',
                                    cursor: 'pointer',
                                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                    background: isActive ? 'rgba(200, 169, 110, 0.18)' : 'transparent',
                                    border: isActive ? '1px solid rgba(200, 169, 110, 0.35)' : '1px solid transparent',
                                    color: isActive ? '#C8A96E' : '#e2e8f0',
                                }}
                                onMouseOver={(e) => {
                                    if (!isActive) {
                                        e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                                        e.currentTarget.style.color = '#fff';
                                        e.currentTarget.style.transform = 'translateX(4px)';
                                    }
                                }}
                                onMouseOut={(e) => {
                                    if (!isActive) {
                                        e.currentTarget.style.background = 'transparent';
                                        e.currentTarget.style.color = '#e2e8f0';
                                        e.currentTarget.style.transform = 'translateX(0)';
                                    }
                                }}
                            >
                                <span style={{ fontSize: '20px', minWidth: '24px', textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
                                {/* Allow text to wrap to 2 lines — no ellipsis truncation */}
                                <span style={{
                                    fontSize: '14px',
                                    fontWeight: isActive ? '700' : '500',
                                    lineHeight: '1.35',
                                    fontFamily: "'Outfit', sans-serif",
                                    // Wrap naturally, max 2 lines
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden',
                                }}>
                                    {item.label}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Active Session outside the nav */}
            <div style={{
                position: 'fixed',
                left: '20px',
                bottom: '40px',
                background: isDark ? 'rgba(26, 12, 1, 0.92)' : 'rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: `1px solid ${isDark ? 'rgba(200, 169, 110, 0.15)' : 'rgba(0, 0, 0, 0.1)'}`,
                borderRadius: '16px',
                padding: '12px 16px',
                zIndex: 9999,
                width: '260px',
                boxSizing: 'border-box',
            }}>
                <div style={{ color: isDark ? '#94a3b8' : '#64748b', fontSize: '11px', marginBottom: '4px', letterSpacing: '0.5px' }}>Active Session</div>
                <div style={{ color: isDark ? '#f8fafc' : '#3D1C02', fontSize: '14px', fontWeight: '600' }}>
                    {role === 'admin' ? 'Administrator' : 'Warehouse Manager'}
                </div>
            </div>
        </>
    );
};

export default Sidebar;
