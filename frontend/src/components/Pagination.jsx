import React from 'react';

/**
 * Reusable Pagination Component
 * 
 * Props:
 *   currentPage  - current active page (1-indexed)
 *   totalPages   - total number of pages
 *   totalItems   - total number of records
 *   onPageChange - callback(newPage) when user clicks a page button
 *   isDark       - dark mode flag for theming
 */
const Pagination = ({ currentPage, totalPages, totalItems, onPageChange, isDark = false }) => {
    if (totalPages <= 1) return null;

    const textColor = isDark ? '#f1f5f9' : '#1e293b';
    const textMuted = isDark ? '#94a3b8' : '#64748b';
    const borderCol = isDark ? '#475569' : '#cbd5e1';
    const activeBg = isDark ? '#3b82f6' : '#2563eb';
    const hoverBg = isDark ? '#334155' : '#f1f5f9';

    // Generate page numbers to display (max 5 visible)
    const getPageNumbers = () => {
        const pages = [];
        let start = Math.max(1, currentPage - 2);
        let end = Math.min(totalPages, start + 4);
        
        // Adjust start if we're near the end
        if (end - start < 4) {
            start = Math.max(1, end - 4);
        }

        for (let i = start; i <= end; i++) {
            pages.push(i);
        }
        return pages;
    };

    const buttonBase = {
        border: `1px solid ${borderCol}`,
        borderRadius: '8px',
        padding: '8px 14px',
        cursor: 'pointer',
        fontWeight: 'bold',
        fontSize: '14px',
        transition: 'all 0.15s ease',
        minWidth: '40px',
        textAlign: 'center'
    };

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 24px',
            borderTop: `1px solid ${borderCol}`,
            flexWrap: 'wrap',
            gap: '12px'
        }}>
            {/* Record count */}
            <div style={{ fontSize: '14px', color: textMuted, fontWeight: '500' }}>
                Showing page {currentPage} of {totalPages} ({totalItems} total records)
            </div>

            {/* Page controls */}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                {/* Previous */}
                <button
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage <= 1}
                    style={{
                        ...buttonBase,
                        backgroundColor: currentPage <= 1 ? (isDark ? '#1e293b' : '#f8fafc') : 'transparent',
                        color: currentPage <= 1 ? (isDark ? '#475569' : '#cbd5e1') : textColor,
                        cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                        opacity: currentPage <= 1 ? 0.5 : 1
                    }}
                >
                    ← Prev
                </button>

                {/* First page + ellipsis */}
                {getPageNumbers()[0] > 1 && (
                    <>
                        <button
                            onClick={() => onPageChange(1)}
                            style={{
                                ...buttonBase,
                                backgroundColor: 'transparent',
                                color: textColor
                            }}
                        >
                            1
                        </button>
                        {getPageNumbers()[0] > 2 && (
                            <span style={{ color: textMuted, padding: '0 4px' }}>…</span>
                        )}
                    </>
                )}

                {/* Page numbers */}
                {getPageNumbers().map(page => (
                    <button
                        key={page}
                        onClick={() => onPageChange(page)}
                        style={{
                            ...buttonBase,
                            backgroundColor: page === currentPage ? activeBg : 'transparent',
                            color: page === currentPage ? '#ffffff' : textColor,
                            border: page === currentPage ? `1px solid ${activeBg}` : `1px solid ${borderCol}`,
                            boxShadow: page === currentPage ? '0 2px 4px rgba(37, 99, 235, 0.3)' : 'none'
                        }}
                    >
                        {page}
                    </button>
                ))}

                {/* Last page + ellipsis */}
                {getPageNumbers()[getPageNumbers().length - 1] < totalPages && (
                    <>
                        {getPageNumbers()[getPageNumbers().length - 1] < totalPages - 1 && (
                            <span style={{ color: textMuted, padding: '0 4px' }}>…</span>
                        )}
                        <button
                            onClick={() => onPageChange(totalPages)}
                            style={{
                                ...buttonBase,
                                backgroundColor: 'transparent',
                                color: textColor
                            }}
                        >
                            {totalPages}
                        </button>
                    </>
                )}

                {/* Next */}
                <button
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                    style={{
                        ...buttonBase,
                        backgroundColor: currentPage >= totalPages ? (isDark ? '#1e293b' : '#f8fafc') : 'transparent',
                        color: currentPage >= totalPages ? (isDark ? '#475569' : '#cbd5e1') : textColor,
                        cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                        opacity: currentPage >= totalPages ? 0.5 : 1
                    }}
                >
                    Next →
                </button>
            </div>
        </div>
    );
};

export default Pagination;
