import React from 'react';

// Risk Score Gauge Component
export function RiskGauge({ score, size = 120 }) {
  const percentage = Math.min(100, Math.max(0, score));
  const color = percentage > 70 ? '#ef4444' : percentage > 40 ? '#f59e0b' : '#10b981';
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div style={{ textAlign: 'center' }}>
      <svg width={size} height={size} viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="45" fill="none" stroke="#2d2d4a" strokeWidth="8" />
        <circle
          cx="50" cy="50" r="45" fill="none" stroke={color} strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform="rotate(-90 50 50)"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
        <text x="50" y="50" textAnchor="middle" dy="0.3em" fontSize="24" fontWeight="bold" fill={color}>
          {percentage.toFixed(0)}%
        </text>
      </svg>
      <p style={{ color: '#9ca3af', fontSize: '12px', marginTop: '8px' }}>Churn Risk</p>
    </div>
  );
}

// Confidence Bar Component
export function ConfidenceBar({ confidence }) {
  const percentage = Math.min(100, Math.max(0, confidence));
  const color = percentage > 80 ? '#10b981' : percentage > 50 ? '#f59e0b' : '#ef4444';

  return (
    <div style={styles.confidenceContainer}>
      <div style={styles.confidenceHeader}>
        <span style={styles.confidenceLabel}>AI Confidence</span>
        <span style={{ color, fontWeight: '600' }}>{percentage.toFixed(0)}%</span>
      </div>
      <div style={styles.confidenceTrack}>
        <div style={{ ...styles.confidenceFill, width: `${percentage}%`, background: color }} />
      </div>
    </div>
  );
}

// Factor Chips Component
export function FactorChips({ factors, title = "Risk Factors" }) {
  if (!factors || factors.length === 0) return null;

  return (
    <div style={styles.section}>
      <h4 style={styles.sectionTitle}>{title}</h4>
      <div style={styles.chipsContainer}>
        {factors.map((factor, i) => (
          <span key={i} style={styles.chip}>{factor}</span>
        ))}
      </div>
    </div>
  );
}

// Intervention Cards Component
export function InterventionCards({ interventions }) {
  if (!interventions || interventions.length === 0) return null;

  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#10b981';
      default: return '#6366f1';
    }
  };

  return (
    <div style={styles.section}>
      <h4 style={styles.sectionTitle}>Recommended Interventions</h4>
      <div style={styles.interventionGrid}>
        {interventions.map((intervention, i) => (
          <div key={i} style={styles.interventionCard}>
            <div style={styles.interventionHeader}>
              <span style={styles.interventionType}>{intervention.type || intervention}</span>
              {intervention.priority && (
                <span style={{ ...styles.priorityBadge, background: getPriorityColor(intervention.priority) }}>
                  {intervention.priority}
                </span>
              )}
            </div>
            {intervention.description && (
              <p style={styles.interventionDesc}>{intervention.description}</p>
            )}
            {intervention.effectiveness !== undefined && (
              <div style={styles.effectivenessRow}>
                <span style={styles.effectivenessLabel}>Effectiveness</span>
                <div style={styles.effectivenessBar}>
                  <div style={{ ...styles.effectivenessFill, width: `${intervention.effectiveness}%` }} />
                </div>
                <span style={styles.effectivenessValue}>{intervention.effectiveness}%</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Main AI Analysis Result Component
export function AIAnalysisResult({ result, onClose }) {
  if (!result) return null;

  return (
    <div style={styles.resultContainer}>
      <div style={styles.resultHeader}>
        <h3 style={styles.resultTitle}>AI Analysis Result</h3>
        {result.response_time_ms && (
          <span style={styles.responseTime}>Analyzed in {result.response_time_ms}ms</span>
        )}
      </div>

      <div style={styles.mainContent}>
        <div style={styles.gaugeSection}>
          <RiskGauge score={result.risk_score || 0} />
          <div style={styles.riskLabel}>
            {result.risk_score > 70 ? 'High Risk' : result.risk_score > 40 ? 'Medium Risk' : 'Low Risk'}
          </div>
        </div>

        <div style={styles.detailsSection}>
          {result.confidence !== undefined && (
            <ConfidenceBar confidence={result.confidence} />
          )}

          <FactorChips factors={result.factors} />

          <InterventionCards interventions={result.interventions} />
        </div>
      </div>

      {result.model_used && (
        <div style={styles.footer}>
          <span style={styles.modelInfo}>Model: {result.model_used}</span>
        </div>
      )}
    </div>
  );
}

// AI Suggestion Result Component (for interventions)
export function AISuggestionResult({ suggestions, customerName }) {
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div style={styles.resultContainer}>
      <div style={styles.resultHeader}>
        <h3 style={styles.resultTitle}>AI Suggested Interventions</h3>
        {customerName && <span style={styles.customerName}>for {customerName}</span>}
      </div>

      <InterventionCards interventions={suggestions} />
    </div>
  );
}

const styles = {
  resultContainer: {
    background: 'linear-gradient(135deg, #1a1a2e 0%, #252540 100%)',
    border: '1px solid #3d3d5a',
    borderRadius: '16px',
    padding: '24px',
    marginTop: '20px',
    marginBottom: '20px',
  },
  resultHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    paddingBottom: '16px',
    borderBottom: '1px solid #2d2d4a',
  },
  resultTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#fff',
    margin: 0,
  },
  responseTime: {
    fontSize: '12px',
    color: '#9ca3af',
    background: '#2d2d4a',
    padding: '4px 12px',
    borderRadius: '12px',
  },
  customerName: {
    fontSize: '14px',
    color: '#6366f1',
  },
  mainContent: {
    display: 'flex',
    gap: '32px',
    alignItems: 'flex-start',
  },
  gaugeSection: {
    textAlign: 'center',
    minWidth: '140px',
  },
  riskLabel: {
    marginTop: '8px',
    fontSize: '14px',
    fontWeight: '600',
    color: '#fff',
  },
  detailsSection: {
    flex: 1,
  },
  section: {
    marginBottom: '20px',
  },
  sectionTitle: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#6366f1',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '12px',
  },
  confidenceContainer: {
    marginBottom: '24px',
  },
  confidenceHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '8px',
  },
  confidenceLabel: {
    fontSize: '12px',
    color: '#9ca3af',
  },
  confidenceTrack: {
    height: '8px',
    background: '#2d2d4a',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    borderRadius: '4px',
    transition: 'width 0.5s ease',
  },
  chipsContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  chip: {
    background: 'rgba(99, 102, 241, 0.2)',
    color: '#a5b4fc',
    padding: '6px 14px',
    borderRadius: '20px',
    fontSize: '13px',
    border: '1px solid rgba(99, 102, 241, 0.3)',
  },
  interventionGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  interventionCard: {
    background: '#1a1a2e',
    border: '1px solid #2d2d4a',
    borderRadius: '12px',
    padding: '16px',
  },
  interventionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  interventionType: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#fff',
  },
  priorityBadge: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#fff',
    padding: '4px 10px',
    borderRadius: '12px',
    textTransform: 'uppercase',
  },
  interventionDesc: {
    fontSize: '13px',
    color: '#9ca3af',
    lineHeight: '1.5',
    margin: '8px 0',
  },
  effectivenessRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginTop: '12px',
  },
  effectivenessLabel: {
    fontSize: '11px',
    color: '#9ca3af',
    minWidth: '80px',
  },
  effectivenessBar: {
    flex: 1,
    height: '6px',
    background: '#2d2d4a',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  effectivenessFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #6366f1, #22d3ee)',
    borderRadius: '3px',
  },
  effectivenessValue: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#22d3ee',
    minWidth: '35px',
  },
  footer: {
    marginTop: '16px',
    paddingTop: '16px',
    borderTop: '1px solid #2d2d4a',
  },
  modelInfo: {
    fontSize: '11px',
    color: '#6b7280',
  },
};

export default AIAnalysisResult;
