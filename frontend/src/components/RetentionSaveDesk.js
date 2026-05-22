import React, { useState } from 'react';
import api from '../api';

const sample = JSON.stringify({
  customer: { name: 'Globex Finance', arr: 84000, renewalDays: 42, healthScore: 38 },
  signals: ['usage down 44%', 'two unresolved support tickets', 'executive sponsor changed'],
  contract: { seats: 120, product: 'Enterprise Analytics' }
}, null, 2);

export default function RetentionSaveDesk() {
  const [payload, setPayload] = useState(sample);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const response = await api.post('/retention-save-desk/plan', JSON.parse(payload));
      setResult(response.data);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Plan failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={styles.header}>
        <h1>Retention Save Desk</h1>
        <p>Prioritize save motions, owner actions, and renewal risk for high-value accounts.</p>
      </div>
      <div style={styles.grid}>
        <div className="card" style={styles.card}>
          <label>Account payload</label>
          <textarea value={payload} onChange={(event) => setPayload(event.target.value)} rows={16} style={styles.textarea} />
          {error && <div className="alert alert-danger">{error}</div>}
          <button className="btn btn-primary" onClick={run} disabled={loading}>{loading ? 'Planning...' : 'Build save plan'}</button>
        </div>
        <div className="card" style={styles.card}>
          {result ? (
            <div>
              <div style={styles.metrics}>
                <Metric label="Save Score" value={`${result.saveScore}/100`} />
                <Metric label="ARR at Risk" value={`$${result.arrAtRisk.toLocaleString()}`} />
                <Metric label="Motion" value={result.motion} />
              </div>
              <h3>Save plan</h3>
              {result.actions.map((action) => (
                <div key={action.owner} style={styles.action}>
                  <strong>{action.owner}</strong>
                  <div>{action.task}</div>
                  <small>{action.due}</small>
                </div>
              ))}
              <h3>Talk track</h3>
              <p>{result.talkTrack}</p>
            </div>
          ) : (
            <p>Build a save plan to coordinate CSM, support, and executive actions.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div style={styles.metric}>
      <div>{label}</div>
      <strong>{value}</strong>
    </div>
  );
}

const styles = {
  header: { marginBottom: 20 },
  grid: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 20 },
  card: { padding: 20 },
  textarea: { width: '100%', fontFamily: 'monospace', margin: '8px 0 12px' },
  metrics: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 18 },
  metric: { background: '#f7f7ff', borderRadius: 8, padding: 12 },
  action: { border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, marginBottom: 10 },
};
