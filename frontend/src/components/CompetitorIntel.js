import React, { useState, useEffect } from 'react';
import api from '../api';
import { useToast } from './Toast';

function CompetitorIntel() {
  const [sentiments, setSentiments] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [s, t] = await Promise.all([api.get('/sentiment'), api.get('/tickets')]);
      setSentiments(Array.isArray(s.data) ? s.data : s.data.data || []);
      setTickets(Array.isArray(t.data) ? t.data : t.data.data || []);
    } catch (err) {
      toast.error('Failed to load data');
    }
    setLoading(false);
  };

  // Common competitor keywords / patterns
  const competitorKeywords = [
    'switch', 'switching', 'competitor', 'alternative', 'instead', 'better',
    'cheaper', 'replace', 'replacing', 'moved to', 'moving to',
    // Common SaaS competitors (generic)
    'salesforce', 'hubspot', 'zendesk', 'intercom', 'monday', 'asana',
    'jira', 'slack', 'microsoft', 'google workspace',
  ];

  const allText = [
    ...sentiments.map((s) => ({ id: s.id, customer_id: s.customer_id, customer_name: s.customer_name, source: 'Sentiment', text: s.feedback_text || '' })),
    ...tickets.map((t) => ({ id: t.id, customer_id: t.customer_id, customer_name: t.customer_name, source: 'Ticket', text: `${t.subject || ''} ${t.description || ''}` })),
  ];

  const mentions = allText
    .map((item) => {
      const text = (item.text || '').toLowerCase();
      const matches = competitorKeywords.filter((k) => text.includes(k));
      return { ...item, matches };
    })
    .filter((item) => item.matches.length > 0)
    .sort((a, b) => b.matches.length - a.matches.length);

  // Aggregate keyword frequencies
  const keywordCounts = {};
  mentions.forEach((m) => {
    m.matches.forEach((k) => {
      keywordCounts[k] = (keywordCounts[k] || 0) + 1;
    });
  });
  const topKeywords = Object.entries(keywordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const uniqueCustomers = new Set(mentions.map((m) => m.customer_id)).size;

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#fff' }}>Competitor Intel Dashboard</h1>
        <p style={{ color: '#9ca3af', fontSize: 14, marginTop: 4 }}>AI-aggregated insights from customer comments mentioning competitor switching</p>
      </div>

      {loading ? <p style={{ color: '#9ca3af' }}>Loading...</p> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: 16, marginBottom: 32 }}>
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>Total Mentions</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#ef4444' }}>{mentions.length}</div>
            </div>
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>Unique Customers</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#fff' }}>{uniqueCustomers}</div>
            </div>
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>Sources Scanned</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#22d3ee' }}>{allText.length}</div>
            </div>
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>Distinct Keywords</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#fff' }}>{topKeywords.length}</div>
            </div>
          </div>

          <div className="card" style={{ padding: 24, marginBottom: 24 }}>
            <h3 style={{ color: '#fff', marginTop: 0 }}>Top Competitor Keywords</h3>
            {topKeywords.length === 0 ? (
              <p style={{ color: '#10b981' }}>✓ No competitor mentions detected.</p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {topKeywords.map(([keyword, count]) => (
                  <div key={keyword} style={{
                    background: '#1a1a2e', padding: '8px 16px', borderRadius: 20,
                    display: 'flex', alignItems: 'center', gap: 8
                  }}>
                    <span style={{ color: '#fff', fontWeight: 600 }}>{keyword}</span>
                    <span style={{
                      background: '#ef4444', color: '#fff', padding: '2px 8px',
                      borderRadius: 10, fontSize: 11
                    }}>{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ color: '#fff', marginTop: 0 }}>Recent Mentions</h3>
            {mentions.length === 0 ? <p style={{ color: '#9ca3af' }}>No mentions detected.</p> : (
              <div style={{ maxHeight: 600, overflowY: 'auto' }}>
                {mentions.slice(0, 50).map((m) => (
                  <div key={`${m.source}-${m.id}`} style={{
                    background: '#1a1a2e', padding: 14, marginBottom: 10, borderRadius: 8,
                    borderLeft: '3px solid #ef4444'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <strong style={{ color: '#fff' }}>{m.customer_name || `Customer #${m.customer_id}`}</strong>
                      <span style={{ fontSize: 11, color: '#9ca3af' }}>{m.source}</span>
                    </div>
                    <p style={{ color: '#e0e0e0', fontSize: 13, margin: '4px 0' }}>{m.text.slice(0, 250)}{m.text.length > 250 ? '...' : ''}</p>
                    <div style={{ marginTop: 6 }}>
                      {m.matches.map((k) => (
                        <span key={k} style={{
                          display: 'inline-block', padding: '2px 8px', marginRight: 4,
                          background: '#2d2d4a', borderRadius: 6, fontSize: 11, color: '#fca5a5'
                        }}>{k}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default CompetitorIntel;
