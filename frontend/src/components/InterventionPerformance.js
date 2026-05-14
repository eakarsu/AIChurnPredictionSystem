import React, { useState, useEffect } from 'react';
import api from '../api';
import { useToast } from './Toast';

function InterventionPerformance() {
  const [interventions, setInterventions] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/interventions');
      const data = Array.isArray(res.data) ? res.data : (res.data.data || []);
      setInterventions(data);
    } catch (err) {
      toast.error('Failed to load interventions');
    }
    setLoading(false);
  };

  // Aggregate by intervention type
  const grouped = interventions.reduce((acc, item) => {
    const type = item.intervention_type || item.type || 'Other';
    if (!acc[type]) acc[type] = { total: 0, completed: 0, success: 0, totalEffect: 0, count: 0 };
    acc[type].total++;
    if (item.status === 'completed' || item.status === 'completed') acc[type].completed++;
    if ((item.outcome || '').toLowerCase().includes('success') || item.success === true) acc[type].success++;
    if (item.effectiveness !== undefined && item.effectiveness !== null) {
      acc[type].totalEffect += parseFloat(item.effectiveness || 0);
      acc[type].count++;
    }
    return acc;
  }, {});

  const summary = Object.entries(grouped).map(([type, data]) => ({
    type,
    total: data.total,
    completed: data.completed,
    success_rate: data.total > 0 ? ((data.success / data.total) * 100).toFixed(1) : 0,
    avg_effectiveness: data.count > 0 ? (data.totalEffect / data.count).toFixed(1) : 0,
  })).sort((a, b) => parseFloat(b.success_rate) - parseFloat(a.success_rate));

  const topType = summary[0]?.type;
  const totalIntv = interventions.length;
  const overallSuccess = totalIntv > 0
    ? ((Object.values(grouped).reduce((s, d) => s + d.success, 0) / totalIntv) * 100).toFixed(1)
    : 0;

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#fff' }}>Intervention Performance Tracking</h1>
        <p style={{ color: '#9ca3af', fontSize: 14, marginTop: 4 }}>Measure which intervention types reduce churn most effectively</p>
      </div>

      {loading ? (
        <p style={{ color: '#9ca3af' }}>Loading interventions...</p>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: 16, marginBottom: 32 }}>
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>Total Interventions</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#fff' }}>{totalIntv}</div>
            </div>
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>Overall Success Rate</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#10b981' }}>{overallSuccess}%</div>
            </div>
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>Best Performing Type</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#22d3ee' }}>{topType || 'N/A'}</div>
            </div>
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>Type Variants Measured</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#fff' }}>{summary.length}</div>
            </div>
          </div>

          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ color: '#fff', marginTop: 0, marginBottom: 16 }}>Performance by Intervention Type</h3>
            {summary.length === 0 ? (
              <p style={{ color: '#9ca3af' }}>No data to aggregate.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', color: '#e0e0e0' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #2d2d4a' }}>
                      <th style={{ textAlign: 'left', padding: 8 }}>Type</th>
                      <th style={{ textAlign: 'right', padding: 8 }}>Total</th>
                      <th style={{ textAlign: 'right', padding: 8 }}>Completed</th>
                      <th style={{ textAlign: 'right', padding: 8 }}>Success Rate</th>
                      <th style={{ textAlign: 'right', padding: 8 }}>Avg Effectiveness</th>
                      <th style={{ textAlign: 'left', padding: 8 }}>Performance Bar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.map((s) => (
                      <tr key={s.type} style={{ borderBottom: '1px solid #2d2d4a' }}>
                        <td style={{ padding: 8, color: '#fff', fontWeight: 600 }}>{s.type}</td>
                        <td style={{ padding: 8, textAlign: 'right' }}>{s.total}</td>
                        <td style={{ padding: 8, textAlign: 'right' }}>{s.completed}</td>
                        <td style={{ padding: 8, textAlign: 'right' }}>
                          <span style={{
                            padding: '2px 8px', borderRadius: 10, fontSize: 12,
                            background: parseFloat(s.success_rate) > 60 ? '#10b981' : parseFloat(s.success_rate) > 30 ? '#f59e0b' : '#ef4444',
                            color: '#fff'
                          }}>{s.success_rate}%</span>
                        </td>
                        <td style={{ padding: 8, textAlign: 'right', color: '#22d3ee' }}>{s.avg_effectiveness}%</td>
                        <td style={{ padding: 8, minWidth: 200 }}>
                          <div style={{ background: '#0f0f1a', borderRadius: 4, height: 12 }}>
                            <div style={{
                              width: `${Math.min(100, parseFloat(s.success_rate))}%`,
                              height: '100%',
                              background: 'linear-gradient(90deg,#6366f1,#22d3ee)',
                              borderRadius: 4,
                            }} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default InterventionPerformance;
