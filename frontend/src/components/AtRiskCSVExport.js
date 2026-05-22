import React, { useState } from 'react';
import api, { API_URL } from '../api';

// NON-VIZ 1: At-Risk Customer Report PDF
export default function AtRiskCSVExport() {
  const [threshold, setThreshold] = useState(60);
  const [limit, setLimit] = useState(10);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [err, setErr] = useState('');

  const loadPreview = async () => {
    setLoading(true); setErr('');
    try {
      const r = await api.post('/custom-views/at-risk-pdf', { threshold, limit, format: 'json' });
      setPreview(r.data);
    } catch (e) {
      setErr(e?.response?.data?.error || e.message || 'Failed to load preview');
    } finally { setLoading(false); }
  };

  const downloadPDF = async () => {
    setDownloading(true); setErr('');
    try {
      const token = localStorage.getItem('token');
      const resp = await fetch(`${API_URL}/custom-views/at-risk-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ threshold, limit, format: 'pdf' }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `at_risk_report_${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr(e?.message || 'Download failed');
    } finally { setDownloading(false); }
  };

  return (
    <div data-testid="at-risk-pdf" style={{
      background: '#1a1a2e', border: '1px solid #2d2d4a',
      borderRadius: 12, padding: 24, marginBottom: 24,
    }}>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ color: '#fff', margin: 0 }}>At-Risk Customer Report (PDF)</h3>
        <p style={{ color: '#9ca3af', fontSize: 13, marginTop: 4 }}>
          Generate a downloadable PDF with executive summary, themes, recommended actions, and at-risk customer list.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <label style={{ color: '#9ca3af', fontSize: 12, display: 'block', marginBottom: 4 }}>Risk Threshold</label>
          <input type="number" value={threshold} min="0" max="100"
            onChange={(e) => setThreshold(Number(e.target.value))}
            style={{ background: '#0f0f1a', color: '#fff', border: '1px solid #2d2d4a',
                     padding: '6px 10px', borderRadius: 4, width: 80 }} />
        </div>
        <div>
          <label style={{ color: '#9ca3af', fontSize: 12, display: 'block', marginBottom: 4 }}>Max Rows</label>
          <input type="number" value={limit} min="1" max="50"
            onChange={(e) => setLimit(Number(e.target.value))}
            style={{ background: '#0f0f1a', color: '#fff', border: '1px solid #2d2d4a',
                     padding: '6px 10px', borderRadius: 4, width: 80 }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
          <button onClick={loadPreview} disabled={loading}
            style={{ background: '#2d2d4a', color: '#fff', border: 'none',
                     padding: '8px 14px', borderRadius: 6, cursor: 'pointer' }}>
            {loading ? 'Loading...' : 'Preview'}
          </button>
          <button onClick={downloadPDF} disabled={downloading} data-testid="download-pdf-btn"
            style={{ background: '#6366f1', color: '#fff', border: 'none',
                     padding: '8px 14px', borderRadius: 6, cursor: 'pointer' }}>
            {downloading ? 'Generating...' : 'Download PDF'}
          </button>
        </div>
      </div>

      {err && <div style={{ color: '#ef4444', marginBottom: 12 }}>{err}</div>}

      {preview && (
        <div style={{ background: '#0f0f1a', padding: 16, borderRadius: 8, color: '#d1d5db', fontSize: 13 }}>
          <div style={{ marginBottom: 12 }}>
            <strong style={{ color: '#fff' }}>Executive Summary:</strong>{' '}
            {preview.narrative?.executive_summary}
          </div>
          <div style={{ marginBottom: 12 }}>
            <strong style={{ color: '#fff' }}>Top Themes:</strong>
            <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
              {(preview.narrative?.top_themes || []).map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          </div>
          <div style={{ marginBottom: 12 }}>
            <strong style={{ color: '#fff' }}>Customers ({preview.count}):</strong>
            <div style={{ overflowX: 'auto', marginTop: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ color: '#9ca3af', textAlign: 'left' }}>
                    <th style={{ padding: 4 }}>ID</th>
                    <th style={{ padding: 4 }}>Name</th>
                    <th style={{ padding: 4 }}>Plan</th>
                    <th style={{ padding: 4 }}>Risk</th>
                    <th style={{ padding: 4 }}>MRR</th>
                    <th style={{ padding: 4 }}>Signal</th>
                  </tr>
                </thead>
                <tbody>
                  {(preview.rows || []).map((r) => (
                    <tr key={r.customer_id} style={{ borderTop: '1px solid #2d2d4a' }}>
                      <td style={{ padding: 4 }}>{r.customer_id}</td>
                      <td style={{ padding: 4 }}>{r.name}</td>
                      <td style={{ padding: 4 }}>{r.plan}</td>
                      <td style={{ padding: 4 }}>{r.risk_score}</td>
                      <td style={{ padding: 4 }}>${r.mrr}</td>
                      <td style={{ padding: 4 }}>{r.top_signal}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>Source: {preview.source}</div>
        </div>
      )}
    </div>
  );
}
