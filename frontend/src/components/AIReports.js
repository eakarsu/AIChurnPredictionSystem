import React, { useState } from 'react';
import { useToast } from './Toast';
import api from '../api';

function AIReports() {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('report');
  const [reportType, setReportType] = useState('executive summary');
  const [report, setReport] = useState(null);
  const [revenueAnalysis, setRevenueAnalysis] = useState(null);
  const toast = useToast();

  const generateReport = async () => {
    setLoading(true);
    setReport(null);
    try {
      const res = await api.post('/ai/generate-report', { report_type: reportType });
      setReport(res.data);
      toast.success('Report generated successfully');
    } catch (err) {
      toast.error('Failed to generate report: ' + (err.response?.data?.error || err.message));
    }
    setLoading(false);
  };

  const analyzeRevenue = async () => {
    setLoading(true);
    setRevenueAnalysis(null);
    try {
      const res = await api.post('/ai/predict-revenue-impact');
      setRevenueAnalysis(res.data);
      toast.success('Revenue analysis complete');
    } catch (err) {
      toast.error('Failed to analyze revenue: ' + (err.response?.data?.error || err.message));
    }
    setLoading(false);
  };

  const exportReport = () => {
    if (!report) return;
    const content = `AI CHURN PREDICTION REPORT
Generated: ${new Date(report.generated_at).toLocaleString()}
Type: ${report.report_type?.toUpperCase()}

EXECUTIVE SUMMARY
${report.summary || 'N/A'}

RISK ASSESSMENT
${report.risk_assessment || 'N/A'}

RECOMMENDATIONS
${report.recommendations?.map((r, i) => `${i + 1}. ${r}`).join('\n') || 'N/A'}

ACTION ITEMS
${report.action_items?.map((a, i) => `${i + 1}. ${a}`).join('\n') || 'N/A'}`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `churn_report_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    toast.success('Report exported');
  };

  return (
    <div>
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.pageTitle}>AI Reports & Analytics</h1>
          <p style={styles.pageSubtitle}>Generate AI-powered insights and revenue predictions</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        <button
          style={{ ...styles.tab, ...(activeTab === 'report' ? styles.tabActive : {}) }}
          onClick={() => setActiveTab('report')}
        >
          <span style={styles.tabIcon}>📊</span> Generate Report
        </button>
        <button
          style={{ ...styles.tab, ...(activeTab === 'revenue' ? styles.tabActive : {}) }}
          onClick={() => setActiveTab('revenue')}
        >
          <span style={styles.tabIcon}>💰</span> Revenue Impact
        </button>
      </div>

      {/* Report Tab */}
      {activeTab === 'report' && (
        <div className="card" style={styles.mainCard}>
          <div style={styles.cardHeader}>
            <div>
              <h3 style={styles.cardTitle}>AI Report Generator</h3>
              <p style={styles.cardDesc}>Create comprehensive AI-generated reports about your customer base</p>
            </div>
            <div style={styles.selectWrapper}>
              <select value={reportType} onChange={(e) => setReportType(e.target.value)} style={styles.select}>
                <option value="executive summary">Executive Summary</option>
                <option value="churn analysis">Churn Analysis</option>
                <option value="customer health">Customer Health</option>
                <option value="intervention effectiveness">Intervention Effectiveness</option>
                <option value="segment performance">Segment Performance</option>
              </select>
            </div>
          </div>

          <button
            className="btn btn-primary"
            onClick={generateReport}
            disabled={loading}
            style={styles.generateBtn}
          >
            {loading ? (
              <><span className="spinner" style={{ width: 18, height: 18, marginRight: 10 }}></span> Generating Report...</>
            ) : (
              <><span style={{ marginRight: 10 }}>🤖</span> Generate AI Report</>
            )}
          </button>

          {report && (
            <div style={styles.reportResult}>
              <div style={styles.reportHeader}>
                <div style={styles.reportTitleSection}>
                  <span style={styles.reportIcon}>📋</span>
                  <div>
                    <h3 style={styles.reportTitle}>{report.report_type?.replace(/\b\w/g, l => l.toUpperCase())} Report</h3>
                    <span style={styles.reportDate}>{new Date(report.generated_at).toLocaleString()}</span>
                  </div>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={exportReport}>
                  Export
                </button>
              </div>

              {report.summary && (
                <div style={styles.section}>
                  <div style={styles.sectionHeader}>
                    <span style={styles.sectionIcon}>📝</span>
                    <h4 style={styles.sectionTitle}>Executive Summary</h4>
                  </div>
                  <p style={styles.summaryText}>{report.summary}</p>
                </div>
              )}

              {report.metrics && Object.keys(report.metrics).length > 0 && (
                <div style={styles.section}>
                  <div style={styles.sectionHeader}>
                    <span style={styles.sectionIcon}>📈</span>
                    <h4 style={styles.sectionTitle}>Key Metrics</h4>
                  </div>
                  <div style={styles.metricsGrid}>
                    {Object.entries(report.metrics).map(([key, value]) => (
                      <div key={key} style={styles.metricCard}>
                        <span style={styles.metricLabel}>{key.replace(/_/g, ' ')}</span>
                        <span style={styles.metricValue}>
                          {typeof value === 'number' ? value.toLocaleString() : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {report.risk_assessment && (
                <div style={styles.section}>
                  <div style={styles.sectionHeader}>
                    <span style={styles.sectionIcon}>⚠️</span>
                    <h4 style={styles.sectionTitle}>Risk Assessment</h4>
                  </div>
                  <div style={styles.riskBox}>
                    <p style={styles.riskText}>{report.risk_assessment}</p>
                  </div>
                </div>
              )}

              {report.recommendations?.length > 0 && (
                <div style={styles.section}>
                  <div style={styles.sectionHeader}>
                    <span style={styles.sectionIcon}>💡</span>
                    <h4 style={styles.sectionTitle}>Recommendations</h4>
                  </div>
                  <div style={styles.listContainer}>
                    {report.recommendations.map((rec, i) => (
                      <div key={i} style={styles.listItem}>
                        <span style={styles.listNumber}>{i + 1}</span>
                        <span style={styles.listText}>{rec}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {report.action_items?.length > 0 && (
                <div style={styles.section}>
                  <div style={styles.sectionHeader}>
                    <span style={styles.sectionIcon}>✅</span>
                    <h4 style={styles.sectionTitle}>Action Items</h4>
                  </div>
                  <div style={styles.actionList}>
                    {report.action_items.map((item, i) => (
                      <div key={i} style={styles.actionItem}>
                        <span style={styles.checkbox}>☐</span>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Revenue Tab */}
      {activeTab === 'revenue' && (
        <div className="card" style={styles.mainCard}>
          <div style={styles.cardHeader}>
            <div>
              <h3 style={styles.cardTitle}>Revenue Impact Prediction</h3>
              <p style={styles.cardDesc}>Analyze potential revenue impact from customer churn</p>
            </div>
          </div>

          <button
            className="btn btn-primary"
            onClick={analyzeRevenue}
            disabled={loading}
            style={styles.generateBtn}
          >
            {loading ? (
              <><span className="spinner" style={{ width: 18, height: 18, marginRight: 10 }}></span> Analyzing Revenue...</>
            ) : (
              <><span style={{ marginRight: 10 }}>💰</span> Analyze Revenue Impact</>
            )}
          </button>

          {revenueAnalysis && (
            <div style={styles.reportResult}>
              <div style={styles.reportHeader}>
                <div style={styles.reportTitleSection}>
                  <span style={styles.reportIcon}>💰</span>
                  <div>
                    <h3 style={styles.reportTitle}>Revenue Impact Analysis</h3>
                    <span style={styles.reportDate}>{new Date().toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Revenue Cards */}
              <div style={styles.revenueGrid}>
                <div style={styles.revenueCard}>
                  <span style={styles.revenueIcon}>💵</span>
                  <span style={styles.revenueLabel}>Total Monthly Revenue</span>
                  <span style={styles.revenueValue}>${parseFloat(revenueAnalysis.total_revenue || 0).toLocaleString()}</span>
                </div>
                <div style={{ ...styles.revenueCard, ...styles.dangerCard }}>
                  <span style={styles.revenueIcon}>⚠️</span>
                  <span style={styles.revenueLabel}>At-Risk Revenue</span>
                  <span style={{ ...styles.revenueValue, color: '#ef4444' }}>${parseFloat(revenueAnalysis.at_risk_revenue || 0).toLocaleString()}</span>
                </div>
                <div style={styles.revenueCard}>
                  <span style={styles.revenueIcon}>👥</span>
                  <span style={styles.revenueLabel}>At-Risk Customers</span>
                  <span style={styles.revenueValue}>{revenueAnalysis.at_risk_customers || 0}</span>
                </div>
              </div>

              {/* Projected Loss */}
              <div style={styles.section}>
                <div style={styles.sectionHeader}>
                  <span style={styles.sectionIcon}>📉</span>
                  <h4 style={styles.sectionTitle}>Projected Revenue Loss</h4>
                </div>
                <div style={styles.projectionGrid}>
                  <div style={styles.projectionCard}>
                    <span style={styles.projectionPeriod}>3 Months</span>
                    <span style={styles.projectionValue}>-${parseFloat(revenueAnalysis.projected_loss_3mo || 0).toLocaleString()}</span>
                  </div>
                  <div style={styles.projectionCard}>
                    <span style={styles.projectionPeriod}>6 Months</span>
                    <span style={styles.projectionValue}>-${parseFloat(revenueAnalysis.projected_loss_6mo || 0).toLocaleString()}</span>
                  </div>
                  <div style={styles.projectionCard}>
                    <span style={styles.projectionPeriod}>12 Months</span>
                    <span style={styles.projectionValue}>-${parseFloat(revenueAnalysis.projected_loss_12mo || 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Severity */}
              {revenueAnalysis.severity && (
                <div style={styles.section}>
                  <div style={styles.sectionHeader}>
                    <span style={styles.sectionIcon}>🎯</span>
                    <h4 style={styles.sectionTitle}>Impact Severity</h4>
                  </div>
                  <div style={styles.severityBadge(revenueAnalysis.severity)}>
                    {revenueAnalysis.severity}
                  </div>
                </div>
              )}

              {/* Confidence */}
              {revenueAnalysis.confidence !== undefined && (
                <div style={styles.section}>
                  <div style={styles.sectionHeader}>
                    <span style={styles.sectionIcon}>🎲</span>
                    <h4 style={styles.sectionTitle}>Confidence Level</h4>
                  </div>
                  <div style={styles.confidenceContainer}>
                    <div style={styles.confidenceBar}>
                      <div style={{ ...styles.confidenceFill, width: `${revenueAnalysis.confidence}%` }} />
                    </div>
                    <span style={styles.confidenceText}>{revenueAnalysis.confidence}%</span>
                  </div>
                </div>
              )}

              {/* Priority Actions */}
              {revenueAnalysis.priority_actions?.length > 0 && (
                <div style={styles.section}>
                  <div style={styles.sectionHeader}>
                    <span style={styles.sectionIcon}>🚀</span>
                    <h4 style={styles.sectionTitle}>Priority Actions</h4>
                  </div>
                  <div style={styles.actionList}>
                    {revenueAnalysis.priority_actions.map((action, i) => (
                      <div key={i} style={styles.priorityAction}>
                        <span style={styles.priorityNumber}>{i + 1}</span>
                        <span>{action}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  pageHeader: { marginBottom: '32px' },
  pageTitle: { fontSize: '28px', fontWeight: '700', color: '#fff' },
  pageSubtitle: { color: '#9ca3af', fontSize: '14px', marginTop: '4px' },

  tabs: { display: 'flex', gap: '8px', marginBottom: '24px' },
  tab: {
    display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px',
    background: '#1a1a2e', border: '1px solid #2d2d4a', borderRadius: '12px',
    color: '#9ca3af', fontSize: '14px', fontWeight: '500', cursor: 'pointer', transition: 'all 0.2s'
  },
  tabActive: { background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: '1px solid #6366f1', color: '#fff' },
  tabIcon: { fontSize: '18px' },

  mainCard: { padding: '32px' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' },
  cardTitle: { fontSize: '20px', fontWeight: '600', color: '#fff', margin: 0 },
  cardDesc: { color: '#9ca3af', fontSize: '14px', marginTop: '4px' },
  selectWrapper: { minWidth: '200px' },
  select: { width: '100%' },

  generateBtn: {
    padding: '14px 28px', fontSize: '15px', fontWeight: '600',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none'
  },

  reportResult: {
    marginTop: '32px', padding: '28px',
    background: 'linear-gradient(135deg, #1e1e32, #252545)',
    border: '1px solid #3d3d5a', borderRadius: '16px'
  },
  reportHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    paddingBottom: '20px', marginBottom: '24px', borderBottom: '1px solid #2d2d4a'
  },
  reportTitleSection: { display: 'flex', alignItems: 'center', gap: '16px' },
  reportIcon: { fontSize: '32px' },
  reportTitle: { margin: 0, fontSize: '18px', color: '#fff' },
  reportDate: { fontSize: '12px', color: '#9ca3af' },

  section: { marginBottom: '28px' },
  sectionHeader: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' },
  sectionIcon: { fontSize: '20px' },
  sectionTitle: { margin: 0, fontSize: '14px', fontWeight: '600', color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.5px' },

  summaryText: { color: '#e0e0e0', fontSize: '15px', lineHeight: '1.7', background: '#1a1a2e', padding: '20px', borderRadius: '12px', borderLeft: '4px solid #6366f1' },

  metricsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' },
  metricCard: {
    background: '#1a1a2e', padding: '16px', borderRadius: '12px', textAlign: 'center',
    display: 'flex', flexDirection: 'column', gap: '8px'
  },
  metricLabel: { fontSize: '11px', color: '#9ca3af', textTransform: 'capitalize' },
  metricValue: { fontSize: '20px', fontWeight: '700', color: '#fff' },

  riskBox: { background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px', padding: '20px' },
  riskText: { color: '#fca5a5', fontSize: '14px', lineHeight: '1.6', margin: 0 },

  listContainer: { display: 'flex', flexDirection: 'column', gap: '12px' },
  listItem: { display: 'flex', alignItems: 'flex-start', gap: '14px', background: '#1a1a2e', padding: '14px 18px', borderRadius: '10px' },
  listNumber: {
    width: '26px', height: '26px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '600', color: '#fff', flexShrink: 0
  },
  listText: { color: '#e0e0e0', fontSize: '14px', lineHeight: '1.5' },

  actionList: { display: 'flex', flexDirection: 'column', gap: '10px' },
  actionItem: { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: '#1a1a2e', borderRadius: '10px', color: '#e0e0e0', fontSize: '14px' },
  checkbox: { fontSize: '18px', color: '#6366f1' },

  revenueGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '28px' },
  revenueCard: {
    background: '#1a1a2e', padding: '24px', borderRadius: '16px', textAlign: 'center',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', border: '1px solid #2d2d4a'
  },
  dangerCard: { borderColor: 'rgba(239, 68, 68, 0.5)', background: 'rgba(239, 68, 68, 0.05)' },
  revenueIcon: { fontSize: '28px' },
  revenueLabel: { fontSize: '12px', color: '#9ca3af' },
  revenueValue: { fontSize: '28px', fontWeight: '700', color: '#fff' },

  projectionGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' },
  projectionCard: {
    background: '#1a1a2e', padding: '20px', borderRadius: '12px', textAlign: 'center',
    display: 'flex', flexDirection: 'column', gap: '8px'
  },
  projectionPeriod: { fontSize: '13px', color: '#9ca3af' },
  projectionValue: { fontSize: '22px', fontWeight: '700', color: '#ef4444' },

  severityBadge: (severity) => ({
    display: 'inline-block', padding: '10px 24px', borderRadius: '8px', fontSize: '15px', fontWeight: '600',
    background: severity === 'High' || severity === 'Critical' ? 'rgba(239, 68, 68, 0.2)' : severity === 'Medium' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)',
    color: severity === 'High' || severity === 'Critical' ? '#ef4444' : severity === 'Medium' ? '#f59e0b' : '#10b981'
  }),

  confidenceContainer: { display: 'flex', alignItems: 'center', gap: '16px' },
  confidenceBar: { flex: 1, height: '12px', background: '#2d2d4a', borderRadius: '6px', overflow: 'hidden' },
  confidenceFill: { height: '100%', background: 'linear-gradient(90deg, #6366f1, #22d3ee)', borderRadius: '6px', transition: 'width 0.5s' },
  confidenceText: { fontSize: '18px', fontWeight: '700', color: '#22d3ee', minWidth: '50px' },

  priorityAction: {
    display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 18px',
    background: '#1a1a2e', borderRadius: '10px', color: '#e0e0e0', fontSize: '14px'
  },
  priorityNumber: {
    width: '28px', height: '28px', borderRadius: '8px', background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '700', color: '#fff'
  },
};

export default AIReports;
