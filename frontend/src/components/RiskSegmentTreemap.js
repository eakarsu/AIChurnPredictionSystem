import React, { useEffect, useState } from 'react';
import api from '../api';

// VIZ 2: Churn-Risk Heatmap (Segment x Behavior)
export default function RiskSegmentTreemap() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const load = async () => {
    setLoading(true); setErr('');
    try {
      const r = await api.post('/custom-views/risk-heatmap', {});
      setData(r.data);
    } catch (e) {
      setErr(e?.response?.data?.error || e.message || 'Failed to load');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // Map risk 0..100 -> color from green (low risk) -> red (high risk)
  const riskColor = (v) => {
    const pct = Math.max(0, Math.min(100, v)) / 100;
    const r = Math.round(16 * (1 - pct) + 239 * pct);
    const g = Math.round(185 * (1 - pct) + 68 * pct);
    const b = Math.round(129 * (1 - pct) + 68 * pct);
    return `rgb(${r}, ${g}, ${b})`;
  };

  const cellFor = (segment, behavior) =>
    data?.cells?.find((c) => c.segment === segment && c.behavior === behavior);

  return (
    <div data-testid="risk-heatmap" style={{
      background: '#1a1a2e', border: '1px solid #2d2d4a',
      borderRadius: 12, padding: 24, marginBottom: 24,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h3 style={{ color: '#fff', margin: 0 }}>Churn-Risk Heatmap — Segment x Behavior</h3>
          <p style={{ color: '#9ca3af', fontSize: 13, marginTop: 4 }}>
            Churn risk percentage by customer segment and risk-driving behavior signal.
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
                  <th style={{ padding: 8, textAlign: 'left', color: '#9ca3af', fontWeight: 500 }}>Segment</th>
                  {(data.behaviors || []).map((b) => (
                    <th key={b} style={{ padding: 8, color: '#9ca3af', fontWeight: 500, fontSize: 12 }}>{b}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data.segments || []).map((s) => (
                  <tr key={s}>
                    <td style={{ padding: 8, color: '#d1d5db', fontSize: 13 }}>{s}</td>
                    {(data.behaviors || []).map((b) => {
                      const c = cellFor(s, b);
                      const v = c?.risk ?? 0;
                      return (
                        <td key={b} style={{
                          width: 110, height: 44, textAlign: 'center',
                          background: riskColor(v), color: '#0f0f1a',
                          fontWeight: 600, borderRadius: 4, fontSize: 13,
                        }}>{v}%</td>
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
