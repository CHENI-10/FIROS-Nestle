import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot } from 'recharts';

const DistributorScorecardDetail = () => {
  const { distributorId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const token = sessionStorage.getItem('token');
      const response = await fetch(`/api/scorecard/${distributorId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setData(await response.json());
      }
    } catch (error) {
      console.error('Error fetching scorecard detail:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const intervalId = setInterval(fetchData, 60000);
    return () => clearInterval(intervalId);
  }, [distributorId]);

  if (loading) return <div style={{ padding: '60px', textAlign: 'center', fontFamily: 'sans-serif', color: '#64748b' }}>Loading scorecard...</div>;
  if (!data) return <div style={{ padding: '60px', textAlign: 'center', fontFamily: 'sans-serif', color: '#64748b' }}>Distributor not found.</div>;

  const { distributorName, region, metrics, historicalTrend, recentDispatches, recentReturns, regionMovementSpeeds } = data;

  const getColor = (value, type) => {
    const v = parseFloat(value);
    if (type === 'frs') {
      if (v >= 75) return '#22c55e';
      if (v >= 50) return '#f59e0b';
      return '#ef4444';
    }
    if (type === 'return') {
      if (v < 10) return '#22c55e';
      if (v <= 25) return '#f59e0b';
      return '#ef4444';
    }
    if (type === 'rejection') {
      if (v < 15) return '#22c55e';
      if (v <= 35) return '#f59e0b';
      return '#ef4444';
    }
    if (type === 'delay') {
      if (v < 2) return '#22c55e';
      if (v <= 5) return '#f59e0b';
      return '#ef4444';
    }
    if (type === 'overall') {
      if (v >= 80) return '#22c55e';
      if (v >= 60) return '#f59e0b';
      return '#ef4444';
    }
    return '#1e293b';
  };

  const getMovementColor = (v) => {
    if (v > 2.5) return '#22c55e';
    if (v >= 1.5) return '#f59e0b';
    return '#ef4444';
  };

  const renderTrend = (trend) => {
    if (trend === 'up') return <span style={{ color: '#22c55e', fontWeight: 'bold' }}>↑</span>;
    if (trend === 'down') return <span style={{ color: '#ef4444', fontWeight: 'bold' }}>↓</span>;
    return <span style={{ color: '#94a3b8', fontWeight: 'bold' }}>→</span>;
  };

  const chartData = [
    ...historicalTrend.map(h => ({ period: h.period_label, score: parseFloat(h.overall_score) })),
    { period: 'Live', score: parseFloat(metrics.overallScore) }
  ];

  const metricCards = [
    { label: 'Overall Score', value: metrics.overallScore, suffix: '', type: 'overall', note: 'Composite score' },
    { label: 'Avg FRS at Dispatch', value: metrics.avgFrsAtDispatch, suffix: '', type: 'frs', note: 'Higher is better' },
    { label: 'Return Rate', value: metrics.returnRate, suffix: '%', type: 'return', note: 'Lower is better' },
    { label: 'Rejection Rate', value: metrics.returnRejectionRate, suffix: '%', type: 'rejection', note: 'Lower is better' },
    { label: 'Avg Collection Delay', value: metrics.avgCollectionDelayDays, suffix: 'd', type: 'delay', note: 'Lower is better' },
  ];

  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '40px 5%', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>

        <button
          onClick={() => navigate('/dashboard/scorecard')}
          style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', fontSize: '14px', fontWeight: 'bold' }}
        >
          &larr; Back to Scorecards
        </button>

        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ color: '#1a3a5c', margin: '0 0 4px 0', fontSize: '30px' }}>{distributorName}</h1>
            <span style={{ fontSize: '14px', color: '#64748b' }}>{region}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '22px' }}>{renderTrend(metrics.scoreTrend)}</span>
            <div style={{
              backgroundColor: getColor(metrics.overallScore, 'overall'),
              color: 'white', padding: '10px 24px', borderRadius: '24px',
              fontSize: '26px', fontWeight: 'bold'
            }}>
              {metrics.overallScore}
            </div>
          </div>
        </div>

        {/* METRIC CARDS */}
        <div style={{ display: 'flex', overflowX: 'auto', gap: '20px', paddingBottom: '16px', marginBottom: '32px' }}>
          {metricCards.map((card, i) => (
            <div key={i} style={{
              minWidth: '200px', flex: '1 1 180px', backgroundColor: '#fff', padding: '20px',
              borderRadius: '10px', border: '1px solid #e2e8f0',
              borderLeft: `5px solid ${getColor(card.value, card.type)}`
            }}>
              <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700', marginBottom: '8px', letterSpacing: '0.5px' }}>{card.label}</div>
              <div style={{ fontSize: '30px', fontWeight: 'bold', color: getColor(card.value, card.type), marginBottom: '6px' }}>
                {card.value}{card.suffix}
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>{card.note}</div>
            </div>
          ))}
        </div>

        {/* TREND CHART & REGIONS */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginBottom: '32px' }}>

          <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '24px' }}>
            <h3 style={{ color: '#1a3a5c', marginTop: 0, marginBottom: '24px', fontSize: '16px' }}>Overall Score Trend</h3>
            {chartData.length <= 1 ? (
              <div style={{ height: '250px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                No historical data yet.
              </div>
            ) : (
              <div style={{ height: '280px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="period" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      itemStyle={{ color: '#1a3a5c', fontWeight: 'bold' }}
                    />
                    <Line
                      type="monotone" dataKey="score" stroke="#1a3a5c" strokeWidth={3}
                      dot={{ r: 4, fill: '#1a3a5c', strokeWidth: 0 }}
                      activeDot={{ r: 6, fill: '#22c55e', strokeWidth: 0 }}
                    />
                    <ReferenceDot x="Live" y={parseFloat(metrics.overallScore)} r={6} fill={getColor(metrics.overallScore, 'overall')} stroke="none" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '24px', overflowY: 'auto', maxHeight: '380px' }}>
            <h3 style={{ color: '#1a3a5c', marginTop: 0, marginBottom: '16px', fontSize: '16px' }}>Region Movement Speeds</h3>
            {regionMovementSpeeds.length === 0 ? (
              <div style={{ color: '#64748b', fontSize: '14px' }}>No field data available.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {regionMovementSpeeds.map((r, i) => {
                  const score = parseFloat(r.avgMovementScore) || 0;
                  return (
                    <div key={i} style={{ padding: '12px', border: '1px solid #f1f5f9', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 'bold', color: '#1e293b', fontSize: '14px' }}>{r.region}</div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                          {r.latestReportDate ? new Date(r.latestReportDate).toLocaleDateString() : 'N/A'}
                        </div>
                      </div>
                      <span style={{ fontWeight: 'bold', color: getMovementColor(score), fontSize: '16px' }}>{score.toFixed(1)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* RECENT TABLES */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>

          <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
              <h3 style={{ margin: 0, color: '#1a3a5c', fontSize: '15px' }}>Recent Dispatches</h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    {['Date', 'Batch', 'FRS', 'Status'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', fontSize: '12px', color: '#64748b', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentDispatches.length === 0 ? (
                    <tr><td colSpan="4" style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>No recent dispatches</td></tr>
                  ) : recentDispatches.map(d => (
                    <tr key={d.dispatchId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: '#475569' }}>{new Date(d.date).toLocaleDateString()}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: '#1e293b', fontWeight: '500' }}>{d.batchId}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 'bold', color: getColor(d.frs, 'frs') }}>{d.frs}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold',
                          backgroundColor: d.status === 'collected' ? '#dcfce7' : '#f1f5f9',
                          color: d.status === 'collected' ? '#166534' : '#475569'
                        }}>
                          {d.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
              <h3 style={{ margin: 0, color: '#1a3a5c', fontSize: '15px' }}>Recent Returns</h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    {['Date', 'Reason', 'Decision'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', fontSize: '12px', color: '#64748b', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentReturns.length === 0 ? (
                    <tr><td colSpan="3" style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>No recent returns</td></tr>
                  ) : recentReturns.map(r => (
                    <tr key={r.returnId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: '#475569' }}>{new Date(r.date).toLocaleDateString()}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: '#475569', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.reason}>{r.reason}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold',
                          backgroundColor: r.decision === 'accepted' ? '#dcfce7' : r.decision === 'rejected' ? '#fee2e2' : '#fef3c7',
                          color: r.decision === 'accepted' ? '#166534' : r.decision === 'rejected' ? '#991b1b' : '#92400e'
                        }}>
                          {r.decision.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

export default DistributorScorecardDetail;
