import React, { useEffect, useState } from 'react';
import api from '../api';

// VIZ 1: Cohort Retention Triangle Chart
// Rows = cohort. Columns = months observed. Each newer cohort has fewer cells (triangle shape).
export default function ChurnCohortHeatmap() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const load = async () => {
    setLoading(true); setErr('');
    try {
      const r = await api.post('/custom-views/cohort-triangle', { segments: 5 });
      setData(r.data);
    } catch (e) {
      setErr(e?.response?.data?.error || e.message || 'Failed to load');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // Color: green (high retention) -> red (low retention)
  const cellColor = (v) => {
    const pct = Math.max(0, Math.min(100, v)) / 100;
    const r = Math.round(239 * (1 - pct) + 16 * pct);
    const g = Math.round(68 * (1 - pct) + 185 * pct);
    const b = Math.round(68 * (1 - pct) + 129 * pct);
    return `rgb(${r}, ${g}, ${b})`;
  };

  const maxMonths = data?.max_months ?? 6;
  const monthHeaders = Array.from({ length: maxMonths + 1 }, (_, i) => `M${i}`);

  return (
    <div data-testid="cohort-triangle" style={{
      background: '#1a1a2e', border: '1px solid #2d2d4a',
      borderRadius: 12, padding: 24, marginBottom: 24,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h3 style={{ color: '#fff', margin: 0 }}>Cohort Retention Triangle</h3>
          <p style={{ color: '#9ca3af', fontSize: 13, marginTop: 4 }}>
            Percent of each acquisition cohort still active by month — newer cohorts have fewer observed periods.
          </p>
        </div>
        <button onClick={load} disabled={loading}
          style={{ background: '#2d2d4a', color: '#fff', border: 'none',
                   padding: '6px 14px', borderRadius: 6, cursor: 'pointer' }}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>
      {err && <div style={{ color: '#ef4444', marginBottom: 12 }}>{err}</div>}
      {data && (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'separate', borderSpacing: 4, color: '#fff' }}>
              <thead>
                <tr>
                  <th style={{ padding: 8, textAlign: 'left', color: '#9ca3af', fontWeight: 500 }}>Cohort</th>
                  <th style={{ padding: 8, color: '#9ca3af', fontWeight: 500 }}>Size</th>
                  {monthHeaders.map((m) => (
                    <th key={m} style={{ padding: 8, color: '#9ca3af', fontWeight: 500 }}>{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data.rows || []).map((row) => (
                  <tr key={row.cohort}>
                    <td style={{ padding: 8, color: '#d1d5db', fontSize: 13 }}>{row.cohort}</td>
                    <td style={{ padding: 8, color: '#d1d5db', fontSize: 13 }}>{row.size}</td>
                    {monthHeaders.map((m, idx) => {
                      const cell = row.cells?.[idx];
                      if (!cell) {
                        return <td key={m} style={{ width: 60, height: 40 }}></td>;
                      }
                      return (
                        <td key={m} style={{
                          width: 60, height: 40, textAlign: 'center',
                          background: cellColor(cell.retention), color: '#0f0f1a',
                          fontWeight: 600, borderRadius: 4, fontSize: 13,
                        }}>{cell.retention}%</td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 12, fontSize: 12, color: '#9ca3af' }}>
            Source: {data.source}{data.model ? ` (${data.model})` : ''}. {data.summary || ''}
          </div>
        </>
      )}
    </div>
  );
}
