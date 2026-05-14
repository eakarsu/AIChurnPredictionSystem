import React, { useState, useEffect } from 'react';
import api from '../api';
import { useToast } from './Toast';

function ForecastConfidence() {
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/predictions');
      setPredictions(Array.isArray(res.data) ? res.data : res.data.data || []);
    } catch (err) {
      toast.error('Failed to load predictions');
    }
    setLoading(false);
  };

  const buckets = { high: [], medium: [], low: [] };
  predictions.forEach((p) => {
    const conf = (p.confidence_level || 'medium').toLowerCase();
    if (conf === 'high' || parseFloat(p.confidence_score || 0) >= 75) buckets.high.push(p);
    else if (conf === 'low' || parseFloat(p.confidence_score || 0) < 50) buckets.low.push(p);
    else buckets.medium.push(p);
  });

  const sorted = [...predictions].sort((a, b) => {
    const c1 = parseFloat(a.confidence_score || 0);
    const c2 = parseFloat(b.confidence_score || 0);
    return c1 - c2;
  });

  const lowConfidence = sorted.slice(0, 20);

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#fff' }}>Churn Forecast Confidence</h1>
        <p style={{ color: '#9ca3af', fontSize: 14, marginTop: 4 }}>Transparency on AI prediction uncertainty per customer</p>
      </div>

      {loading ? <p style={{ color: '#9ca3af' }}>Loading...</p> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 32 }}>
            <div className="card" style={{ padding: 24, borderLeft: '4px solid #10b981' }}>
              <h3 style={{ color: '#10b981', marginTop: 0 }}>High Confidence</h3>
              <div style={{ fontSize: 36, fontWeight: 700, color: '#fff' }}>{buckets.high.length}</div>
              <div style={{ color: '#9ca3af', fontSize: 13 }}>Predictions are reliable</div>
            </div>
            <div className="card" style={{ padding: 24, borderLeft: '4px solid #f59e0b' }}>
              <h3 style={{ color: '#f59e0b', marginTop: 0 }}>Medium Confidence</h3>
              <div style={{ fontSize: 36, fontWeight: 700, color: '#fff' }}>{buckets.medium.length}</div>
              <div style={{ color: '#9ca3af', fontSize: 13 }}>Use with caution</div>
            </div>
            <div className="card" style={{ padding: 24, borderLeft: '4px solid #ef4444' }}>
              <h3 style={{ color: '#ef4444', marginTop: 0 }}>Low Confidence</h3>
              <div style={{ fontSize: 36, fontWeight: 700, color: '#fff' }}>{buckets.low.length}</div>
              <div style={{ color: '#9ca3af', fontSize: 13 }}>Need more data</div>
            </div>
          </div>

          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ color: '#fff', marginTop: 0 }}>Lowest Confidence Predictions</h3>
            <p style={{ color: '#9ca3af', fontSize: 13 }}>These customers need more data collection or human review</p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', color: '#e0e0e0' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #2d2d4a' }}>
                    <th style={{ textAlign: 'left', padding: 8 }}>Customer</th>
                    <th style={{ textAlign: 'right', padding: 8 }}>Risk Score</th>
                    <th style={{ textAlign: 'right', padding: 8 }}>Confidence</th>
                    <th style={{ textAlign: 'left', padding: 8 }}>Confidence Bar</th>
                    <th style={{ textAlign: 'left', padding: 8 }}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {lowConfidence.map((p) => {
                    const conf = parseFloat(p.confidence_score || 0);
                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid #2d2d4a' }}>
                        <td style={{ padding: 8, color: '#fff' }}>{p.customer_name || `Customer #${p.customer_id}`}</td>
                        <td style={{ padding: 8, textAlign: 'right' }}>
                          <span style={{
                            padding: '2px 8px', borderRadius: 10, fontSize: 12,
                            background: parseFloat(p.prediction_score) > 70 ? '#ef4444' : parseFloat(p.prediction_score) > 40 ? '#f59e0b' : '#10b981',
                            color: '#fff'
                          }}>{parseFloat(p.prediction_score || 0).toFixed(0)}</span>
                        </td>
                        <td style={{ padding: 8, textAlign: 'right', color: '#9ca3af' }}>{conf.toFixed(0)}%</td>
                        <td style={{ padding: 8, minWidth: 200 }}>
                          <div style={{ background: '#0f0f1a', height: 10, borderRadius: 4 }}>
                            <div style={{
                              width: `${Math.min(100, conf)}%`,
                              height: '100%',
                              background: conf >= 75 ? '#10b981' : conf >= 50 ? '#f59e0b' : '#ef4444',
                              borderRadius: 4,
                            }} />
                          </div>
                        </td>
                        <td style={{ padding: 8, fontSize: 12, color: '#9ca3af' }}>
                          {conf < 50 ? 'Insufficient data — collect more behavior signals' : conf < 75 ? 'Moderate uncertainty' : 'Reliable'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default ForecastConfidence;
