import React, { useState, useEffect } from 'react';
import api from '../api';
import { useToast } from './Toast';

function CohortSurvival() {
  const [cohorts, setCohorts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const toast = useToast();

  useEffect(() => { fetchCohorts(); }, []);

  const fetchCohorts = async () => {
    setLoading(true);
    try {
      const res = await api.get('/analytics/cohort-survival');
      setCohorts(res.data.cohorts || []);
      setSummary(res.data.summary || null);
    } catch (err) {
      toast.error('Failed to load cohort data: ' + (err.response?.data?.error || err.message));
    }
    setLoading(false);
  };

  const runAIAnalysis = async () => {
    setAiLoading(true);
    setAnalysis(null);
    try {
      const res = await api.post('/ai/cohort-analysis');
      setAnalysis(res.data.analysis);
      if (res.data.ai_unavailable) toast.warning('AI temporarily unavailable - showing fallback analysis');
      else toast.success(`AI cohort analysis complete in ${res.data.response_time_ms}ms`);
    } catch (err) {
      toast.error('AI analysis failed: ' + (err.response?.data?.error || err.message));
    }
    setAiLoading(false);
  };

  const survivalColor = (pct) => {
    const v = parseFloat(pct || 0);
    if (v >= 80) return '#10b981';
    if (v >= 60) return '#f59e0b';
    if (v >= 40) return '#fb923c';
    return '#ef4444';
  };

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#fff' }}>Cohort Survival Analysis</h1>
        <p style={{ color: '#9ca3af', fontSize: 14, marginTop: 4 }}>Track signup-month cohorts and measure actual customer retention over 1/3/6/12 months</p>
      </div>

      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 16, marginBottom: 32 }}>
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, color: '#9ca3af' }}>Total Cohorts</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#fff' }}>{summary.total_cohorts}</div>
          </div>
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, color: '#9ca3af' }}>Total Customers</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#fff' }}>{summary.total_customers}</div>
          </div>
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, color: '#9ca3af' }}>Avg Survival (1mo)</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: survivalColor(summary.avg_survival_pct_1mo) }}>{summary.avg_survival_pct_1mo}%</div>
          </div>
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, color: '#9ca3af' }}>Avg Survival (12mo)</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: survivalColor(summary.avg_survival_pct_12mo) }}>{summary.avg_survival_pct_12mo}%</div>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 24, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ color: '#fff', margin: 0 }}>Survival Curve by Cohort</h3>
          <div>
            <button className="btn btn-secondary btn-sm" onClick={fetchCohorts} disabled={loading} style={{ marginRight: 8 }}>
              {loading ? 'Loading...' : 'Refresh'}
            </button>
            <button className="btn btn-primary btn-sm" onClick={runAIAnalysis} disabled={aiLoading}>
              {aiLoading ? 'Analyzing...' : '🤖 AI Insights'}
            </button>
          </div>
        </div>

        {cohorts.length === 0 ? (
          <p style={{ color: '#9ca3af' }}>No cohort data yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', color: '#e0e0e0' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #2d2d4a' }}>
                  <th style={{ textAlign: 'left', padding: 8 }}>Cohort</th>
                  <th style={{ textAlign: 'right', padding: 8 }}>Customers</th>
                  <th style={{ textAlign: 'right', padding: 8 }}>1 mo</th>
                  <th style={{ textAlign: 'right', padding: 8 }}>3 mo</th>
                  <th style={{ textAlign: 'right', padding: 8 }}>6 mo</th>
                  <th style={{ textAlign: 'right', padding: 8 }}>12 mo</th>
                </tr>
              </thead>
              <tbody>
                {cohorts.map((c) => (
                  <tr key={c.cohort_month} style={{ borderBottom: '1px solid #2d2d4a' }}>
                    <td style={{ padding: 8, color: '#fff' }}>{c.cohort_month}</td>
                    <td style={{ padding: 8, textAlign: 'right' }}>{c.total_customers}</td>
                    <td style={{ padding: 8, textAlign: 'right', color: survivalColor(c.survival_pct_1mo) }}>{c.survival_pct_1mo ?? 0}%</td>
                    <td style={{ padding: 8, textAlign: 'right', color: survivalColor(c.survival_pct_3mo) }}>{c.survival_pct_3mo ?? 0}%</td>
                    <td style={{ padding: 8, textAlign: 'right', color: survivalColor(c.survival_pct_6mo) }}>{c.survival_pct_6mo ?? 0}%</td>
                    <td style={{ padding: 8, textAlign: 'right', color: survivalColor(c.survival_pct_12mo) }}>{c.survival_pct_12mo ?? 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {analysis && (
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ color: '#fff', marginTop: 0, marginBottom: 16 }}>🤖 AI Analysis</h3>

          {analysis.overall_health_assessment && (
            <div style={{ marginBottom: 20, padding: 16, background: '#1a1a2e', borderRadius: 12, borderLeft: '4px solid #6366f1' }}>
              <h4 style={{ color: '#6366f1', margin: '0 0 8px 0', fontSize: 13, textTransform: 'uppercase' }}>Overall Health</h4>
              <p style={{ margin: 0, color: '#e0e0e0' }}>{analysis.overall_health_assessment}</p>
            </div>
          )}

          {analysis.high_risk_cohorts?.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h4 style={{ color: '#ef4444', fontSize: 13, textTransform: 'uppercase', marginBottom: 8 }}>⚠️ High-Risk Cohorts</h4>
              {analysis.high_risk_cohorts.map((c, i) => (
                <div key={i} style={{ background: 'rgba(239,68,68,0.1)', padding: 12, marginBottom: 8, borderRadius: 8, borderLeft: '3px solid #ef4444' }}>
                  <strong style={{ color: '#fff' }}>{c.cohort_month}</strong>
                  <span style={{ marginLeft: 8, fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#ef4444', color: '#fff' }}>{c.risk_level}</span>
                  <p style={{ margin: '4px 0 0', color: '#fca5a5', fontSize: 13 }}>{c.risk_reason}</p>
                </div>
              ))}
            </div>
          )}

          {analysis.churn_patterns?.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h4 style={{ color: '#f59e0b', fontSize: 13, textTransform: 'uppercase', marginBottom: 8 }}>Churn Patterns</h4>
              {analysis.churn_patterns.map((p, i) => (
                <div key={i} style={{ padding: 8, color: '#e0e0e0' }}>• {typeof p === 'string' ? p : (p.pattern || JSON.stringify(p))}</div>
              ))}
            </div>
          )}

          {analysis.retention_recommendations?.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h4 style={{ color: '#10b981', fontSize: 13, textTransform: 'uppercase', marginBottom: 8 }}>💡 Retention Recommendations</h4>
              {analysis.retention_recommendations.map((r, i) => (
                <div key={i} style={{ background: '#1a1a2e', padding: 12, marginBottom: 8, borderRadius: 8 }}>
                  <strong style={{ color: '#10b981' }}>{r.target_cohort || 'All cohorts'}</strong>
                  <p style={{ margin: '4px 0', color: '#e0e0e0' }}>{r.strategy}</p>
                  {r.expected_impact && <small style={{ color: '#22d3ee' }}>Impact: {r.expected_impact}</small>}
                </div>
              ))}
            </div>
          )}

          {analysis.cohort_insights?.length > 0 && (
            <div>
              <h4 style={{ color: '#22d3ee', fontSize: 13, textTransform: 'uppercase', marginBottom: 8 }}>Key Insights</h4>
              <ul style={{ color: '#e0e0e0' }}>
                {analysis.cohort_insights.map((insight, i) => (
                  <li key={i} style={{ marginBottom: 6 }}>{typeof insight === 'string' ? insight : (insight.insight || JSON.stringify(insight))}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default CohortSurvival;
