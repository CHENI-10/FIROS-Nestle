import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const Spinner = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', gap: '10px', color: '#64748b' }}>
    <div style={{ width: '20px', height: '20px', border: '3px solid #e2e8f0', borderTop: '3px solid #3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    Computing allocation scores...
  </div>
);

const ClearanceRecommendations = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [theme, setTheme] = useState(sessionStorage.getItem('theme') || 'light');
  const [batches, setBatches] = useState([]);
  const [batchQueue, setBatchQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [clearanceReason, setClearanceReason] = useState('');
  const [confirmCheck, setConfirmCheck] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Allocation modal state
  const [allocationLoading, setAllocationLoading] = useState(false);
  const [allocationData, setAllocationData] = useState(null);
  const [chosenDistributorId, setChosenDistributorId] = useState(null);
  const [overrideExpanded, setOverrideExpanded] = useState(false);
  const [overrideDistributorId, setOverrideDistributorId] = useState('');
  const [overrideReason, setOverrideReason] = useState('');

  const isDark = theme === 'dark';
  const bg = isDark ? '#0f172a' : '#f8fafc';
  const text = isDark ? '#f1f5f9' : '#1e293b';
  const card = isDark ? '#1e293b' : '#ffffff';
  const navBg = isDark ? '#1e293b' : '#3D1C02';
  const muted = isDark ? '#94a3b8' : '#64748b';
  const border = isDark ? '#334155' : '#e2e8f0';
  const inputBg = isDark ? '#334155' : '#ffffff';

  useEffect(() => { fetchData(); }, []);

  const token = () => sessionStorage.getItem('token');

  const fetchData = async () => {
    setLoading(true);
    const t = token();
    if (!t) { navigate('/login'); return; }
    try {
      const [recRes, queueRes] = await Promise.all([
        fetch('/api/dashboard/clearance-recommendations', { headers: { Authorization: `Bearer ${t}` } }),
        fetch('/api/allocation/batch-queue', { headers: { Authorization: `Bearer ${t}` } })
      ]);
      if (!recRes.ok) throw new Error('Failed to load batches');
      const recData = await recRes.json();
      const queueData = queueRes.ok ? await queueRes.json() : [];
      setBatches(recData);
      setBatchQueue(queueData);
      if (location.state?.autoSelectBatchId) {
        const found = recData.find(b => String(b.batch_id) === String(location.state.autoSelectBatchId));
        if (found) { setSelectedBatch(found); setClearanceReason(found.promotion_type || ''); window.history.replaceState({}, document.title); }
      }
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const getPromoColor = (type) => {
    if (type === 'Trade Discount') return '#3b82f6';
    if (type === 'Clearance Markdown') return '#8b5cf6';
    return '#ef4444';
  };

  const getQueueEntry = (batchId) => batchQueue.find(q => String(q.batchId) === String(batchId));

  const handleBatchSelect = (batch) => { setSelectedBatch(batch); setClearanceReason(batch.promotion_type || ''); };

  const openModal = async () => {
    if (!selectedBatch) return;
    setIsModalOpen(true);
    setAllocationData(null);
    setChosenDistributorId(null);
    setOverrideExpanded(false);
    setOverrideDistributorId('');
    setOverrideReason('');
    setConfirmCheck(false);
    setActionError('');
    setAllocationLoading(true);
    try {
      const res = await fetch(`/api/allocation/${selectedBatch.batch_id}`, { headers: { Authorization: `Bearer ${token()}` } });
      if (res.ok) {
        const data = await res.json();
        setAllocationData(data);
        setChosenDistributorId(data.recommendation?.distributorId ?? null);
      }
    } catch (e) { console.error(e); }
    finally { setAllocationLoading(false); }
  };

  const effectiveDistributorId = overrideExpanded && overrideDistributorId ? parseInt(overrideDistributorId) : chosenDistributorId;
  const isOverriding = overrideExpanded && overrideDistributorId && parseInt(overrideDistributorId) !== allocationData?.recommendation?.distributorId;

  const submitClearance = async () => {
    if (!effectiveDistributorId) { setActionError('Please select a distributor.'); return; }
    if (isOverriding && !overrideReason.trim()) { setActionError('Override reason is required.'); return; }
    if (!confirmCheck) { setActionError('You must confirm the clearance action.'); return; }
    setActionLoading(true); setActionError('');
    try {
      const res = await fetch(`/api/allocation/${selectedBatch.batch_id}/confirm`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chosenDistributorId: effectiveDistributorId,
          recommendedDistributorId: allocationData?.recommendation?.distributorId,
          overrideReason: isOverriding ? overrideReason : null,
          allocationScore: allocationData?.recommendation?.allocationScore,
          breakdown: allocationData?.recommendation?.breakdown,
          clearanceReason,
          discountApplied: selectedBatch.discount_percent
        })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || 'Failed');
      setSuccessMsg('Batch cleared and dispatched successfully!');
      setBatches(batches.filter(b => b.batch_id !== selectedBatch.batch_id));
      setSelectedBatch(null); setIsModalOpen(false);
      setTimeout(() => setSuccessMsg(''), 3500);
    } catch (err) { setActionError(err.message); }
    finally { setActionLoading(false); }
  };

  const scoreColor = (s) => { const v = parseFloat(s); if (v >= 75) return '#22c55e'; if (v >= 50) return '#f59e0b'; return '#ef4444'; };

  const BreakdownPill = ({ label, value, color }) => (
    <div style={{ textAlign: 'center', flex: 1 }}>
      <div style={{ fontSize: '11px', color: muted, textTransform: 'uppercase', fontWeight: '700', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '22px', fontWeight: 'bold', color }}>{value}</div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', backgroundColor: bg, color: text, fontFamily: 'inherit' }}>
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', backgroundColor: navBg, color: 'white' }}>
        <div style={{ fontWeight: 'bold', fontSize: '20px' }}>FIROS <span style={{ color: '#C8A96E', fontSize: '14px', marginLeft: '8px' }}>NESTLÉ LANKA</span></div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <button onClick={() => { const n = isDark ? 'light' : 'dark'; setTheme(n); sessionStorage.setItem('theme', n); }} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', fontSize: '18px' }}>{isDark ? '☀️' : '🌙'}</button>
          <button onClick={() => { sessionStorage.clear(); navigate('/login'); }} style={{ background: 'rgba(0,0,0,0.2)', border: 'none', color: 'white', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Logout</button>
        </div>
      </nav>

      <main style={{ padding: '32px 48px', maxWidth: '1400px', margin: '0 auto' }}>
        <button onClick={() => navigate('/dashboard')} style={{ background: 'transparent', border: 'none', color: isDark ? '#60a5fa' : '#2563eb', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', padding: 0 }}>← Back to Dashboard</button>
        <h1 style={{ margin: '0 0 4px 0', fontSize: '32px' }}>Clearance Recommendations</h1>
        <p style={{ margin: '0 0 32px 0', color: muted }}>AI-driven promotional guidance with Smart Distributor Allocation Engine.</p>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '64px', fontSize: '18px' }}>Analyzing inventory risks...</div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '64px', color: '#ef4444' }}>{error}</div>
        ) : batches.length === 0 ? (
          <div style={{ backgroundColor: card, padding: '64px', borderRadius: '12px', textAlign: 'center', border: `1px solid ${border}` }}>
            <h3>No Urgent Clearances Required</h3>
            <p style={{ color: muted }}>All stored batches are within acceptable freshness levels.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '32px', flexDirection: window.innerWidth < 1024 ? 'column' : 'row' }}>
            {/* LEFT PANEL */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '70vh', overflowY: 'auto', paddingRight: '8px' }}>
              {batches.map(batch => {
                const isSelected = selectedBatch?.batch_id === batch.batch_id;
                const qEntry = getQueueEntry(batch.batch_id);
                return (
                  <div key={batch.batch_id} onClick={() => handleBatchSelect(batch)} style={{ backgroundColor: card, borderRadius: '12px', padding: '20px 24px', cursor: 'pointer', border: `2px solid ${isSelected ? '#2563eb' : border}`, transition: 'all 0.2s', boxShadow: isSelected ? '0 10px 20px rgba(0,0,0,0.1)' : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                          <h3 style={{ margin: 0, fontSize: '17px' }}>{batch.product_name}</h3>
                          <span style={{ backgroundColor: isDark ? '#334155' : '#f1f5f9', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', color: muted }}>Zone {batch.zone_id}</span>
                        </div>
                        <div style={{ color: muted, fontSize: '13px', marginBottom: '12px' }}>
                          Batch: {batch.batch_id} | Days in WH: {batch.days_in_warehouse} | Expiry: {new Date(batch.expiry_date).toLocaleDateString()}
                        </div>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '5px 10px', borderRadius: '6px', fontWeight: 'bold', fontSize: '13px' }}>FRS: {Number(batch.frs_score).toFixed(1)}</span>
                          <span style={{ backgroundColor: `${getPromoColor(batch.promotion_type)}20`, color: getPromoColor(batch.promotion_type), padding: '5px 10px', borderRadius: '6px', fontWeight: 'bold', fontSize: '13px' }}>{batch.promotion_type}</span>
                          {qEntry && (
                            <span style={{ backgroundColor: 'rgba(34,197,94,0.1)', color: '#22c55e', padding: '5px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold' }}>
                              ★ {qEntry.recommendedDistributor?.distributorName} ({qEntry.recommendedDistributor?.distributorRegion}) — {qEntry.recommendedDistributor?.allocationScore}
                              {qEntry.allocationRank > 1 && <span style={{ color: muted, fontWeight: 'normal', marginLeft: '4px' }}> · rank {qEntry.allocationRank} pick</span>}
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', marginLeft: '16px' }}>
                        <div style={{ fontSize: '11px', color: muted, fontWeight: 'bold', textTransform: 'uppercase' }}>Discount</div>
                        <div style={{ fontSize: '32px', fontWeight: '900', lineHeight: 1 }}>{batch.discount_percent}%</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* RIGHT PANEL */}
            <div style={{ flex: 1 }}>
              {selectedBatch ? (
                <div style={{ backgroundColor: card, borderRadius: '12px', padding: '32px', border: `1px solid ${border}`, position: 'sticky', top: '32px' }}>
                  <h2 style={{ margin: '0 0 20px 0', borderBottom: `1px solid ${border}`, paddingBottom: '16px' }}>Recommendation Analysis</h2>
                  <div style={{ backgroundColor: isDark ? '#0f172a' : '#f8fafc', padding: '20px', borderRadius: '8px', borderLeft: `4px solid ${getPromoColor(selectedBatch.promotion_type)}`, marginBottom: '24px', fontSize: '15px', lineHeight: '1.6', fontWeight: '500' }}>
                    "{selectedBatch.rationale}"
                  </div>
                  <div style={{ marginBottom: '24px' }}>
                    <div style={{ fontSize: '12px', textTransform: 'uppercase', color: muted, fontWeight: 'bold', marginBottom: '6px' }}>Recommended Action</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold' }}>Launch <span style={{ color: getPromoColor(selectedBatch.promotion_type) }}>{selectedBatch.promotion_type}</span> strategy</div>
                  </div>
                  <button onClick={openModal} style={{ width: '100%', padding: '16px', borderRadius: '8px', border: 'none', backgroundColor: '#10b981', color: '#fff', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>
                    Approve Clearance
                  </button>
                </div>
              ) : (
                <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: muted, border: `2px dashed ${border}`, borderRadius: '12px' }}>
                  Select a high-risk batch to view clearance analysis.
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* MODAL */}
      {isModalOpen && selectedBatch && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ backgroundColor: card, width: '100%', maxWidth: '560px', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 25px 60px rgba(0,0,0,0.4)', border: `1px solid ${border}`, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ backgroundColor: navBg, padding: '20px 24px', color: 'white' }}>
              <h3 style={{ margin: 0, fontSize: '18px' }}>Approve Clearance — {selectedBatch.product_name}</h3>
            </div>
            <div style={{ padding: '24px' }}>
              {/* Batch summary */}
              <div style={{ display: 'flex', justifyContent: 'space-between', backgroundColor: isDark ? '#0f172a' : '#f8fafc', padding: '14px 16px', borderRadius: '8px', marginBottom: '20px' }}>
                <div><div style={{ fontSize: '11px', color: muted, fontWeight: 'bold' }}>BATCH ID</div><div style={{ fontWeight: 'bold' }}>{selectedBatch.batch_id}</div></div>
                <div><div style={{ fontSize: '11px', color: muted, fontWeight: 'bold' }}>FRS SCORE</div><div style={{ fontWeight: 'bold', color: '#ef4444' }}>{Number(selectedBatch.frs_score).toFixed(1)}</div></div>
                <div style={{ textAlign: 'right' }}><div style={{ fontSize: '11px', color: muted, fontWeight: 'bold' }}>PROMO DISCOUNT</div><div style={{ fontWeight: 'bold', color: getPromoColor(selectedBatch.promotion_type) }}>{selectedBatch.discount_percent}% OFF</div></div>
              </div>

              {/* Allocation Section */}
              {allocationLoading ? <Spinner /> : allocationData ? (
                <div style={{ marginBottom: '20px' }}>
                  {/* Recommended card */}
                  <div style={{ border: `2px solid ${isOverriding ? '#f59e0b' : '#22c55e'}`, borderRadius: '10px', padding: '16px', marginBottom: '12px', position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <span style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: '#22c55e', letterSpacing: '0.5px' }}>★ Recommended Distributor</span>
                      {isOverriding && <span style={{ fontSize: '11px', fontWeight: 'bold', backgroundColor: '#94a3b820', color: '#94a3b8', padding: '2px 8px', borderRadius: '12px' }}>OVERRIDDEN</span>}
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: text, marginBottom: '2px' }}>{allocationData.recommendation.distributorName}</div>
                    <div style={{ fontSize: '13px', color: muted, marginBottom: '12px' }}>Region: {allocationData.recommendation.distributorRegion} &nbsp;|&nbsp; Allocation Score: <strong style={{ color: scoreColor(allocationData.recommendation.allocationScore) }}>{allocationData.recommendation.allocationScore}</strong></div>
                    <div style={{ display: 'flex', gap: '8px', borderTop: `1px solid ${border}`, paddingTop: '12px' }}>
                      <BreakdownPill label="Performance" value={allocationData.recommendation.breakdown.performanceScore} color="#3b82f6" />
                      <BreakdownPill label="Velocity" value={allocationData.recommendation.breakdown.velocityScore} color="#8b5cf6" />
                      <BreakdownPill label="Urgency" value={allocationData.recommendation.breakdown.urgencyScore} color="#22c55e" />
                    </div>
                    {allocationData.recommendation.breakdown.fallbackMode && (
                      <div style={{ marginTop: '10px', backgroundColor: '#fef3c720', border: '1px solid #f59e0b', borderRadius: '6px', padding: '8px 12px', fontSize: '12px', color: '#92400e' }}>
                        ⚠ No sales rep reports submitted yet. Score based on performance + urgency only.
                      </div>
                    )}
                    {!allocationData.recommendation.breakdown.fallbackMode && allocationData.recommendation.breakdown.velocityDefaulted && (
                      <div style={{ marginTop: '10px', backgroundColor: '#fef3c720', border: '1px solid #f59e0b', borderRadius: '6px', padding: '8px 12px', fontSize: '12px', color: '#92400e' }}>
                        ⚠ No recent sales data for this SKU in this region. Velocity defaulted to 50.
                      </div>
                    )}
                  </div>

                  {/* Accept button */}
                  {!overrideExpanded && (
                    <button onClick={() => { setChosenDistributorId(allocationData.recommendation.distributorId); setOverrideExpanded(false); }} style={{ width: '100%', padding: '11px', borderRadius: '8px', border: '2px solid #22c55e', backgroundColor: chosenDistributorId === allocationData.recommendation.distributorId ? '#22c55e' : 'transparent', color: chosenDistributorId === allocationData.recommendation.distributorId ? 'white' : '#22c55e', fontWeight: 'bold', cursor: 'pointer', marginBottom: '10px' }}>
                      ✓ Accept Recommendation
                    </button>
                  )}

                  {/* Override toggle */}
                  <button onClick={() => setOverrideExpanded(!overrideExpanded)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: `1px solid ${border}`, backgroundColor: 'transparent', color: muted, fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}>
                    Override Distributor {overrideExpanded ? '▲' : '▼'}
                  </button>

                  {overrideExpanded && (
                    <div style={{ marginTop: '12px', padding: '14px', border: `1px solid #f59e0b`, borderRadius: '8px', backgroundColor: isDark ? '#1c1a0a' : '#fffbeb' }}>
                      <label style={{ display: 'block', fontWeight: 'bold', fontSize: '13px', marginBottom: '6px' }}>Select Override Distributor</label>
                      <select value={overrideDistributorId} onChange={e => setOverrideDistributorId(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: `1px solid ${border}`, backgroundColor: inputBg, color: text, marginBottom: '12px', boxSizing: 'border-box' }}>
                        <option value="">-- Select distributor --</option>
                        {allocationData.allDistributors.map(d => (
                          <option key={d.distributorId} value={d.distributorId}>{d.distributorName} ({d.distributorRegion}) — Score: {d.allocationScore}</option>
                        ))}
                      </select>
                      {overrideDistributorId && parseInt(overrideDistributorId) !== allocationData.recommendation.distributorId && (
                        <>
                          <label style={{ display: 'block', fontWeight: 'bold', fontSize: '13px', marginBottom: '6px' }}>Override Reason <span style={{ color: '#ef4444' }}>*</span></label>
                          <input type="text" value={overrideReason} onChange={e => setOverrideReason(e.target.value)} placeholder="Explain why you are overriding the recommendation..." style={{ width: '100%', padding: '10px', borderRadius: '6px', border: `1px solid ${border}`, backgroundColor: inputBg, color: text, boxSizing: 'border-box' }} />
                        </>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>
                  Could not load allocation data. You can still proceed manually.
                </div>
              )}

              {/* Clearance reason */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px' }}>Clearance Reason</label>
                <input type="text" value={clearanceReason} onChange={e => setClearanceReason(e.target.value)} style={{ width: '100%', padding: '11px', borderRadius: '8px', border: `1px solid ${border}`, backgroundColor: inputBg, color: text, boxSizing: 'border-box' }} />
              </div>

              {/* Confirm checkbox */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '20px' }}>
                <input type="checkbox" id="confirmClearance" checked={confirmCheck} onChange={e => setConfirmCheck(e.target.checked)} style={{ marginTop: '3px', width: '16px', height: '16px', cursor: 'pointer' }} />
                <label htmlFor="confirmClearance" style={{ fontSize: '13px', color: muted, cursor: 'pointer', lineHeight: '1.4' }}>
                  I confirm this clearance is final and the batch will be marked as Cleared, removing it from standard inventory.
                </label>
              </div>

              {actionError && <div style={{ color: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)', padding: '10px 14px', borderRadius: '6px', marginBottom: '14px', fontSize: '13px', fontWeight: 'bold' }}>{actionError}</div>}

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button onClick={() => setIsModalOpen(false)} style={{ padding: '12px 20px', borderRadius: '8px', border: `1px solid ${border}`, backgroundColor: 'transparent', color: text, fontWeight: 'bold', cursor: 'pointer' }}>Cancel</button>
                <button onClick={submitClearance} disabled={actionLoading} style={{ padding: '12px 20px', borderRadius: '8px', border: 'none', backgroundColor: isOverriding ? '#f59e0b' : '#ef4444', color: 'white', fontWeight: 'bold', cursor: actionLoading ? 'wait' : 'pointer', opacity: actionLoading ? 0.7 : 1 }}>
                  {actionLoading ? 'Processing...' : isOverriding ? 'Confirm with Override' : 'Confirm Clearance'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {successMsg && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', backgroundColor: '#10b981', color: 'white', padding: '16px 24px', borderRadius: '8px', fontWeight: 'bold', boxShadow: '0 10px 20px rgba(0,0,0,0.15)', zIndex: 2000, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span>✓</span> {successMsg}
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default ClearanceRecommendations;
