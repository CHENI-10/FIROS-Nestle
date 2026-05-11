import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './GlobalSearch.css';

const GlobalSearch = () => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const [selectedBatch, setSelectedBatch] = useState(null);
    const dropdownRef = useRef(null);
    const navigate = useNavigate();

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            if (query.trim().length >= 3) {
                performSearch();
            } else {
                setResults([]);
                setShowDropdown(false);
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [query]);

    const performSearch = async () => {
        setIsSearching(true);
        try {
            const token = sessionStorage.getItem('token');
            const res = await axios.get(`/api/dashboard/search/${encodeURIComponent(query)}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setResults(res.data);
            setShowDropdown(true);
        } catch (error) {
            console.error('Search error:', error);
        } finally {
            setIsSearching(false);
        }
    };

    const handleSelectBatch = (batch) => {
        setSelectedBatch(batch);
        setShowDropdown(false);
        setQuery('');
    };

    const handleCloseModal = () => {
        setSelectedBatch(null);
    };

    const handleAction = async (actionType, batchId) => {
        const token = sessionStorage.getItem('token');
        try {
            if (actionType === 'clearance') {
                await axios.post('/api/dashboard/recommendations/action', 
                    { batch_id: batchId, action_type: 'clearance', reason: 'Manager-initiated from Omni-Search' },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                alert('Batch sent to clearance successfully!');
                setSelectedBatch(null);
            } else if (actionType === 'collect_dispatch') {
                await axios.patch(`/api/dashboard/dispatches/${batchId}/collect`, {}, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                alert('Marked as collected successfully!');
                setSelectedBatch(null);
            } else if (actionType === 'return') {
                // Navigate to returns with batch pre-filled (assuming return page can read state/url, or they just type it)
                navigate('/returns', { state: { batchId } });
                setSelectedBatch(null);
            }
        } catch (err) {
            console.error(err);
            alert('Failed to perform action: ' + (err.response?.data?.error || err.message));
        }
    };

    return (
        <div className="global-search-container" ref={dropdownRef}>
            <div className="search-input-wrapper">
                <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <input
                    type="text"
                    className="global-search-input"
                    placeholder="Search Batch ID or Barcode..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => { if (results.length > 0) setShowDropdown(true); }}
                />
            </div>

            {showDropdown && (
                <div className="search-results-dropdown">
                    {isSearching ? (
                        <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>Searching...</div>
                    ) : results.length === 0 ? (
                        <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>No batches found.</div>
                    ) : (
                        results.map(batch => (
                            <div key={batch.batch_id} className="search-result-item" onClick={() => handleSelectBatch(batch)}>
                                <div className="result-header">
                                    <span className="result-batch-id">{batch.batch_id}</span>
                                    <span className={`result-status status-${batch.status}`}>
                                        {batch.status.replace('_', ' ')}
                                    </span>
                                </div>
                                <div className="result-product">
                                    {batch.product_name} • EAN: {batch.ean13_barcode}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {selectedBatch && (
                <div className="batch-modal-overlay" onClick={handleCloseModal}>
                    <div className="batch-modal-content" onClick={e => e.stopPropagation()}>
                        <div className="batch-modal-header">
                            <h2>📦 Batch Passport: {selectedBatch.batch_id}</h2>
                            <button className="close-modal-btn" onClick={handleCloseModal}>×</button>
                        </div>
                        <div className="batch-modal-body">
                            <h3 style={{ marginTop: 0, color: 'var(--nestle-gold-main)' }}>{selectedBatch.product_name}</h3>
                            <div className="timeline">
                                
                                {/* Step 1: Inbound */}
                                <div className="timeline-event">
                                    <div className="timeline-dot active">1</div>
                                    <div className="timeline-content">
                                        <h4>📥 Inbound Details</h4>
                                        <p><strong>Mfg Date:</strong> {new Date(selectedBatch.manufacturing_date).toLocaleDateString()}</p>
                                        <p><strong>Arrival:</strong> {new Date(selectedBatch.arrival_timestamp).toLocaleString()}</p>
                                        <p><strong>Zone:</strong> {selectedBatch.zone_id}</p>
                                        <p><strong>Quantity:</strong> {selectedBatch.quantity}</p>
                                    </div>
                                </div>

                                {/* Step 2: Storage Health */}
                                <div className="timeline-event">
                                    <div className={`timeline-dot ${selectedBatch.status === 'in_storage' ? 'active' : ''}`}>2</div>
                                    <div className="timeline-content">
                                        <h4>🛡️ Storage Health</h4>
                                        {selectedBatch.frs_score !== null ? (
                                            <>
                                                <p><strong>FRS Score:</strong> {selectedBatch.frs_score}</p>
                                                <p><strong>Risk Band:</strong> <span style={{textTransform: 'uppercase'}}>{selectedBatch.risk_band}</span></p>
                                                <p><strong>Temp Breaches:</strong> {selectedBatch.total_temp_breach_windows}</p>
                                            </>
                                        ) : (
                                            <p>No health score generated yet.</p>
                                        )}
                                        {selectedBatch.status === 'in_storage' && selectedBatch.risk_band === 'high' && (
                                            <div className="timeline-action">
                                                <button className="action-btn" onClick={() => handleAction('clearance', selectedBatch.batch_id)}>
                                                    Send to Clearance
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Step 3: Outbound */}
                                {(selectedBatch.dispatch_timestamp || selectedBatch.cleared_at) && (
                                    <div className="timeline-event">
                                        <div className={`timeline-dot ${selectedBatch.status === 'dispatched' || selectedBatch.status === 'cleared' ? 'active' : ''}`}>3</div>
                                        <div className="timeline-content">
                                            <h4>📤 Outbound</h4>
                                            {selectedBatch.dispatch_timestamp ? (
                                                <>
                                                    <p><strong>Dispatched:</strong> {new Date(selectedBatch.dispatch_timestamp).toLocaleString()}</p>
                                                    <p><strong>To:</strong> {selectedBatch.dispatch_distributor_name}</p>
                                                    <p><strong>Collected:</strong> {selectedBatch.dispatch_collected ? 'Yes' : 'No'}</p>
                                                    {!selectedBatch.dispatch_collected && (
                                                        <div className="timeline-action">
                                                            <button className="action-btn" onClick={() => handleAction('collect_dispatch', selectedBatch.batch_id)}>
                                                                Mark as Collected
                                                            </button>
                                                        </div>
                                                    )}
                                                </>
                                            ) : (
                                                <>
                                                    <p><strong>Cleared:</strong> {new Date(selectedBatch.cleared_at).toLocaleString()}</p>
                                                    <p><strong>Reason:</strong> {selectedBatch.clearance_reason}</p>
                                                    <p><strong>To:</strong> {selectedBatch.clearance_distributor_name || 'N/A'}</p>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Step 4: Returns */}
                                {selectedBatch.status === 'returned' && (
                                    <div className="timeline-event">
                                        <div className="timeline-dot active">4</div>
                                        <div className="timeline-content" style={{ borderColor: 'var(--red)' }}>
                                            <h4>↩️ Return Record</h4>
                                            <p><strong>Returned On:</strong> {new Date(selectedBatch.returned_at).toLocaleString()}</p>
                                            <p><strong>Reason:</strong> {selectedBatch.return_reason}</p>
                                            <p><strong>Liability:</strong> {selectedBatch.liability_status}</p>
                                        </div>
                                    </div>
                                )}
                                
                                {/* Initiate Return Action if Dispatched & Collected */}
                                {(selectedBatch.status === 'dispatched' || selectedBatch.status === 'cleared') && selectedBatch.dispatch_collected && (
                                    <div className="timeline-event">
                                        <div className="timeline-dot">4</div>
                                        <div className="timeline-content">
                                            <h4>↩️ Returns</h4>
                                            <p>This batch has been collected by the distributor.</p>
                                            <div className="timeline-action">
                                                <button className="action-btn btn-outline" onClick={() => handleAction('return', selectedBatch.batch_id)}>
                                                    Initiate Return
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GlobalSearch;
