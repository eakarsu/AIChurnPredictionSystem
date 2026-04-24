import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useToast } from './Toast';
import api from '../api';

function Dashboard() {
  const [stats, setStats] = useState(null);
  const [predictions, setPredictions] = useState([]);
  const [segments, setSegments] = useState([]);
  const [healthScores, setHealthScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAllData = async () => {
    try {
      const [statsRes, predictionsRes, segmentsRes, healthRes] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/predictions'),
        api.get('/segments'),
        api.get('/health'),
      ]);
      setStats(statsRes.data);
      setPredictions(predictionsRes.data);
      setSegments(segmentsRes.data);
      setHealthScores(healthRes.data);
    } catch (err) {
      toast.error('Failed to load dashboard data');
      console.error('Failed to fetch stats:', err);
    }
    setLoading(false);
  };

  if (loading) return <div className="loading"><div className="spinner"></div></div>;

  // Prepare chart data
  const pieData = [
    { name: 'Active', value: parseInt(stats?.customers?.active) || 0, color: '#10b981' },
    { name: 'At Risk', value: parseInt(stats?.customers?.at_risk) || 0, color: '#f59e0b' },
    { name: 'Churned', value: parseInt(stats?.customers?.churned) || 0, color: '#ef4444' },
  ];

  const riskDistribution = [
    { name: 'Low Risk', value: predictions.filter(p => parseFloat(p.prediction_score) < 30).length, color: '#10b981' },
    { name: 'Medium Risk', value: predictions.filter(p => parseFloat(p.prediction_score) >= 30 && parseFloat(p.prediction_score) < 70).length, color: '#f59e0b' },
    { name: 'High Risk', value: predictions.filter(p => parseFloat(p.prediction_score) >= 70).length, color: '#ef4444' },
  ];

  const segmentChurnData = segments.slice(0, 8).map(s => ({
    name: s.name.length > 15 ? s.name.substring(0, 15) + '...' : s.name,
    churnRate: parseFloat(s.churn_rate) || 0,
    revenue: parseFloat(s.avg_revenue) || 0,
  }));

  const healthTrendData = healthScores.slice(0, 10).map(h => ({
    name: h.customer_name?.split(' ')[0] || 'Unknown',
    health: parseFloat(h.overall_health) || 0,
    usage: parseFloat(h.product_usage) || 0,
    satisfaction: parseFloat(h.customer_satisfaction) || 0,
  }));

  const topAtRisk = predictions
    .filter(p => parseFloat(p.prediction_score) >= 50)
    .sort((a, b) => parseFloat(b.prediction_score) - parseFloat(a.prediction_score))
    .slice(0, 5);

  const cards = [
    { title: 'Total Customers', value: stats?.customers?.total || 0, icon: '👥', color: '#6366f1', change: '+12%', link: '/customers' },
    { title: 'Monthly Revenue', value: `$${parseFloat(stats?.revenue?.total_mrr || 0).toLocaleString()}`, icon: '💰', color: '#10b981', change: '+8%', link: '/billing' },
    { title: 'At-Risk Customers', value: stats?.customers?.at_risk || 0, icon: '⚠️', color: '#f59e0b', change: '-5%', link: '/predictions' },
    { title: 'High Risk Predictions', value: stats?.churn?.high_risk_count || 0, icon: '🎯', color: '#ef4444', change: '-3%', link: '/predictions' },
    { title: 'Unresolved Alerts', value: stats?.alerts?.unresolved || 0, icon: '🔔', color: '#22d3ee', change: '+2', link: '/alerts' },
    { title: 'Pending Interventions', value: stats?.interventions?.pending || 0, icon: '🛠️', color: '#8b5cf6', change: '0', link: '/interventions' },
  ];

  return (
    <div>
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.pageTitle}>Dashboard</h1>
          <p style={styles.pageSubtitle}>Overview of your churn prediction metrics</p>
        </div>
        <Link to="/ai-reports" className="btn btn-primary">
          Generate AI Report
        </Link>
      </div>

      {/* Stats Cards */}
      <div style={styles.statsGrid}>
        {cards.map((card, i) => (
          <div
            key={i}
            className="card"
            style={styles.statCardClickable}
            onClick={() => navigate(card.link)}
          >
            <div style={{ ...styles.statIcon, background: card.color }}>{card.icon}</div>
            <div style={styles.statContent}>
              <p style={styles.statLabel}>{card.title}</p>
              <p style={styles.statValue}>{card.value}</p>
              <span style={{
                ...styles.statChange,
                color: card.change.startsWith('+') ? '#10b981' : card.change.startsWith('-') ? '#ef4444' : '#9ca3af'
              }}>
                {card.change} vs last month
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div style={styles.chartsGrid}>
        <div className="card" style={styles.clickableCard} onClick={() => navigate('/customers')}>
          <h3 style={styles.cardTitle}>Customer Distribution</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={90}
                innerRadius={50}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {pieData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card" style={styles.clickableCard} onClick={() => navigate('/predictions')}>
          <h3 style={styles.cardTitle}>Risk Distribution</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={riskDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d2d4a" />
              <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
              <YAxis stroke="#9ca3af" fontSize={12} />
              <Tooltip
                contentStyle={{ background: '#1a1a2e', border: '1px solid #2d2d4a' }}
                labelStyle={{ color: '#fff' }}
              />
              <Bar dataKey="value" name="Customers">
                {riskDistribution.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div style={styles.chartsGrid}>
        <div className="card" style={styles.clickableCard} onClick={() => navigate('/segments')}>
          <h3 style={styles.cardTitle}>Segment Churn Rates</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={segmentChurnData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#2d2d4a" />
              <XAxis type="number" stroke="#9ca3af" fontSize={12} />
              <YAxis dataKey="name" type="category" stroke="#9ca3af" fontSize={11} width={100} />
              <Tooltip
                contentStyle={{ background: '#1a1a2e', border: '1px solid #2d2d4a' }}
                labelStyle={{ color: '#fff' }}
              />
              <Bar dataKey="churnRate" name="Churn Rate %" fill="#ef4444" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card" style={styles.clickableCard} onClick={() => navigate('/health-dashboard')}>
          <h3 style={styles.cardTitle}>Customer Health Scores</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={healthTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d2d4a" />
              <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
              <YAxis stroke="#9ca3af" fontSize={12} domain={[0, 100]} />
              <Tooltip
                contentStyle={{ background: '#1a1a2e', border: '1px solid #2d2d4a' }}
                labelStyle={{ color: '#fff' }}
              />
              <Legend />
              <Area type="monotone" dataKey="health" name="Overall Health" stroke="#6366f1" fill="rgba(99, 102, 241, 0.3)" />
              <Area type="monotone" dataKey="usage" name="Usage" stroke="#10b981" fill="rgba(16, 185, 129, 0.3)" />
              <Area type="monotone" dataKey="satisfaction" name="Satisfaction" stroke="#f59e0b" fill="rgba(245, 158, 11, 0.3)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom Section */}
      <div style={styles.chartsGrid}>
        <div className="card">
          <h3 style={styles.cardTitle}>Top At-Risk Customers</h3>
          {topAtRisk.length > 0 ? (
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Company</th>
                  <th>Risk Score</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {topAtRisk.map((p) => (
                  <tr key={p.id} style={styles.clickableRow} onClick={() => navigate('/predictions')}>
                    <td>{p.customer_name}</td>
                    <td>{p.company}</td>
                    <td>
                      <span className={`badge badge-${parseFloat(p.prediction_score) >= 70 ? 'danger' : 'warning'}`}>
                        {parseFloat(p.prediction_score).toFixed(1)}%
                      </span>
                    </td>
                    <td><span className="badge badge-info">{p.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={styles.noData}>No high-risk customers found</p>
          )}
          <Link to="/predictions" style={styles.viewAllLink}>View All Predictions →</Link>
        </div>

        <div className="card">
          <h3 style={styles.cardTitle}>Quick Actions</h3>
          <div style={styles.quickActions}>
            <Link to="/predictions" className="btn btn-primary" style={styles.actionBtn}>
              <span>🎯</span> Churn Predictions
            </Link>
            <Link to="/interventions" className="btn btn-secondary" style={styles.actionBtn}>
              <span>🛠️</span> Interventions
            </Link>
            <Link to="/alerts" className="btn btn-secondary" style={styles.actionBtn}>
              <span>🔔</span> Alerts
            </Link>
            <Link to="/customers" className="btn btn-secondary" style={styles.actionBtn}>
              <span>👥</span> Customers
            </Link>
          </div>
          <h3 style={{ ...styles.cardTitle, marginTop: '20px' }}>AI Features</h3>
          <div style={styles.quickActions}>
            <Link to="/sentiment" className="btn btn-secondary" style={{ ...styles.actionBtn, background: 'linear-gradient(135deg, #ec4899, #8b5cf6)', border: 'none' }}>
              <span>💬</span> AI Sentiment
            </Link>
            <Link to="/journeys" className="btn btn-secondary" style={{ ...styles.actionBtn, background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)', border: 'none' }}>
              <span>🗺️</span> AI Journey Map
            </Link>
            <Link to="/winback" className="btn btn-secondary" style={{ ...styles.actionBtn, background: 'linear-gradient(135deg, #f59e0b, #ef4444)', border: 'none' }}>
              <span>🎁</span> AI Win-Back
            </Link>
            <Link to="/health-dashboard" className="btn btn-secondary" style={{ ...styles.actionBtn, background: 'linear-gradient(135deg, #10b981, #22d3ee)', border: 'none' }}>
              <span>💚</span> AI Health Score
            </Link>
            <Link to="/escalations" className="btn btn-secondary" style={{ ...styles.actionBtn, background: 'linear-gradient(135deg, #ef4444, #f59e0b)', border: 'none' }}>
              <span>🚨</span> AI Escalations
            </Link>
            <Link to="/ai-reports" className="btn btn-secondary" style={styles.actionBtn}>
              <span>📊</span> AI Reports
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  pageHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '32px',
  },
  pageTitle: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#fff',
  },
  pageSubtitle: {
    color: '#9ca3af',
    fontSize: '14px',
    marginTop: '4px',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '20px',
    marginBottom: '32px',
  },
  statCard: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '16px',
  },
  statCardClickable: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '16px',
    cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s',
  },
  clickableCard: {
    cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s',
  },
  clickableRow: {
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  statIcon: {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
    flexShrink: 0,
  },
  statContent: {
    flex: 1,
  },
  statLabel: {
    color: '#9ca3af',
    fontSize: '12px',
    marginBottom: '4px',
  },
  statValue: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#fff',
    marginBottom: '4px',
  },
  statChange: {
    fontSize: '11px',
  },
  chartsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
    gap: '20px',
    marginBottom: '20px',
  },
  cardTitle: {
    fontSize: '16px',
    fontWeight: '600',
    marginBottom: '20px',
    color: '#fff',
  },
  quickActions: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '12px',
  },
  actionBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    justifyContent: 'center',
  },
  noData: {
    color: '#9ca3af',
    textAlign: 'center',
    padding: '20px',
  },
  viewAllLink: {
    display: 'block',
    textAlign: 'center',
    marginTop: '16px',
    color: '#6366f1',
    textDecoration: 'none',
    fontSize: '14px',
  },
};

export default Dashboard;
