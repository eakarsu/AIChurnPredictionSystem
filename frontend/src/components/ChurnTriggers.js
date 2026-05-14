import React, { useState, useEffect } from 'react';
import api from '../api';
import { useToast } from './Toast';

function ChurnTriggers() {
  const [customers, setCustomers] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [behavior, setBehavior] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [flagging, setFlagging] = useState(false);
  const toast = useToast();

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const [c, p, b, a] = await Promise.all([
        api.get('/customers'),
        api.get('/predictions'),
        api.get('/behavior'),
        api.get('/alerts'),
      ]);
      setCustomers(Array.isArray(c.data) ? c.data : c.data.data || []);
      setPredictions(Array.isArray(p.data) ? p.data : p.data.data || []);
      setBehavior(Array.isArray(b.data) ? b.data : b.data.data || []);
      setAlerts(Array.isArray(a.data) ? a.data : a.data.data || []);
    } catch (err) {
      toast.error('Failed to load data');
    }
  };

  // Compute trigger detection: customers with high prediction score and recent unusual behavior
  const triggers = customers.map((c) => {
    const pred = predictions.find((p) => p.customer_id === c.id);
    const recentBehavior = behavior.filter((b) => b.customer_id === c.id);
    const recentAlerts = alerts.filter((a) => a.customer_id === c.id && !a.is_resolved);
    const score = parseFloat(pred?.prediction_score || 0);
    const triggered = score >= 60 || recentAlerts.length > 0;
    const triggerReasons = [];
    if (score >= 60) triggerReasons.push(`High churn score (${score.toFixed(0)})`);
    if (recentAlerts.length > 0) triggerReasons.push(`${recentAlerts.length} unresolved alert(s)`);
    if (c.status === 'at-risk' || c.status === 'at_risk') triggerReasons.push('Status: at-risk');
    return {
      customer: c,
      prediction_score: score,
      trigger_reasons: triggerReasons,
      triggered,
      recent_events: recentBehavior.length,
      open_alerts: recentAlerts.length,
    };
  }).filter((t) => t.triggered).sort((a, b) => b.prediction_score - a.prediction_score);

  const analyzeCustomer = async (customerId) => {
    setAiLoading(true);
    setAiResult(null);
    setSelectedCustomerId(customerId);
    try {
      const cust = customers.find((c) => c.id === customerId);
      const res = await api.post('/ai/analyze-churn', {
        customer_id: customerId,
        customer_data: cust,
      });
      setAiResult(res.data);
      toast.success('AI analysis complete');
    } catch (err) {
      toast.error('AI analysis failed: ' + (err.response?.data?.error || err.message));
    }
    setAiLoading(false);
  };

  const flagAtRisk = async (customerId) => {
    setFlagging(true);
    try {
      await api.post(`/customers/${customerId}/flag-at-risk`, {});
      toast.success('Customer flagged as at-risk');
      load();
    } catch (err) {
      toast.error('Flag failed: ' + (err.response?.data?.error || err.message));
    }
    setFlagging(false);
  };

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#fff' }}>Churn Trigger Detection</h1>
        <p style={{ color: '#9ca3af', fontSize: 14, marginTop: 4 }}>Real-time alerts when customer behavior matches known churn patterns</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: 16, marginBottom: 32 }}>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 12, color: '#9ca3af' }}>Total Triggered</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#ef4444' }}>{triggers.length}</div>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 12, color: '#9ca3af' }}>Critical (≥80)</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#ef4444' }}>{triggers.filter(t => t.prediction_score >= 80).length}</div>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 12, color: '#9ca3af' }}>High (60-79)</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#f59e0b' }}>{triggers.filter(t => t.prediction_score >= 60 && t.prediction_score < 80).length}</div>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 12, color: '#9ca3af' }}>Total Customers Monitored</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#fff' }}>{customers.length}</div>
        </div>
      </div>

      <div className="card" style={{ padding: 24 }}>
        <h3 style={{ color: '#fff', marginTop: 0, marginBottom: 16 }}>Triggered Customers</h3>
        {triggers.length === 0 ? (
          <p style={{ color: '#10b981' }}>✓ No customers currently triggering churn patterns.</p>
        ) : (
          <div>
            {triggers.map((t) => (
              <div key={t.customer.id} style={{
                background: '#1a1a2e', padding: 16, marginBottom: 12, borderRadius: 12,
                borderLeft: `4px solid ${t.prediction_score >= 80 ? '#ef4444' : '#f59e0b'}`
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <h4 style={{ margin: 0, color: '#fff' }}>{t.customer.name}</h4>
                      <span style={{ fontSize: 12, color: '#9ca3af' }}>{t.customer.company}</span>
                      <span style={{
                        padding: '2px 10px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                        background: t.prediction_score >= 80 ? '#ef4444' : '#f59e0b', color: '#fff'
                      }}>Risk: {t.prediction_score.toFixed(0)}</span>
                    </div>
                    <div style={{ marginTop: 8 }}>
                      {t.trigger_reasons.map((r, i) => (
                        <span key={i} style={{
                          display: 'inline-block', padding: '4px 10px', marginRight: 6, marginBottom: 4,
                          background: '#2d2d4a', borderRadius: 6, fontSize: 12, color: '#fca5a5'
                        }}>{r}</span>
                      ))}
                    </div>
                    <div style={{ marginTop: 8, fontSize: 12, color: '#9ca3af' }}>
                      {t.recent_events} recent event(s) · {t.open_alerts} open alert(s)
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => analyzeCustomer(t.customer.id)} disabled={aiLoading && selectedCustomerId === t.customer.id}>
                      {aiLoading && selectedCustomerId === t.customer.id ? 'Analyzing...' : '🤖 Analyze'}
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={() => flagAtRisk(t.customer.id)} disabled={flagging}>
                      Flag At-Risk
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {aiResult && (
        <div className="card" style={{ padding: 24, marginTop: 24 }}>
          <h3 style={{ color: '#fff', marginTop: 0 }}>🤖 AI Churn Analysis Result</h3>
          <pre style={{
            background: '#1a1a2e', color: '#e0e0e0', padding: 16, borderRadius: 8,
            overflowX: 'auto', fontSize: 12, maxHeight: 500
          }}>{JSON.stringify(aiResult, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

export default ChurnTriggers;
