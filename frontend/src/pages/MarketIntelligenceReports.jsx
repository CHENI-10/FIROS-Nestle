import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const MarketIntelligenceReports = () => {
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [region, setRegion] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');

  const fetchReports = async () => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem('token');
      let url = '/api/manager/reports?';
      if (region !== 'All') url += `region=${region}&`;
      if (dateFrom) url += `from=${dateFrom}&`;
      if (dateTo) url += `to=${dateTo}&`;
      if (search) url += `search=${search}&`;

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setReports(data);
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [region, dateFrom, dateTo, search]);

  const totalReports = reports.length;
  const totalEmptyShelves = reports.reduce((acc, r) => acc + parseInt(r.emptyShelvesCount || 0, 10), 0);
  const distinctRegions = new Set(reports.map(r => r.region)).size;

  const isNew = (submittedAt) => {
    const hours = Math.abs(new Date() - new Date(submittedAt)) / 36e5;
    return hours < 24;
  };

  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '40px 5%', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      
      <button 
        onClick={() => navigate('/dashboard')}
        style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontSize: '14px', fontWeight: 'bold' }}
      >
        &larr; Back to Dashboard
      </button>

      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ color: '#1a3a5c', margin: '0 0 8px 0', fontSize: '24px' }}>Market Intelligence Reports</h1>
          <p style={{ color: '#64748b', margin: 0, fontSize: '14px' }}>Field audit submissions from sales reps</p>
        </div>
        
        {/* FILTER BAR */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <select 
            value={region} 
            onChange={e => setRegion(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', color: '#1e293b' }}
          >
            <option value="All">All Regions</option>
            <option value="Colombo">Colombo</option>
            <option value="Kandy">Kandy</option>
            <option value="Galle">Galle</option>
            <option value="Jaffna">Jaffna</option>
            <option value="Kurunegala">Kurunegala</option>
          </select>
          <input 
            type="date" 
            value={dateFrom} 
            onChange={e => setDateFrom(e.target.value)} 
            style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', color: '#1e293b' }}
          />
          <input 
            type="date" 
            value={dateTo} 
            onChange={e => setDateTo(e.target.value)} 
            style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', color: '#1e293b' }}
          />
          <input 
            type="text" 
            placeholder="Search rep or retailer..." 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', color: '#1e293b' }}
          />
        </div>
      </div>

      {/* SUMMARY STAT CARDS */}
      <div style={{ display: 'flex', gap: '20px', marginBottom: '32px', flexWrap: 'wrap' }}>
        {[
          { label: 'Total Reports', value: totalReports, color: '#1a3a5c' },
          { label: 'Empty Shelf Alerts', value: totalEmptyShelves, color: '#ef4444' },
          { label: 'Regions Covered', value: distinctRegions, color: '#22c55e' }
        ].map((stat, i) => (
          <div key={i} style={{ flex: '1 1 200px', backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: `4px solid ${stat.color}` }}>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#1e293b', marginBottom: '4px' }}>{stat.value}</div>
            <div style={{ fontSize: '13px', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* REPORT LIST */}
      {loading ? (
        <p>Loading reports...</p>
      ) : reports.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', backgroundColor: '#fff', borderRadius: '8px', color: '#64748b' }}>No reports found matching your criteria.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {reports.map(report => (
            <div 
              key={report.reportId} 
              onClick={() => navigate(`/dashboard/market-intelligence/${report.reportId}`)}
              style={{ 
                backgroundColor: '#fff', 
                borderRadius: '8px', 
                padding: '20px', 
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)', 
                cursor: 'pointer',
                border: '1px solid #e2e8f0',
                transition: 'transform 0.2s',
                position: 'relative'
              }}
              onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              {parseInt(report.emptyShelvesCount) > 0 && (
                <div style={{ position: 'absolute', top: '-6px', right: '-6px', width: '16px', height: '16px', backgroundColor: '#ef4444', borderRadius: '50%', border: '2px solid #fff' }}></div>
              )}
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#e2e8f0', color: '#1a3a5c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '16px' }}>
                    {report.repName ? report.repName.charAt(0).toUpperCase() : 'R'}
                  </div>
                  <div>
                    <div style={{ fontWeight: 'bold', color: '#1e293b', fontSize: '15px' }}>{report.repName}</div>
                    <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>{report.region}</span>
                    </div>
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '8px', flexDirection: 'column', alignItems: 'flex-end' }}>
                  {isNew(report.submittedAt) && <span style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}>NEW</span>}
                  {report.status === 'reviewed' && <span style={{ backgroundColor: '#f1f5f9', color: '#64748b', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}>REVIEWED</span>}
                </div>
              </div>

              <div style={{ marginBottom: '16px', color: '#475569', fontSize: '13px', lineHeight: '1.6' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '16px', textAlign: 'center' }}>🏪</span> <strong>{report.retailerName}</strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '16px', textAlign: 'center' }}>🚚</span> {report.distributorName}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '16px', textAlign: 'center' }}>📅</span> Audited: {new Date(report.auditDate).toLocaleDateString()}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '12px', marginTop: '4px' }}>
                  <span style={{ width: '16px', textAlign: 'center' }}>🕒</span> Submitted: {new Date(report.submittedAt).toLocaleString()}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: '12px', fontSize: '13px', fontWeight: '600', color: '#64748b' }}>
                <span>{report.totalProducts} products</span>
                <span style={{ color: parseInt(report.emptyShelvesCount) > 0 ? '#ef4444' : '#64748b' }}>{report.emptyShelvesCount} empty shelves</span>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  );
};

export default MarketIntelligenceReports;
