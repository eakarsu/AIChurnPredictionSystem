import React, { useState, useEffect } from 'react';
import api from '../api';
import { useToast } from './Toast';

function FeatureCorrelation() {
  const [features, setFeatures] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [f, p] = await Promise.all([api.get('/features'), api.get('/predictions')]);
      setFeatures(Array.isArray(f.data) ? f.data : f.data.data || []);
      setPredictions(Array.isArray(p.data) ? p.data : p.data.data || []);
    } catch (err) {
      toast.error('Failed to load data');
    }
    setLoading(false);
  };

  // For each feature, compute average risk score of customers who use it
  const featureMap = {};
  features.forEach((fu) => {
    const name = fu.feature_name || 'Unknown';
    if (!featureMap[name]) featureMap[name] = { customers: new Set(), totalAdoption: 0, count: 0 };
    featureMap[name].customers.add(fu.customer_id);
    featureMap[name].totalAdoption += parseFloat(fu.adoption_rate || 0);
    featureMap[name].count++;
  });

  const correlations = Object.entries(featureMap).map(([name, data]) => {
    const customerIds = Array.from(data.customers);
    const customerPreds = predictions.filter((p) => customerIds.includes(p.customer_id));
    const avgRisk = customerPreds.length > 0
      ? customerPreds.reduce((sum, p) => sum + parseFloat(p.prediction_score || 0), 0) / customerPreds.length
      : 0;
    const avgAdoption = data.count > 0 ? data.totalAdoption / data.count : 0;
    // Lower risk = good correlation with retention
    const retention_score = 100 - avgRisk;
    return {
      feature: name,
      adopters: customerIds.length,
      avg_adoption: avgAdoption.toFixed(1),
      avg_churn_risk: avgRisk.toFixed(1),
      retention_score: retention_score.toFixed(1),
    };
  }).sort((a, b) => parseFloat(b.retention_score) - parseFloat(a.retention_score));

  const sticky = correlations.filter((c) => parseFloat(c.retention_score) >= 60).slice(0, 5);
  const risky = correlations.filter((c) => parseFloat(c.avg_churn_risk) >= 60).slice(0, 5);

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#fff' }}>Feature Adoption Correlation</h1>
        <p style={{ color: '#9ca3af', fontSize: 14, marginTop: 4 }}>Identify which product features correlate with lower churn risk</p>
      </div>

      {loading ? (
        <p style={{ color: '#9ca3af' }}>Loading...</p>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
            <div className="card" style={{ padding: 24 }}>
              <h3 style={{ color: '#10b981', marginTop: 0 }}>🟢 Sticky Features (lowest churn)</h3>
              {sticky.length === 0 ? <p style={{ color: '#9ca3af' }}>No data yet.</p> : (
                <table style={{ width: '100%', color: '#e0e0e0' }}>
                  <thead>
                    <tr><th style={{ textAlign: 'left' }}>Feature</th><th>Retention</th><th>Adopters</th></tr>
                  </thead>
                  <tbody>
                    {sticky.map((c) => (
                      <tr key={c.feature}>
                        <td style={{ padding: 6, color: '#fff' }}>{c.feature}</td>
                        <td style={{ padding: 6, textAlign: 'center', color: '#10b981' }}>{c.retention_score}%</td>
                        <td style={{ padding: 6, textAlign: 'center' }}>{c.adopters}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="card" style={{ padding: 24 }}>
              <h3 style={{ color: '#ef4444', marginTop: 0 }}>🔴 Risky Features (highest churn)</h3>
              {risky.length === 0 ? <p style={{ color: '#9ca3af' }}>No data yet.</p> : (
                <table style={{ width: '100%', color: '#e0e0e0' }}>
                  <thead>
                    <tr><th style={{ textAlign: 'left' }}>Feature</th><th>Risk</th><th>Adopters</th></tr>
                  </thead>
                  <tbody>
                    {risky.map((c) => (
                      <tr key={c.feature}>
                        <td style={{ padding: 6, color: '#fff' }}>{c.feature}</td>
                        <td style={{ padding: 6, textAlign: 'center', color: '#ef4444' }}>{c.avg_churn_risk}%</td>
                        <td style={{ padding: 6, textAlign: 'center' }}>{c.adopters}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ color: '#fff', marginTop: 0 }}>All Features Ranked by Retention Impact</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', color: '#e0e0e0' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #2d2d4a' }}>
                    <th style={{ textAlign: 'left', padding: 8 }}>Feature</th>
                    <th style={{ textAlign: 'right', padding: 8 }}>Adopters</th>
                    <th style={{ textAlign: 'right', padding: 8 }}>Avg Adoption</th>
                    <th style={{ textAlign: 'right', padding: 8 }}>Avg Churn Risk</th>
                    <th style={{ textAlign: 'right', padding: 8 }}>Retention Score</th>
                    <th style={{ textAlign: 'left', padding: 8 }}>Indicator</th>
                  </tr>
                </thead>
                <tbody>
                  {correlations.map((c) => (
                    <tr key={c.feature} style={{ borderBottom: '1px solid #2d2d4a' }}>
                      <td style={{ padding: 8, color: '#fff' }}>{c.feature}</td>
                      <td style={{ padding: 8, textAlign: 'right' }}>{c.adopters}</td>
                      <td style={{ padding: 8, textAlign: 'right' }}>{c.avg_adoption}%</td>
                      <td style={{ padding: 8, textAlign: 'right', color: parseFloat(c.avg_churn_risk) > 60 ? '#ef4444' : '#9ca3af' }}>{c.avg_churn_risk}%</td>
                      <td style={{ padding: 8, textAlign: 'right', color: parseFloat(c.retention_score) > 60 ? '#10b981' : '#9ca3af' }}>{c.retention_score}%</td>
                      <td style={{ padding: 8 }}>
                        <div style={{ background: '#0f0f1a', borderRadius: 4, height: 10, width: 150 }}>
                          <div style={{
                            width: `${Math.min(100, parseFloat(c.retention_score))}%`,
                            height: '100%',
                            background: parseFloat(c.retention_score) > 60 ? '#10b981' : parseFloat(c.retention_score) > 40 ? '#f59e0b' : '#ef4444',
                            borderRadius: 4,
                          }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default FeatureCorrelation;
