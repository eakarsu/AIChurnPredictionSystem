import React, { useState } from 'react';
import api from '../api';
import { useToast } from './Toast';

function WinbackOrchestration() {
  const [timeSinceChurn, setTimeSinceChurn] = useState('30 days');
  const [loading, setLoading] = useState(false);
  const [campaign, setCampaign] = useState(null);
  const toast = useToast();

  const generateCampaign = async () => {
    setLoading(true);
    setCampaign(null);
    try {
      const res = await api.post('/ai/winback-campaign', { time_since_churn: timeSinceChurn });
      setCampaign(res.data);
      if (res.data.ai_unavailable) toast.warning('AI temporarily unavailable - showing fallback');
      else toast.success(`Win-back campaign generated in ${res.data.response_time_ms}ms`);
    } catch (err) {
      toast.error('Campaign generation failed: ' + (err.response?.data?.error || err.message));
    }
    setLoading(false);
  };

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#fff' }}>Win-Back Orchestration</h1>
        <p style={{ color: '#9ca3af', fontSize: 14, marginTop: 4 }}>Auto-generate personalized re-engagement campaigns for churned customers</p>
      </div>

      <div className="card" style={{ padding: 24, marginBottom: 24 }}>
        <h3 style={{ color: '#fff', marginTop: 0 }}>Configure Campaign</h3>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 12 }}>
          <label style={{ color: '#9ca3af', fontSize: 14 }}>Time since churn:</label>
          <select value={timeSinceChurn} onChange={(e) => setTimeSinceChurn(e.target.value)} style={{ padding: 8, minWidth: 200 }}>
            <option value="7 days">7 days</option>
            <option value="14 days">14 days</option>
            <option value="30 days">30 days</option>
            <option value="60 days">60 days</option>
            <option value="90 days">90 days</option>
            <option value="various">Various / Mixed</option>
          </select>
          <button className="btn btn-primary" onClick={generateCampaign} disabled={loading}>
            {loading ? 'Generating...' : '🤖 Generate Campaign'}
          </button>
        </div>
      </div>

      {campaign && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))', gap: 16, marginBottom: 24 }}>
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>Customers Analyzed</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#fff' }}>{campaign.churned_customers_analyzed}</div>
            </div>
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>Templates Generated</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#22d3ee' }}>{campaign.campaign?.message_templates?.length || 0}</div>
            </div>
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>Incentives Suggested</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#10b981' }}>{campaign.campaign?.incentive_recommendations?.length || 0}</div>
            </div>
          </div>

          {campaign.campaign?.optimal_contact_timing && (
            <div className="card" style={{ padding: 24, marginBottom: 24 }}>
              <h3 style={{ color: '#fff', marginTop: 0 }}>📅 Optimal Contact Timing</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: 12 }}>
                <div><strong style={{ color: '#9ca3af', fontSize: 12 }}>DAYS</strong><div style={{ color: '#fff' }}>{campaign.campaign.optimal_contact_timing.day_ranges}</div></div>
                <div><strong style={{ color: '#9ca3af', fontSize: 12 }}>BEST TIME</strong><div style={{ color: '#fff' }}>{campaign.campaign.optimal_contact_timing.best_time_of_day}</div></div>
                <div><strong style={{ color: '#9ca3af', fontSize: 12 }}>FREQUENCY</strong><div style={{ color: '#fff' }}>{campaign.campaign.optimal_contact_timing.frequency}</div></div>
                <div><strong style={{ color: '#9ca3af', fontSize: 12 }}>CHANNELS</strong><div style={{ color: '#fff' }}>{(campaign.campaign.optimal_contact_timing.channel_priority || []).join(', ')}</div></div>
              </div>
            </div>
          )}

          {campaign.campaign?.message_templates?.length > 0 && (
            <div className="card" style={{ padding: 24, marginBottom: 24 }}>
              <h3 style={{ color: '#fff', marginTop: 0 }}>📧 Email Templates</h3>
              {campaign.campaign.message_templates.map((t, i) => (
                <div key={i} style={{ background: '#1a1a2e', padding: 16, borderRadius: 8, marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <h4 style={{ color: '#22d3ee', margin: 0 }}>{t.name}</h4>
                    <span style={{ fontSize: 12, color: '#9ca3af' }}>{t.tone} · {t.best_for}</span>
                  </div>
                  <div style={{ marginBottom: 8 }}><strong style={{ color: '#9ca3af' }}>Subject:</strong> <span style={{ color: '#fff' }}>{t.subject_line}</span></div>
                  <div style={{ color: '#e0e0e0', whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.6 }}>{t.email_body}</div>
                </div>
              ))}
            </div>
          )}

          {campaign.campaign?.incentive_recommendations?.length > 0 && (
            <div className="card" style={{ padding: 24, marginBottom: 24 }}>
              <h3 style={{ color: '#fff', marginTop: 0 }}>🎁 Incentive Recommendations</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px,1fr))', gap: 12 }}>
                {campaign.campaign.incentive_recommendations.map((inc, i) => (
                  <div key={i} style={{ background: '#1a1a2e', padding: 16, borderRadius: 8, borderLeft: '3px solid #10b981' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <strong style={{ color: '#10b981' }}>{inc.incentive_type}</strong>
                      {inc.discount_percentage && <span style={{ color: '#22d3ee' }}>{inc.discount_percentage}%</span>}
                    </div>
                    <p style={{ color: '#e0e0e0', fontSize: 13, margin: '4px 0' }}>{inc.description}</p>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>
                      Target: {inc.target_segment} · Success rate: {inc.expected_success_rate}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {campaign.campaign?.segmentation_strategy && (
            <div className="card" style={{ padding: 24, marginBottom: 24 }}>
              <h3 style={{ color: '#fff', marginTop: 0 }}>🎯 Segmentation Strategy</h3>
              <p style={{ color: '#e0e0e0', whiteSpace: 'pre-wrap' }}>{
                typeof campaign.campaign.segmentation_strategy === 'string'
                  ? campaign.campaign.segmentation_strategy
                  : JSON.stringify(campaign.campaign.segmentation_strategy, null, 2)
              }</p>
            </div>
          )}

          {campaign.campaign?.success_metrics?.length > 0 && (
            <div className="card" style={{ padding: 24 }}>
              <h3 style={{ color: '#fff', marginTop: 0 }}>📊 Success KPIs</h3>
              <ul style={{ color: '#e0e0e0' }}>
                {campaign.campaign.success_metrics.map((m, i) => <li key={i}>{m}</li>)}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default WinbackOrchestration;
