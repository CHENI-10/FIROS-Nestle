import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const MarketIntelligenceReportDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(false);

  const fetchReport = async () => {
    try {
      const token = sessionStorage.getItem('token');
      const response = await fetch(`/api/manager/reports/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setReport(data);
      } else {
        alert('Report not found');
        navigate('/dashboard/market-intelligence');
      }
    } catch (error) {
      console.error('Error fetching report detail:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [id]);

  const handleReview = async () => {
    setReviewing(true);
    try {
      const token = sessionStorage.getItem('token');
      const response = await fetch(`/api/manager/reports/${id}/review`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const { data } = await response.json();
        setReport(prev => ({ ...prev, status: data.status, reviewedAt: data.reviewed_at }));
      } else {
        alert('Failed to mark as reviewed');
      }
    } catch (error) {
      console.error('Error reviewing report:', error);
    } finally {
      setReviewing(false);
    }
  };

  const getProductImage = (name) => {
    const lower = name.toLowerCase();
    if (lower.includes('milo')) return '/images/milo.png';
    if (lower.includes('nestomalt')) return '/images/nestomalt.png';
    if (lower.includes('nescafe')) return '/images/nescafe.png';
    if (lower.includes('maggi')) return '/images/maggi.png';
    return 'https://via.placeholder.com/100x100.png?text=Product';
  };

  const renderSpeedBadge = (speed) => {
    if (speed === 3) return <span style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>Fast</span>;
    if (speed === 2) return <span style={{ backgroundColor: '#fef3c7', color: '#b45309', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>Normal</span>;
    if (speed === 1) return <span style={{ backgroundColor: '#f1f5f9', color: '#64748b', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>Slow</span>;
    return <span>-</span>;
  };

  const renderStockIcon = (level) => {
    if (level === 'high') return <span style={{ color: '#22c55e', fontSize: '16px' }}>▲ High</span>;
    if (level === 'in_stock') return <span style={{ color: '#f59e0b', fontSize: '16px' }}>◮ Med</span>;
    if (level === 'low') return <span style={{ color: '#ef4444', fontSize: '16px' }}>△ Low</span>;
    return <span>-</span>;
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading report details...</div>;
  if (!report) return null;

  const emptyShelves = report.lineItems.filter(item => item.isEmptyShelf);
  const totalProducts = report.lineItems.length;

  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '40px 5%', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      
      <button 
        onClick={() => navigate('/dashboard/market-intelligence')}
        style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', fontSize: '14px', fontWeight: 'bold' }}
      >
        &larr; Back to Reports
      </button>

      {/* HEADER SECTION */}
      <div style={{ backgroundColor: '#fff', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px', position: 'relative' }}>
        <div style={{ position: 'absolute', top: '24px', right: '24px', display: 'flex', gap: '12px' }}>
          <button style={{ padding: '8px 16px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', color: '#475569', fontWeight: 'bold', fontSize: '13px' }}>Export as PDF</button>
        </div>

        <h1 style={{ color: '#1a3a5c', margin: '0 0 8px 0', fontSize: '28px' }}>{report.retailerName}</h1>
        <div style={{ display: 'inline-block', backgroundColor: '#f1f5f9', color: '#64748b', padding: '4px 12px', borderRadius: '16px', fontSize: '13px', fontWeight: 'bold', marginBottom: '16px' }}>{report.region}</div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', color: '#475569', fontSize: '14px' }}>
          <div><strong>Submitted by:</strong> {report.repName}</div>
          <div><strong>Audit Date:</strong> {new Date(report.auditDate).toLocaleDateString()}</div>
          <div><strong>Distributor:</strong> {report.distributorName}</div>
          <div><strong>Submitted at:</strong> {new Date(report.submittedAt).toLocaleString()}</div>
        </div>
      </div>

      {/* SUMMARY STAT CARDS */}
      <div style={{ display: 'flex', gap: '20px', marginBottom: '24px' }}>
        <div style={{ flex: 1, backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #1a3a5c' }}>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#1e293b', marginBottom: '4px' }}>{totalProducts}</div>
          <div style={{ fontSize: '13px', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>Total Products Scanned</div>
        </div>
        <div style={{ flex: 1, backgroundColor: emptyShelves.length > 0 ? '#fef2f2' : '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: `4px solid ${emptyShelves.length > 0 ? '#ef4444' : '#22c55e'}` }}>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: emptyShelves.length > 0 ? '#ef4444' : '#1e293b', marginBottom: '4px' }}>{emptyShelves.length}</div>
          <div style={{ fontSize: '13px', color: emptyShelves.length > 0 ? '#ef4444' : '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>Empty Shelves</div>
        </div>
      </div>

      {/* EMPTY SHELF ALERTS SECTION */}
      {emptyShelves.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <h2 style={{ margin: 0, color: '#1a3a5c', fontSize: '20px' }}>Empty Shelf Alerts</h2>
            <span style={{ backgroundColor: '#ef4444', color: '#fff', padding: '4px 10px', borderRadius: '16px', fontSize: '12px', fontWeight: 'bold' }}>Action Required</span>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
            {emptyShelves.map(item => (
              <div key={item.sku} style={{ backgroundColor: '#fff', border: '1px solid #fca5a5', borderRadius: '8px', padding: '16px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 2px 4px rgba(239, 68, 68, 0.1)' }}>
                <img src={getProductImage(item.productName)} alt={item.productName} style={{ width: '60px', height: '60px', objectFit: 'contain', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold', color: '#1e293b', fontSize: '15px' }}>{item.productName}</div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>{item.category} • SKU: {item.sku}</div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ backgroundColor: '#fef2f2', color: '#ef4444', border: '1px solid #fca5a5', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>EMPTY</span>
                    <span style={{ backgroundColor: '#f1f5f9', color: '#475569', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>Urgency: {item.movementScoreFinal}</span>
                    {item.urgencyBonusApplied && (
                      <span style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>Bonus Applied</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PRODUCT TABLE SECTION */}
      <div style={{ backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px', overflow: 'hidden' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #e2e8f0' }}>
          <h2 style={{ margin: 0, color: '#1a3a5c', fontSize: '20px' }}>All Products Audited</h2>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', color: '#64748b', fontSize: '13px', textTransform: 'uppercase' }}>
                <th style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>Product</th>
                <th style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>SKU</th>
                <th style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>Category</th>
                <th style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>Movement Speed</th>
                <th style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>Stock Level</th>
                <th style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>Score</th>
                <th style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>Urgency Bonus</th>
              </tr>
            </thead>
            <tbody>
              {report.lineItems.map(item => (
                <tr key={item.sku} style={{ backgroundColor: item.isEmptyShelf ? '#fef2f2' : '#fff', borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '16px 20px', fontWeight: 'bold', color: item.isEmptyShelf ? '#ef4444' : '#1e293b' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <img src={getProductImage(item.productName)} alt="" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
                      {item.productName}
                    </div>
                  </td>
                  <td style={{ padding: '16px 20px', color: '#64748b', fontSize: '14px' }}>{item.sku}</td>
                  <td style={{ padding: '16px 20px', color: '#64748b', fontSize: '14px' }}>{item.category}</td>
                  <td style={{ padding: '16px 20px' }}>{renderSpeedBadge(item.movementSpeedRaw)}</td>
                  <td style={{ padding: '16px 20px' }}>{item.isEmptyShelf ? <span style={{ color: '#ef4444', fontWeight: 'bold' }}>EMPTY</span> : renderStockIcon(item.shelfAvailability)}</td>
                  <td style={{ padding: '16px 20px', fontWeight: 'bold', color: '#1a3a5c' }}>{item.movementScoreFinal}</td>
                  <td style={{ padding: '16px 20px' }}>{item.urgencyBonusApplied ? <span style={{ color: '#22c55e', fontWeight: 'bold' }}>✓</span> : <span style={{ color: '#cbd5e1' }}>—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* OBSERVATIONS SECTION */}
      {report.notes && (
        <div style={{ backgroundColor: '#fff', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '32px' }}>
          <h2 style={{ margin: '0 0 16px 0', color: '#1a3a5c', fontSize: '18px' }}>Rep Observations</h2>
          <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '6px', color: '#475569', fontSize: '14px', lineHeight: '1.6', border: '1px solid #e2e8f0', whiteSpace: 'pre-wrap' }}>
            {report.notes}
          </div>
        </div>
      )}

      {/* MARK AS REVIEWED BUTTON */}
      <button 
        onClick={handleReview}
        disabled={report.status === 'reviewed' || reviewing}
        style={{
          width: '100%',
          padding: '16px',
          backgroundColor: report.status === 'reviewed' ? '#94a3b8' : '#1a3a5c',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          fontSize: '16px',
          fontWeight: 'bold',
          cursor: report.status === 'reviewed' ? 'not-allowed' : 'pointer',
          transition: '0.2s'
        }}
      >
        {reviewing ? 'Updating...' : report.status === 'reviewed' ? '✓ Reviewed' : 'Mark as Reviewed'}
      </button>
      
      {report.status === 'reviewed' && (
        <p style={{ textAlign: 'center', color: '#64748b', fontSize: '13px', marginTop: '12px' }}>
          Reviewed on {new Date(report.reviewedAt).toLocaleString()}
        </p>
      )}

      </div>
    </div>
  );
};

export default MarketIntelligenceReportDetail;
