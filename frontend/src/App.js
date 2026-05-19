import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';

// Components
import { ToastProvider, useToast } from './components/Toast';
import GenericList from './components/GenericList';
import Dashboard from './components/Dashboard';
import AIReports from './components/AIReports';
import ErrorBoundary from './components/ErrorBoundary';
import CohortSurvival from './components/CohortSurvival';
import InterventionPerformance from './components/InterventionPerformance';
import ChurnTriggers from './components/ChurnTriggers';
import WinbackOrchestration from './components/WinbackOrchestration';
import FeatureCorrelation from './components/FeatureCorrelation';
import CompetitorIntel from './components/CompetitorIntel';
import ForecastConfidence from './components/ForecastConfidence';
import BatchInterventions from './components/BatchInterventions';
import CustomViewsPage from './components/CustomViewsPage';
import api, { API_URL } from './api';

// Auth Context
const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

// ============ PASSWORD STRENGTH VALIDATOR ============
function PasswordStrengthBar({ password }) {
  const getStrength = (pwd) => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[a-z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) score++;
    return score;
  };

  const strength = getStrength(password);
  const colors = ['#ef4444', '#ef4444', '#f59e0b', '#f59e0b', '#10b981', '#10b981', '#10b981'];
  const labels = ['', 'Very Weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'];

  if (!password) return null;

  return (
    <div style={{ marginTop: '8px' }}>
      <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
        {[1,2,3,4,5,6].map(i => (
          <div key={i} style={{ flex: 1, height: '4px', borderRadius: '2px', background: i <= strength ? colors[strength] : '#2d2d4a' }} />
        ))}
      </div>
      <span style={{ fontSize: '11px', color: colors[strength] }}>{labels[strength]}</span>
    </div>
  );
}

// ============ FORM VALIDATION HELPERS ============
function FormError({ message }) {
  if (!message) return null;
  return <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>{message}</span>;
}

function useFormValidation(rules) {
  const [errors, setErrors] = useState({});

  const validate = (form) => {
    const newErrors = {};
    for (const [field, fieldRules] of Object.entries(rules)) {
      const value = form[field];
      for (const rule of fieldRules) {
        if (rule.required && (!value || !String(value).trim())) {
          newErrors[field] = rule.message || `${field} is required`;
          break;
        }
        if (rule.minLength && value && String(value).length < rule.minLength) {
          newErrors[field] = rule.message || `Minimum ${rule.minLength} characters`;
          break;
        }
        if (rule.pattern && value && !rule.pattern.test(String(value))) {
          newErrors[field] = rule.message || 'Invalid format';
          break;
        }
        if (rule.custom && value) {
          const err = rule.custom(value, form);
          if (err) { newErrors[field] = err; break; }
        }
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  return { errors, validate, setErrors };
}

// ============ LOGIN PAGE ============
function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await axios.post(`${API_URL}/auth/login`, { email, password });
      login(res.data.token, res.data.user);
      toast.success('Welcome back!');
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
      toast.error('Login failed');
    }
    setLoading(false);
  };

  const fillDemo = () => {
    setEmail('demo@churnpredict.com');
    setPassword('password123');
  };

  return (
    <div style={styles.loginContainer}>
      <div style={styles.loginCard}>
        <div style={styles.loginHeader}>
          <h1 style={styles.loginTitle}>AI Churn Prediction</h1>
          <p style={styles.loginSubtitle}>Predict and prevent customer churn</p>
        </div>

        <form onSubmit={handleSubmit}>
          {error && <div style={styles.error}>{error}</div>}

          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginBottom: '12px' }} disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>

          <button type="button" className="btn btn-secondary" style={{ width: '100%', marginBottom: '12px' }} onClick={fillDemo}>
            Fill Demo Credentials
          </button>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
            <Link to="/register" style={{ color: '#6366f1', fontSize: '13px', textDecoration: 'none' }}>Create Account</Link>
            <Link to="/forgot-password" style={{ color: '#6366f1', fontSize: '13px', textDecoration: 'none' }}>Forgot Password?</Link>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============ REGISTRATION PAGE ============
function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', phone: '', department: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const { errors, validate } = useFormValidation({
    name: [{ required: true, message: 'Name is required' }, { minLength: 2, message: 'Name must be at least 2 characters' }],
    email: [{ required: true, message: 'Email is required' }, { pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Invalid email format' }],
    password: [{ required: true, message: 'Password is required' }, { minLength: 8, message: 'Minimum 8 characters' }, {
      custom: (v) => {
        if (!/[A-Z]/.test(v)) return 'Must have uppercase letter';
        if (!/[a-z]/.test(v)) return 'Must have lowercase letter';
        if (!/[0-9]/.test(v)) return 'Must have a number';
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(v)) return 'Must have special character';
        return null;
      }
    }],
    confirmPassword: [{ required: true, message: 'Please confirm password' }, { custom: (v, f) => v !== f.password ? 'Passwords do not match' : null }],
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate(form)) return;
    setLoading(true);
    setError('');
    try {
      const res = await axios.post(`${API_URL}/auth/register`, { name: form.name, email: form.email, password: form.password, phone: form.phone, department: form.department });
      login(res.data.token, res.data.user);
      toast.success('Account created! Please verify your email.');
      navigate('/');
    } catch (err) {
      const msg = err.response?.data?.error || 'Registration failed';
      const details = err.response?.data?.details;
      setError(details ? `${msg}: ${Array.isArray(details) ? details.join(', ') : details}` : msg);
      toast.error(msg);
    }
    setLoading(false);
  };

  return (
    <div style={styles.loginContainer}>
      <div style={{ ...styles.loginCard, maxWidth: '500px' }}>
        <div style={styles.loginHeader}>
          <h1 style={styles.loginTitle}>Create Account</h1>
          <p style={styles.loginSubtitle}>Join AI Churn Prediction System</p>
        </div>
        <form onSubmit={handleSubmit}>
          {error && <div style={styles.error}>{error}</div>}
          <div className="form-row">
            <div className="form-group"><label>Full Name *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="John Doe" /><FormError message={errors.name} /></div>
            <div className="form-group"><label>Email *</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="john@company.com" /><FormError message={errors.email} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Password *</label><input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min 8 chars, upper, lower, number, special" /><PasswordStrengthBar password={form.password} /><FormError message={errors.password} /></div>
            <div className="form-group"><label>Confirm Password *</label><input type="password" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} placeholder="Re-enter password" /><FormError message={errors.confirmPassword} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Phone</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+1-555-0100" /></div>
            <div className="form-group"><label>Department</label><input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="Sales, Engineering, etc." /></div>
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginBottom: '12px' }} disabled={loading}>
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
          <div style={{ textAlign: 'center', marginTop: '12px' }}>
            <Link to="/login" style={{ color: '#6366f1', fontSize: '13px', textDecoration: 'none' }}>Already have an account? Login</Link>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============ FORGOT PASSWORD PAGE ============
function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await axios.post(`${API_URL}/auth/forgot-password`, { email });
      setSubmitted(true);
      if (res.data.reset_token) setResetToken(res.data.reset_token);
      toast.success('Reset link sent (check console for demo)');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send reset link');
    }
    setLoading(false);
  };

  return (
    <div style={styles.loginContainer}>
      <div style={styles.loginCard}>
        <div style={styles.loginHeader}>
          <h1 style={styles.loginTitle}>Reset Password</h1>
          <p style={styles.loginSubtitle}>Enter your email to receive a reset link</p>
        </div>
        {submitted ? (
          <div>
            <div style={{ ...styles.error, background: 'rgba(16, 185, 129, 0.2)', borderColor: '#10b981', color: '#10b981' }}>
              If an account exists with that email, a reset link has been sent.
            </div>
            {resetToken && (
              <div style={{ marginTop: '16px' }}>
                <p style={{ color: '#9ca3af', fontSize: '12px', marginBottom: '8px' }}>Demo Reset Token:</p>
                <code style={{ background: '#2d2d4a', padding: '8px', borderRadius: '4px', fontSize: '11px', color: '#22d3ee', wordBreak: 'break-all', display: 'block' }}>{resetToken}</code>
                <Link to={`/reset-password?token=${resetToken}`} className="btn btn-primary" style={{ width: '100%', marginTop: '16px', display: 'block', textAlign: 'center' }}>
                  Reset Password Now
                </Link>
              </div>
            )}
            <Link to="/login" style={{ color: '#6366f1', fontSize: '13px', textDecoration: 'none', display: 'block', textAlign: 'center', marginTop: '16px' }}>Back to Login</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && <div style={styles.error}>{error}</div>}
            <div className="form-group"><label>Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email" required /></div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginBottom: '12px' }} disabled={loading}>
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
            <Link to="/login" style={{ color: '#6366f1', fontSize: '13px', textDecoration: 'none', display: 'block', textAlign: 'center' }}>Back to Login</Link>
          </form>
        )}
      </div>
    </div>
  );
}

// ============ RESET PASSWORD PAGE ============
function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  const token = new URLSearchParams(window.location.search).get('token');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    setLoading(true);
    setError('');
    try {
      await axios.post(`${API_URL}/auth/reset-password`, { token, password });
      setSuccess(true);
      toast.success('Password reset successfully!');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      const details = err.response?.data?.details;
      setError(details ? (Array.isArray(details) ? details.join(', ') : details) : (err.response?.data?.error || 'Reset failed'));
    }
    setLoading(false);
  };

  return (
    <div style={styles.loginContainer}>
      <div style={styles.loginCard}>
        <div style={styles.loginHeader}>
          <h1 style={styles.loginTitle}>New Password</h1>
          <p style={styles.loginSubtitle}>Enter your new password</p>
        </div>
        {success ? (
          <div style={{ ...styles.error, background: 'rgba(16, 185, 129, 0.2)', borderColor: '#10b981', color: '#10b981' }}>
            Password reset successfully! Redirecting to login...
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && <div style={styles.error}>{error}</div>}
            <div className="form-group"><label>New Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /><PasswordStrengthBar password={password} /></div>
            <div className="form-group"><label>Confirm Password</label><input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required /></div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ============ USER PROFILE PAGE ============
function UserProfile() {
  const { user, login } = useAuth();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', department: '' });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const toast = useToast();

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await api.get('/auth/profile');
      setProfile(res.data);
      setForm({ name: res.data.name, phone: res.data.phone || '', department: res.data.department || '' });
    } catch (err) { toast.error('Failed to load profile'); }
    setLoading(false);
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.put('/auth/profile', form);
      setProfile(res.data);
      login(localStorage.getItem('token'), { ...user, name: res.data.name });
      toast.success('Profile updated successfully');
    } catch (err) { toast.error('Failed to update profile'); }
    setSaving(false);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setChangingPassword(true);
    try {
      await api.put('/auth/change-password', { currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword });
      toast.success('Password changed successfully');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setShowPasswordSection(false);
    } catch (err) {
      const details = err.response?.data?.details;
      toast.error(details ? (Array.isArray(details) ? details.join(', ') : details) : (err.response?.data?.error || 'Failed to change password'));
    }
    setChangingPassword(false);
  };

  if (loading) return <div className="loading"><div className="spinner"></div></div>;

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#fff' }}>User Profile</h1>
        <p style={{ color: '#9ca3af', fontSize: '14px', marginTop: '4px' }}>Manage your account settings</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Profile Info Card */}
        <div className="card">
          <h3 style={{ color: '#fff', marginBottom: '20px', fontSize: '18px' }}>Profile Information</h3>
          <form onSubmit={handleUpdateProfile}>
            <div className="form-group"><label>Name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div className="form-group"><label>Email</label><input value={profile?.email || ''} disabled style={{ opacity: 0.6 }} /></div>
            <div className="form-group"><label>Phone</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+1-555-0100" /></div>
            <div className="form-group"><label>Department</label><input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="Sales, Engineering, etc." /></div>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Update Profile'}</button>
          </form>
        </div>

        {/* Account Details Card */}
        <div className="card">
          <h3 style={{ color: '#fff', marginBottom: '20px', fontSize: '18px' }}>Account Details</h3>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #2d2d4a' }}>
              <span style={{ color: '#9ca3af' }}>Role</span>
              <span style={{ color: '#fff', textTransform: 'capitalize' }}>{profile?.role}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #2d2d4a' }}>
              <span style={{ color: '#9ca3af' }}>Email Verified</span>
              <span style={{ color: profile?.email_verified ? '#10b981' : '#ef4444' }}>{profile?.email_verified ? 'Verified' : 'Not Verified'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #2d2d4a' }}>
              <span style={{ color: '#9ca3af' }}>Member Since</span>
              <span style={{ color: '#fff' }}>{profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'N/A'}</span>
            </div>
          </div>

          <button className="btn btn-secondary" style={{ width: '100%', marginTop: '8px' }} onClick={() => setShowPasswordSection(!showPasswordSection)}>
            {showPasswordSection ? 'Cancel Password Change' : 'Change Password'}
          </button>

          {showPasswordSection && (
            <form onSubmit={handleChangePassword} style={{ marginTop: '20px' }}>
              <div className="form-group"><label>Current Password</label><input type="password" value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} required /></div>
              <div className="form-group"><label>New Password</label><input type="password" value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} required /><PasswordStrengthBar password={passwordForm.newPassword} /></div>
              <div className="form-group"><label>Confirm New Password</label><input type="password" value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} required /></div>
              <button type="submit" className="btn btn-primary" disabled={changingPassword}>{changingPassword ? 'Changing...' : 'Change Password'}</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ============ LAYOUT ============
function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const menuItems = [
    { path: '/', label: 'Dashboard', icon: '📊' },
    { path: '/customers', label: 'Customers', icon: '👥' },
    { path: '/predictions', label: 'Churn Predictions', icon: '🎯' },
    { path: '/risk-scores', label: 'Risk Scores', icon: '⚠️' },
    { path: '/segments', label: 'Segments', icon: '📦' },
    { path: '/interventions', label: 'Interventions', icon: '🛠️' },
    { path: '/behavior', label: 'Behavior Analytics', icon: '📈' },
    { path: '/metrics', label: 'Usage Metrics', icon: '📉' },
    { path: '/engagement', label: 'Engagement', icon: '💫' },
    { path: '/tickets', label: 'Support Tickets', icon: '🎫' },
    { path: '/billing', label: 'Billing History', icon: '💳' },
    { path: '/features', label: 'Feature Usage', icon: '⚡' },
    { path: '/sessions', label: 'User Sessions', icon: '🔗' },
    { path: '/nps', label: 'NPS Scores', icon: '⭐' },
    { path: '/health', label: 'Health Scores', icon: '❤️' },
    { path: '/alerts', label: 'Alerts', icon: '🔔' },
    { path: '/sentiment', label: 'AI Sentiment', icon: '💬' },
    { path: '/journeys', label: 'AI Journey Map', icon: '🗺️' },
    { path: '/winback', label: 'AI Win-Back', icon: '🎁' },
    { path: '/health-dashboard', label: 'AI Health Score', icon: '💚' },
    { path: '/escalations', label: 'AI Escalations', icon: '🚨' },
    { path: '/service-levels', label: 'AI Service Level', icon: '⏱️' },
    { path: '/response-suggestions', label: 'AI Response', icon: '💡' },
    { path: '/ai-reports', label: 'AI Reports', icon: '🤖' },
    { path: '/cohort-survival', label: 'Cohort Survival', icon: '📅' },
    { path: '/intervention-performance', label: 'Intervention Performance', icon: '📊' },
    { path: '/churn-triggers', label: 'Churn Triggers', icon: '🚨' },
    { path: '/winback-orchestration', label: 'Win-Back Orchestrator', icon: '🎯' },
    { path: '/feature-correlation', label: 'Feature Correlation', icon: '🔗' },
    { path: '/competitor-intel', label: 'Competitor Intel', icon: '🕵️' },
    { path: '/forecast-confidence', label: 'Forecast Confidence', icon: '📈' },
    { path: '/batch-interventions', label: 'Batch Scheduling', icon: '📆' },
    { path: '/custom-views', label: 'Retention Views', icon: '🧩' },
    { path: '/profile', label: 'User Profile', icon: '👤' },
  ];

  const handleLogout = async () => {
    try { await api.post('/auth/logout'); } catch (e) { /* ignore */ }
    logout();
    toast.info('Logged out successfully');
    navigate('/login');
  };

  return (
    <div style={styles.layout}>
      <aside style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <h2 style={styles.logo}>ChurnPredict AI</h2>
        </div>
        <nav style={styles.nav}>
          {menuItems.map((item) => (
            <Link key={item.path} to={item.path} style={styles.navItem}>
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div style={styles.sidebarFooter}>
          <div style={styles.userInfo}>
            <span>{user?.name}</span>
            <button onClick={handleLogout} className="btn btn-secondary btn-sm">
              Logout
            </button>
          </div>
        </div>
      </aside>
      <main style={styles.main}>{children}</main>
    </div>
  );
}

// ============ FORM COMPONENTS ============

// Customer Form
function CustomerForm({ item, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: item?.name || '',
    email: item?.email || '',
    company: item?.company || '',
    plan: item?.plan || 'Starter',
    monthly_revenue: item?.monthly_revenue || '',
    signup_date: item?.signup_date?.split('T')[0] || new Date().toISOString().split('T')[0],
    status: item?.status || 'active',
  });
  const [aiLoading, setAiLoading] = useState(false);
  const toast = useToast();

  const handleAIAnalysis = async () => {
    if (!form.name && !form.company) { toast.warning('Please enter name or company first'); return; }
    setAiLoading(true);
    try {
      const res = await api.post('/ai/analyze-customer', { name: form.name, company: form.company, email: form.email });
      console.log('AI Customer Response:', res.data);
      setForm(prev => ({ ...prev, name: res.data.name || prev.name, email: res.data.email || prev.email, company: res.data.company || prev.company, plan: res.data.plan || prev.plan, monthly_revenue: res.data.monthly_revenue || prev.monthly_revenue, signup_date: res.data.signup_date || prev.signup_date, status: res.data.status || prev.status }));
      toast.success(`AI analysis complete in ${res.data.response_time_ms}ms`);
    } catch (err) { toast.error('AI analysis failed: ' + (err.response?.data?.error || err.message)); }
    setAiLoading(false);
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
      <div className="form-row">
        <div className="form-group">
          <label>Name *</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </div>
        <div className="form-group">
          <label>Email *</label>
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </div>
      </div>
      <div className="form-group">
        <label>Company</label>
        <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
      </div>
      <button type="button" className="btn btn-primary" onClick={handleAIAnalysis} disabled={aiLoading} style={{ marginBottom: '16px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
        {aiLoading ? <><span className="spinner" style={{ width: 16, height: 16, marginRight: 8 }}></span> Analyzing...</> : <><span style={{ marginRight: 8 }}>🤖</span> AI Suggest Plan & Revenue</>}
      </button>
      <div className="form-row">
        <div className="form-group">
          <label>Plan</label>
          <select value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })}>
            <option value="Starter">Starter</option>
            <option value="Professional">Professional</option>
            <option value="Enterprise">Enterprise</option>
          </select>
        </div>
        <div className="form-group">
          <label>Monthly Revenue</label>
          <input type="number" value={form.monthly_revenue} onChange={(e) => setForm({ ...form, monthly_revenue: e.target.value })} />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Status</label>
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="active">Active</option>
            <option value="at-risk">At Risk</option>
            <option value="churned">Churned</option>
          </select>
        </div>
        <div className="form-group">
          <label>Signup Date</label>
          <div className="date-input-wrapper">
            <input type="date" value={form.signup_date} onChange={(e) => setForm({ ...form, signup_date: e.target.value })} />
          </div>
        </div>
      </div>
      <div style={styles.formActions}>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary">Save</button>
      </div>
    </form>
  );
}

// Prediction Form
function PredictionForm({ item, onSave, onCancel }) {
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({
    customer_id: item?.customer_id || '',
    prediction_score: item?.prediction_score || '',
    confidence_level: item?.confidence_level || '',
    factors: item?.factors?.join(', ') || '',
    status: item?.status || 'pending',
    ai_analysis: item?.ai_analysis || '',
  });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const toast = useToast();

  useEffect(() => { api.get('/customers').then((res) => setCustomers(res.data)); }, []);

  const handleAIAnalysis = async () => {
    if (!form.customer_id) { toast.warning('Please select a customer first'); return; }
    setAiLoading(true);
    setAiResult(null);
    try {
      const res = await api.post('/ai/analyze-churn', { customer_id: form.customer_id });
      console.log('AI Churn Response:', res.data);
      setAiResult(res.data);
      setForm(prev => ({
        ...prev,
        prediction_score: res.data.risk_score,
        confidence_level: res.data.confidence,
        factors: res.data.factors?.join(', ') || '',
        ai_analysis: JSON.stringify(res.data, null, 2),
        status: res.data.risk_score > 70 ? 'high-risk' : res.data.risk_score > 40 ? 'medium-risk' : 'low-risk',
      }));
      toast.success('AI analysis complete');
    } catch (err) {
      toast.error('AI analysis failed: ' + (err.response?.data?.error || err.message));
      console.error('AI Error:', err.response?.data);
    }
    setAiLoading(false);
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave({ ...form, factors: form.factors.split(',').map(f => f.trim()).filter(f => f) }); }}>
      <div className="form-group">
        <label>Customer *</label>
        <select value={form.customer_id} onChange={(e) => { setForm({ ...form, customer_id: e.target.value }); setAiResult(null); }} required>
          <option value="">Select customer</option>
          {customers.map((c) => (<option key={c.id} value={c.id}>{c.name} ({c.company})</option>))}
        </select>
      </div>

      <button type="button" className="btn btn-primary" onClick={handleAIAnalysis} disabled={aiLoading} style={{ marginBottom: '16px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
        {aiLoading ? (
          <><span className="spinner" style={{ width: 16, height: 16, marginRight: 8 }}></span> Analyzing with AI...</>
        ) : (
          <><span style={{ marginRight: 8 }}>🤖</span> Run AI Analysis</>
        )}
      </button>

      {aiResult && (
        <div style={aiResultStyles.container}>
          <div style={aiResultStyles.header}>
            <h4 style={aiResultStyles.title}>AI Analysis Result</h4>
            {aiResult.response_time_ms && <span style={aiResultStyles.time}>{aiResult.response_time_ms}ms</span>}
          </div>

          <div style={aiResultStyles.scoreSection}>
            <div style={aiResultStyles.gauge}>
              <svg width="100" height="100" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#2d2d4a" strokeWidth="8" />
                <circle cx="50" cy="50" r="40" fill="none"
                  stroke={aiResult.risk_score > 70 ? '#ef4444' : aiResult.risk_score > 40 ? '#f59e0b' : '#10b981'}
                  strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={`${(aiResult.risk_score / 100) * 251.2} 251.2`}
                  transform="rotate(-90 50 50)"
                />
                <text x="50" y="55" textAnchor="middle" fontSize="20" fontWeight="bold"
                  fill={aiResult.risk_score > 70 ? '#ef4444' : aiResult.risk_score > 40 ? '#f59e0b' : '#10b981'}>
                  {aiResult.risk_score}%
                </text>
              </svg>
              <p style={aiResultStyles.gaugeLabel}>Churn Risk</p>
            </div>

            <div style={aiResultStyles.details}>
              <div style={aiResultStyles.confBar}>
                <span>Confidence: {aiResult.confidence}%</span>
                <div style={aiResultStyles.barTrack}>
                  <div style={{ ...aiResultStyles.barFill, width: `${aiResult.confidence}%` }} />
                </div>
              </div>

              {aiResult.factors?.length > 0 && (
                <div style={aiResultStyles.factors}>
                  <p style={aiResultStyles.label}>Risk Factors:</p>
                  <div style={aiResultStyles.chips}>
                    {aiResult.factors.map((f, i) => <span key={i} style={aiResultStyles.chip}>{f}</span>)}
                  </div>
                </div>
              )}
            </div>
          </div>

          {aiResult.interventions?.length > 0 && (
            <div style={aiResultStyles.interventions}>
              <p style={aiResultStyles.label}>Recommended Actions:</p>
              {aiResult.interventions.map((inv, i) => (
                <div key={i} style={aiResultStyles.invCard}>
                  <span style={aiResultStyles.invIcon}>💡</span>
                  <span>{typeof inv === 'string' ? inv : inv.description || inv.type}</span>
                </div>
              ))}
            </div>
          )}

          {aiResult.model_used && <p style={aiResultStyles.model}>Model: {aiResult.model_used}</p>}
        </div>
      )}

      <div className="form-row">
        <div className="form-group">
          <label>Prediction Score (0-100) *</label>
          <input type="number" min="0" max="100" value={form.prediction_score} onChange={(e) => setForm({ ...form, prediction_score: e.target.value })} required />
        </div>
        <div className="form-group">
          <label>Confidence Level (0-100)</label>
          <input type="number" min="0" max="100" value={form.confidence_level} onChange={(e) => setForm({ ...form, confidence_level: e.target.value })} />
        </div>
      </div>
      <div className="form-group">
        <label>Risk Factors (comma-separated)</label>
        <input value={form.factors} onChange={(e) => setForm({ ...form, factors: e.target.value })} placeholder="Factor 1, Factor 2" />
      </div>
      <div className="form-group">
        <label>Status</label>
        <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
          <option value="pending">Pending</option>
          <option value="low-risk">Low Risk</option>
          <option value="medium-risk">Medium Risk</option>
          <option value="high-risk">High Risk</option>
          <option value="churned">Churned</option>
        </select>
      </div>
      <div style={styles.formActions}>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary">Save</button>
      </div>
    </form>
  );
}

const aiResultStyles = {
  container: { background: 'linear-gradient(135deg, #1e1e32, #252545)', border: '1px solid #3d3d5a', borderRadius: '16px', padding: '20px', marginBottom: '20px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #2d2d4a' },
  title: { margin: 0, fontSize: '16px', color: '#fff' },
  time: { fontSize: '11px', color: '#9ca3af', background: '#2d2d4a', padding: '4px 10px', borderRadius: '10px' },
  scoreSection: { display: 'flex', gap: '24px', alignItems: 'flex-start' },
  gauge: { textAlign: 'center' },
  gaugeLabel: { fontSize: '12px', color: '#9ca3af', marginTop: '8px' },
  details: { flex: 1 },
  confBar: { marginBottom: '16px', fontSize: '13px', color: '#e0e0e0' },
  barTrack: { height: '6px', background: '#2d2d4a', borderRadius: '3px', marginTop: '6px', overflow: 'hidden' },
  barFill: { height: '100%', background: 'linear-gradient(90deg, #6366f1, #22d3ee)', borderRadius: '3px' },
  factors: { marginBottom: '12px' },
  label: { fontSize: '12px', color: '#6366f1', marginBottom: '8px', fontWeight: '600', textTransform: 'uppercase' },
  chips: { display: 'flex', flexWrap: 'wrap', gap: '6px' },
  chip: { background: 'rgba(99, 102, 241, 0.2)', color: '#a5b4fc', padding: '4px 12px', borderRadius: '12px', fontSize: '12px' },
  interventions: { marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #2d2d4a' },
  invCard: { display: 'flex', alignItems: 'center', gap: '10px', background: '#1a1a2e', padding: '10px 14px', borderRadius: '8px', marginTop: '8px', fontSize: '13px', color: '#e0e0e0' },
  invIcon: { fontSize: '16px' },
  model: { fontSize: '10px', color: '#6b7280', marginTop: '12px' },
};

// Risk Score Form
function RiskScoreForm({ item, onSave, onCancel }) {
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({
    customer_id: item?.customer_id || '',
    risk_level: item?.risk_level || 'Low',
    score: item?.score || '',
    category: item?.category || '',
    contributing_factors: item?.contributing_factors?.join(', ') || '',
    recommended_actions: item?.recommended_actions?.join(', ') || '',
    ai_response: item?.ai_response || null,
    ai_response_time_ms: item?.ai_response_time_ms || null,
  });
  const [aiLoading, setAiLoading] = useState(false);
  const toast = useToast();

  useEffect(() => { api.get('/customers').then((res) => setCustomers(res.data)); }, []);

  const handleAIAnalysis = async () => {
    if (!form.customer_id) { toast.warning('Please select a customer first'); return; }
    setAiLoading(true);
    try {
      const res = await api.post('/ai/analyze-risk', { customer_id: form.customer_id });
      console.log('AI Risk Response:', res.data);
      setForm(prev => ({
        ...prev,
        risk_level: res.data.risk_level || 'Medium',
        score: res.data.score || '',
        category: res.data.category || '',
        contributing_factors: res.data.contributing_factors?.join(', ') || '',
        recommended_actions: res.data.recommended_actions?.join(', ') || '',
        ai_response: res.data,
        ai_response_time_ms: res.data.response_time_ms,
      }));
      toast.success(`AI analysis complete in ${res.data.response_time_ms}ms`);
    } catch (err) {
      toast.error('AI analysis failed: ' + (err.response?.data?.error || err.message));
    }
    setAiLoading(false);
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave({ ...form, contributing_factors: form.contributing_factors.split(',').map(f => f.trim()).filter(f => f), recommended_actions: form.recommended_actions.split(',').map(f => f.trim()).filter(f => f) }); }}>
      <div className="form-group">
        <label>Customer *</label>
        <select value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })} required>
          <option value="">Select customer</option>
          {customers.map((c) => (<option key={c.id} value={c.id}>{c.name} ({c.company})</option>))}
        </select>
      </div>

      <button type="button" className="btn btn-primary" onClick={handleAIAnalysis} disabled={aiLoading} style={{ marginBottom: '16px', background: 'linear-gradient(135deg, #ef4444, #f59e0b)' }}>
        {aiLoading ? <><span className="spinner" style={{ width: 16, height: 16, marginRight: 8 }}></span> Analyzing...</> : <><span style={{ marginRight: 8 }}>🤖</span> AI Risk Analysis</>}
      </button>

      <div className="form-row">
        <div className="form-group">
          <label>Risk Level</label>
          <select value={form.risk_level} onChange={(e) => setForm({ ...form, risk_level: e.target.value })}>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
            <option value="Critical">Critical</option>
          </select>
        </div>
        <div className="form-group">
          <label>Score (0-100) *</label>
          <input type="number" min="0" max="100" value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} required />
        </div>
      </div>
      <div className="form-group">
        <label>Category</label>
        <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g., Engagement, Financial" />
      </div>
      <div className="form-group">
        <label>Contributing Factors (comma-separated)</label>
        <input value={form.contributing_factors} onChange={(e) => setForm({ ...form, contributing_factors: e.target.value })} />
      </div>
      <div className="form-group">
        <label>Recommended Actions (comma-separated)</label>
        <input value={form.recommended_actions} onChange={(e) => setForm({ ...form, recommended_actions: e.target.value })} />
      </div>
      <div style={styles.formActions}>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary">Save</button>
      </div>
    </form>
  );
}

// Segment Form
function SegmentForm({ item, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: item?.name || '',
    description: item?.description || '',
    criteria: item?.criteria ? JSON.stringify(item.criteria) : '',
    customer_count: item?.customer_count || 0,
    avg_revenue: item?.avg_revenue || '',
    churn_rate: item?.churn_rate || '',
    ai_response: item?.ai_response || null,
    ai_response_time_ms: item?.ai_response_time_ms || null,
  });
  const [aiLoading, setAiLoading] = useState(false);
  const toast = useToast();

  const handleAIAnalysis = async () => {
    if (!form.name) { toast.warning('Please enter segment name first'); return; }
    setAiLoading(true);
    try {
      const res = await api.post('/ai/analyze-segment', { name: form.name, description: form.description });
      console.log('AI Segment Response:', res.data);
      setForm(prev => ({
        ...prev,
        description: res.data.description || prev.description,
        criteria: res.data.criteria ? JSON.stringify(res.data.criteria) : prev.criteria,
        customer_count: res.data.customer_count || prev.customer_count,
        avg_revenue: res.data.avg_revenue || prev.avg_revenue,
        churn_rate: res.data.churn_rate || prev.churn_rate,
        ai_response: res.data,
        ai_response_time_ms: res.data.response_time_ms,
      }));
      toast.success(`AI analysis complete in ${res.data.response_time_ms}ms`);
    } catch (err) { toast.error('AI analysis failed: ' + (err.response?.data?.error || err.message)); }
    setAiLoading(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    let criteria = {};
    try { if (form.criteria) criteria = JSON.parse(form.criteria); }
    catch { toast.error('Invalid JSON in criteria field'); return; }
    onSave({ ...form, criteria });
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label>Name *</label>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      </div>
      <div className="form-group">
        <label>Description</label>
        <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
      </div>
      <button type="button" className="btn btn-primary" onClick={handleAIAnalysis} disabled={aiLoading} style={{ marginBottom: '16px', background: 'linear-gradient(135deg, #10b981, #6366f1)' }}>
        {aiLoading ? <><span className="spinner" style={{ width: 16, height: 16, marginRight: 8 }}></span> Analyzing...</> : <><span style={{ marginRight: 8 }}>🤖</span> AI Suggest Segment Config</>}
      </button>
      <div className="form-group">
        <label>Criteria (JSON)</label>
        <input value={form.criteria} onChange={(e) => setForm({ ...form, criteria: e.target.value })} placeholder='{"plan": "Enterprise"}' />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Customer Count</label>
          <input type="number" value={form.customer_count} onChange={(e) => setForm({ ...form, customer_count: e.target.value })} />
        </div>
        <div className="form-group">
          <label>Avg Revenue</label>
          <input type="number" value={form.avg_revenue} onChange={(e) => setForm({ ...form, avg_revenue: e.target.value })} />
        </div>
      </div>
      <div className="form-group">
        <label>Churn Rate (%)</label>
        <input type="number" step="0.1" value={form.churn_rate} onChange={(e) => setForm({ ...form, churn_rate: e.target.value })} />
      </div>
      <div style={styles.formActions}>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary">Save</button>
      </div>
    </form>
  );
}

// Intervention Form
function InterventionForm({ item, onSave, onCancel }) {
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({
    customer_id: item?.customer_id || '',
    type: item?.type || '',
    description: item?.description || '',
    priority: item?.priority || 'Medium',
    status: item?.status || 'pending',
    suggested_by: item?.suggested_by || 'Manual',
    effectiveness_score: item?.effectiveness_score || '',
    due_date: item?.due_date?.split('T')[0] || '',
    ai_suggestions: item?.ai_suggestions || null,
    ai_response_time_ms: item?.ai_response_time_ms || null,
  });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState(item?.ai_suggestions || null);
  const toast = useToast();

  useEffect(() => { api.get('/customers').then((res) => setCustomers(res.data)); }, []);

  // Calculate due date based on priority
  const getDueDate = (priority) => {
    const days = priority === 'High' ? 3 : priority === 'Medium' ? 7 : 14;
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  };

  const handleAISuggestion = async () => {
    if (!form.customer_id) { toast.warning('Please select a customer first'); return; }
    setAiLoading(true);
    setAiSuggestions(null);
    try {
      const res = await api.post('/ai/suggest-intervention', { customer_id: form.customer_id, context: 'churn risk mitigation' });
      console.log('AI Intervention Response:', res.data);
      setAiSuggestions(res.data);

      // Auto-populate form with the first (best) suggestion
      if (res.data.suggestions && res.data.suggestions.length > 0) {
        const firstSuggestion = res.data.suggestions[0];
        const priority = firstSuggestion.priority || 'Medium';
        setForm(prev => ({
          ...prev,
          type: firstSuggestion.type || '',
          description: firstSuggestion.description || '',
          priority: priority,
          effectiveness_score: firstSuggestion.effectiveness || '',
          suggested_by: 'AI',
          due_date: getDueDate(priority),
          ai_suggestions: res.data.suggestions,
          ai_response_time_ms: res.data.response_time_ms
        }));
        toast.success('AI suggestions received - Form populated with top recommendation');
      } else {
        toast.success('AI suggestions received');
      }
    } catch (err) {
      toast.error('AI suggestion failed: ' + (err.response?.data?.error || err.message));
    }
    setAiLoading(false);
  };

  const selectSuggestion = (suggestion) => {
    const priority = suggestion.priority || 'Medium';
    setForm(prev => ({
      ...prev,
      type: suggestion.type,
      description: suggestion.description,
      priority: priority,
      effectiveness_score: suggestion.effectiveness,
      suggested_by: 'AI',
      due_date: getDueDate(priority)
    }));
    toast.success('Suggestion applied');
  };

  const getPriorityColor = (p) => p === 'High' ? '#ef4444' : p === 'Medium' ? '#f59e0b' : '#10b981';

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
      <div className="form-group">
        <label>Customer *</label>
        <select value={form.customer_id} onChange={(e) => { setForm({ ...form, customer_id: e.target.value, ai_suggestions: null, ai_response_time_ms: null }); setAiSuggestions(null); }} required>
          <option value="">Select customer</option>
          {customers.map((c) => (<option key={c.id} value={c.id}>{c.name} ({c.company})</option>))}
        </select>
      </div>

      <button type="button" className="btn btn-primary" onClick={handleAISuggestion} disabled={aiLoading} style={{ marginBottom: '16px', background: 'linear-gradient(135deg, #8b5cf6, #6366f1)' }}>
        {aiLoading ? (
          <><span className="spinner" style={{ width: 16, height: 16, marginRight: 8 }}></span> Getting AI Suggestions...</>
        ) : (
          <><span style={{ marginRight: 8 }}>🤖</span> Get AI Suggestions</>
        )}
      </button>

      {aiSuggestions?.suggestions?.length > 0 && (
        <div style={{ ...aiResultStyles.container, marginBottom: '20px' }}>
          <div style={aiResultStyles.header}>
            <h4 style={aiResultStyles.title}>AI Suggested Interventions</h4>
            <span style={aiResultStyles.time}>for {aiSuggestions.customer_name}</span>
          </div>
          <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '12px' }}>Top suggestion applied to form. Click another to switch:</p>
          {aiSuggestions.suggestions.map((s, i) => {
            const isSelected = form.type === s.type && form.description === s.description;
            return (
              <div key={i} onClick={() => selectSuggestion(s)} style={{
                background: isSelected ? 'rgba(99, 102, 241, 0.15)' : '#1a1a2e',
                border: isSelected ? '2px solid #6366f1' : '1px solid #2d2d4a',
                borderRadius: '12px', padding: '16px', marginBottom: '10px', cursor: 'pointer',
                transition: 'all 0.2s', position: 'relative'
              }}
              onMouseOver={(e) => { if (!isSelected) e.currentTarget.style.borderColor = '#6366f1'; }}
              onMouseOut={(e) => { if (!isSelected) e.currentTarget.style.borderColor = '#2d2d4a'; }}>
                {isSelected && (
                  <span style={{ position: 'absolute', top: '10px', right: '10px', fontSize: '16px' }}>✓</span>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '15px', fontWeight: '600', color: '#fff' }}>{s.type}</span>
                  <span style={{ fontSize: '11px', fontWeight: '600', color: '#fff', padding: '4px 10px', borderRadius: '12px', background: getPriorityColor(s.priority), marginRight: isSelected ? '24px' : '0' }}>
                    {s.priority}
                  </span>
                </div>
                <p style={{ fontSize: '13px', color: '#9ca3af', margin: '8px 0', lineHeight: '1.5' }}>{s.description}</p>
                {s.effectiveness && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
                    <span style={{ fontSize: '11px', color: '#6b7280' }}>Effectiveness:</span>
                    <div style={{ flex: 1, height: '6px', background: '#2d2d4a', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${s.effectiveness}%`, height: '100%', background: 'linear-gradient(90deg, #10b981, #22d3ee)', borderRadius: '3px' }} />
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: '600', color: '#22d3ee' }}>{s.effectiveness}%</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <div className="form-row">
        <div className="form-group">
          <label>Type *</label>
          <input value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} placeholder="e.g., Outreach Call" required />
        </div>
        <div className="form-group">
          <label>Priority</label>
          <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
          </select>
        </div>
      </div>
      <div className="form-group">
        <label>Description *</label>
        <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} required />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Status</label>
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="pending">Pending</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <div className="form-group">
          <label>Due Date</label>
          <div className="date-input-wrapper">
            <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          </div>
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Suggested By</label>
          <input value={form.suggested_by} onChange={(e) => setForm({ ...form, suggested_by: e.target.value })} />
        </div>
        <div className="form-group">
          <label>Effectiveness Score (0-100)</label>
          <input type="number" min="0" max="100" value={form.effectiveness_score} onChange={(e) => setForm({ ...form, effectiveness_score: e.target.value })} />
        </div>
      </div>
      <div style={styles.formActions}>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary">Save</button>
      </div>
    </form>
  );
}

// Form Definitions
// Behavior Form with AI
function BehaviorForm({ item, onSave, onCancel }) {
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({ customer_id: item?.customer_id || '', event_type: item?.event_type || '', page_visited: item?.page_visited || '', action_taken: item?.action_taken || '', session_id: item?.session_id || '', ai_response: item?.ai_response || null, ai_response_time_ms: item?.ai_response_time_ms || null });
  const [aiLoading, setAiLoading] = useState(false);
  const toast = useToast();
  useEffect(() => { api.get('/customers').then((res) => setCustomers(res.data)); }, []);
  const handleAI = async () => {
    if (!form.customer_id) { toast.warning('Select customer first'); return; }
    setAiLoading(true);
    try {
      const res = await api.post('/ai/analyze-behavior', { customer_id: form.customer_id });
      console.log('AI Behavior Response:', res.data);
      setForm(prev => ({ ...prev, event_type: res.data.event_type || '', page_visited: res.data.page_visited || '', action_taken: res.data.action_taken || '', session_id: res.data.session_id || prev.session_id, ai_response: res.data, ai_response_time_ms: res.data.response_time_ms }));
      toast.success(`AI complete in ${res.data.response_time_ms}ms`);
    } catch (err) { console.error('AI Error:', err.response?.data || err); toast.error('AI failed: ' + (err.response?.data?.error || err.message)); }
    setAiLoading(false);
  };
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
      <div className="form-group"><label>Customer *</label><select value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })} required><option value="">Select</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.company})</option>)}</select></div>
      <button type="button" className="btn btn-primary" onClick={handleAI} disabled={aiLoading} style={{ marginBottom: '16px', background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}>{aiLoading ? 'Analyzing...' : '🤖 AI Suggest Behavior'}</button>
      <div className="form-group"><label>Event Type *</label><input value={form.event_type} onChange={(e) => setForm({ ...form, event_type: e.target.value })} required /></div>
      <div className="form-row"><div className="form-group"><label>Page Visited</label><input value={form.page_visited} onChange={(e) => setForm({ ...form, page_visited: e.target.value })} /></div><div className="form-group"><label>Action Taken</label><input value={form.action_taken} onChange={(e) => setForm({ ...form, action_taken: e.target.value })} /></div></div>
      <div className="form-group"><label>Session ID</label><input value={form.session_id} onChange={(e) => setForm({ ...form, session_id: e.target.value })} /></div>
      <div style={styles.formActions}><button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button><button type="submit" className="btn btn-primary">Save</button></div>
    </form>
  );
}

// Metric Form with AI
function MetricForm({ item, onSave, onCancel }) {
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({ customer_id: item?.customer_id || '', metric_name: item?.metric_name || '', metric_value: item?.metric_value || '', period_start: item?.period_start?.split('T')[0] || '', period_end: item?.period_end?.split('T')[0] || '', trend: item?.trend || 'stable', comparison_value: item?.comparison_value || '', ai_response: item?.ai_response || null, ai_response_time_ms: item?.ai_response_time_ms || null });
  const [aiLoading, setAiLoading] = useState(false);
  const toast = useToast();
  useEffect(() => { api.get('/customers').then((res) => setCustomers(res.data)); }, []);
  const handleAI = async () => {
    if (!form.customer_id) { toast.warning('Select customer first'); return; }
    setAiLoading(true);
    try {
      const res = await api.post('/ai/analyze-metrics', { customer_id: form.customer_id });
      console.log('AI Metrics Response:', res.data);
      setForm(prev => ({ ...prev, metric_name: res.data.metric_name || '', metric_value: res.data.metric_value || '', period_start: res.data.period_start || prev.period_start, period_end: res.data.period_end || prev.period_end, trend: res.data.trend || 'stable', comparison_value: res.data.comparison_value || '', ai_response: res.data, ai_response_time_ms: res.data.response_time_ms }));
      toast.success(`AI complete in ${res.data.response_time_ms}ms`);
    } catch (err) { toast.error('AI failed'); }
    setAiLoading(false);
  };
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
      <div className="form-group"><label>Customer *</label><select value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })} required><option value="">Select</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.company})</option>)}</select></div>
      <button type="button" className="btn btn-primary" onClick={handleAI} disabled={aiLoading} style={{ marginBottom: '16px', background: 'linear-gradient(135deg, #6366f1, #22d3ee)' }}>{aiLoading ? 'Analyzing...' : '🤖 AI Suggest Metric'}</button>
      <div className="form-row"><div className="form-group"><label>Metric Name *</label><input value={form.metric_name} onChange={(e) => setForm({ ...form, metric_name: e.target.value })} required /></div><div className="form-group"><label>Metric Value *</label><input type="number" value={form.metric_value} onChange={(e) => setForm({ ...form, metric_value: e.target.value })} required /></div></div>
      <div className="form-row"><div className="form-group"><label>Period Start</label><div className="date-input-wrapper"><input type="date" value={form.period_start} onChange={(e) => setForm({ ...form, period_start: e.target.value })} /></div></div><div className="form-group"><label>Period End</label><div className="date-input-wrapper"><input type="date" value={form.period_end} onChange={(e) => setForm({ ...form, period_end: e.target.value })} /></div></div></div>
      <div className="form-row"><div className="form-group"><label>Trend</label><select value={form.trend} onChange={(e) => setForm({ ...form, trend: e.target.value })}><option value="up">Up</option><option value="down">Down</option><option value="stable">Stable</option></select></div><div className="form-group"><label>Comparison Value</label><input type="number" value={form.comparison_value} onChange={(e) => setForm({ ...form, comparison_value: e.target.value })} /></div></div>
      <div style={styles.formActions}><button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button><button type="submit" className="btn btn-primary">Save</button></div>
    </form>
  );
}

// Engagement Form with AI
function EngagementForm({ item, onSave, onCancel }) {
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({
    customer_id: item?.customer_id || '',
    overall_score: item?.overall_score || '',
    login_frequency: item?.login_frequency || '',
    feature_adoption: item?.feature_adoption || '',
    support_interaction: item?.support_interaction || '',
    feedback_score: item?.feedback_score || '',
    ai_response: item?.ai_response || null,
    ai_response_time_ms: item?.ai_response_time_ms || null,
  });
  const [aiLoading, setAiLoading] = useState(false);
  const toast = useToast();

  useEffect(() => { api.get('/customers').then((res) => setCustomers(res.data)); }, []);

  const handleAIAnalysis = async () => {
    if (!form.customer_id) { toast.warning('Please select a customer first'); return; }
    setAiLoading(true);
    try {
      const res = await api.post('/ai/analyze-engagement', { customer_id: form.customer_id });
      console.log('AI Engagement Response:', res.data);
      setForm(prev => ({
        ...prev,
        overall_score: res.data.overall_score || '',
        login_frequency: res.data.login_frequency || '',
        feature_adoption: res.data.feature_adoption || '',
        support_interaction: res.data.support_interaction || '',
        feedback_score: res.data.feedback_score || '',
        ai_response: res.data,
        ai_response_time_ms: res.data.response_time_ms,
      }));
      toast.success(`AI analysis complete in ${res.data.response_time_ms}ms`);
    } catch (err) {
      toast.error('AI analysis failed: ' + (err.response?.data?.error || err.message));
    }
    setAiLoading(false);
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
      <div className="form-group">
        <label>Customer *</label>
        <select value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })} required>
          <option value="">Select customer</option>
          {customers.map((c) => (<option key={c.id} value={c.id}>{c.name} ({c.company})</option>))}
        </select>
      </div>
      <button type="button" className="btn btn-primary" onClick={handleAIAnalysis} disabled={aiLoading} style={{ marginBottom: '16px', background: 'linear-gradient(135deg, #6366f1, #22d3ee)' }}>
        {aiLoading ? <><span className="spinner" style={{ width: 16, height: 16, marginRight: 8 }}></span> Analyzing...</> : <><span style={{ marginRight: 8 }}>🤖</span> AI Engagement Analysis</>}
      </button>
      <div className="form-row">
        <div className="form-group"><label>Overall Score (0-100) *</label><input type="number" min="0" max="100" value={form.overall_score} onChange={(e) => setForm({ ...form, overall_score: e.target.value })} required /></div>
        <div className="form-group"><label>Login Frequency (0-100)</label><input type="number" min="0" max="100" value={form.login_frequency} onChange={(e) => setForm({ ...form, login_frequency: e.target.value })} /></div>
      </div>
      <div className="form-row">
        <div className="form-group"><label>Feature Adoption (0-100)</label><input type="number" min="0" max="100" value={form.feature_adoption} onChange={(e) => setForm({ ...form, feature_adoption: e.target.value })} /></div>
        <div className="form-group"><label>Support Interaction (0-100)</label><input type="number" min="0" max="100" value={form.support_interaction} onChange={(e) => setForm({ ...form, support_interaction: e.target.value })} /></div>
      </div>
      <div className="form-group"><label>Feedback Score (0-100)</label><input type="number" min="0" max="100" value={form.feedback_score} onChange={(e) => setForm({ ...form, feedback_score: e.target.value })} /></div>
      <div style={styles.formActions}>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary">Save</button>
      </div>
    </form>
  );
}

// Ticket Form with AI
function TicketForm({ item, onSave, onCancel }) {
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({
    customer_id: item?.customer_id || '',
    subject: item?.subject || '',
    description: item?.description || '',
    priority: item?.priority || 'Medium',
    status: item?.status || 'open',
    category: item?.category || '',
    assigned_to: item?.assigned_to || '',
    ai_response: item?.ai_response || null,
    ai_response_time_ms: item?.ai_response_time_ms || null,
  });
  const [aiLoading, setAiLoading] = useState(false);
  const toast = useToast();

  useEffect(() => { api.get('/customers').then((res) => setCustomers(res.data)); }, []);

  const handleAIAnalysis = async () => {
    if (!form.customer_id) { toast.warning('Please select a customer first'); return; }
    setAiLoading(true);
    try {
      console.log('Calling suggest-ticket with:', { customer_id: form.customer_id, subject: form.subject, description: form.description });
      const res = await api.post('/ai/suggest-ticket', { customer_id: form.customer_id, subject: form.subject, description: form.description });
      console.log('Ticket AI Response:', res.data);
      setForm(prev => ({
        ...prev,
        subject: res.data.subject || prev.subject,
        description: res.data.description || prev.description,
        priority: res.data.priority || 'Medium',
        category: res.data.category || '',
        assigned_to: res.data.assigned_to || '',
        ai_response: res.data,
        ai_response_time_ms: res.data.response_time_ms,
      }));
      toast.success(`AI analysis complete in ${res.data.response_time_ms}ms`);
    } catch (err) {
      console.error('Ticket AI Error:', err.response?.data || err);
      toast.error('AI analysis failed: ' + (err.response?.data?.error || err.message));
    }
    setAiLoading(false);
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
      <div className="form-group">
        <label>Customer *</label>
        <select value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })} required>
          <option value="">Select customer</option>
          {customers.map((c) => (<option key={c.id} value={c.id}>{c.name} ({c.company})</option>))}
        </select>
      </div>
      <div className="form-group"><label>Subject *</label><input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required /></div>
      <div className="form-group"><label>Description</label><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></div>

      <button type="button" className="btn btn-primary" onClick={handleAIAnalysis} disabled={aiLoading} style={{ marginBottom: '16px', background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}>
        {aiLoading ? <><span className="spinner" style={{ width: 16, height: 16, marginRight: 8 }}></span> Analyzing...</> : <><span style={{ marginRight: 8 }}>🤖</span> AI Ticket Analysis</>}
      </button>

      <div className="form-row">
        <div className="form-group">
          <label>Priority</label>
          <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
            <option value="Low">Low</option><option value="Medium">Medium</option><option value="High">High</option>
          </select>
        </div>
        <div className="form-group">
          <label>Status</label>
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="open">Open</option><option value="in-progress">In Progress</option><option value="resolved">Resolved</option>
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="form-group"><label>Category</label><input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
        <div className="form-group"><label>Assigned To</label><input value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })} /></div>
      </div>
      <div style={styles.formActions}>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary">Save</button>
      </div>
    </form>
  );
}

// Billing Form with AI
function BillingForm({ item, onSave, onCancel }) {
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({ customer_id: item?.customer_id || '', invoice_number: item?.invoice_number || '', amount: item?.amount || '', currency: item?.currency || 'USD', status: item?.status || 'pending', payment_method: item?.payment_method || '', billing_date: item?.billing_date?.split('T')[0] || '', due_date: item?.due_date?.split('T')[0] || '', ai_response: item?.ai_response || null, ai_response_time_ms: item?.ai_response_time_ms || null });
  const [aiLoading, setAiLoading] = useState(false);
  const toast = useToast();
  useEffect(() => { api.get('/customers').then((res) => setCustomers(res.data)); }, []);
  const handleAI = async () => {
    if (!form.customer_id) { toast.warning('Select customer first'); return; }
    setAiLoading(true);
    try {
      const res = await api.post('/ai/analyze-billing', { customer_id: form.customer_id });
      console.log('AI Billing Response:', res.data);
      setForm(prev => ({ ...prev, invoice_number: res.data.invoice_number || prev.invoice_number, amount: res.data.amount || '', currency: res.data.currency || prev.currency, status: res.data.status || 'pending', payment_method: res.data.payment_method || '', billing_date: res.data.billing_date || prev.billing_date, due_date: res.data.due_date || prev.due_date, ai_response: res.data, ai_response_time_ms: res.data.response_time_ms }));
      toast.success(`AI complete in ${res.data.response_time_ms}ms`);
    } catch (err) { toast.error('AI failed'); }
    setAiLoading(false);
  };
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
      <div className="form-group"><label>Customer *</label><select value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })} required><option value="">Select</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.company})</option>)}</select></div>
      <button type="button" className="btn btn-primary" onClick={handleAI} disabled={aiLoading} style={{ marginBottom: '16px', background: 'linear-gradient(135deg, #10b981, #6366f1)' }}>{aiLoading ? 'Analyzing...' : '🤖 AI Suggest Billing'}</button>
      <div className="form-row"><div className="form-group"><label>Invoice Number *</label><input value={form.invoice_number} onChange={(e) => setForm({ ...form, invoice_number: e.target.value })} required /></div><div className="form-group"><label>Amount *</label><input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required /></div></div>
      <div className="form-row"><div className="form-group"><label>Currency</label><select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}><option value="USD">USD</option><option value="EUR">EUR</option><option value="GBP">GBP</option></select></div><div className="form-group"><label>Status</label><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="pending">Pending</option><option value="paid">Paid</option><option value="overdue">Overdue</option><option value="cancelled">Cancelled</option></select></div></div>
      <div className="form-group"><label>Payment Method</label><input value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} /></div>
      <div className="form-row"><div className="form-group"><label>Billing Date</label><div className="date-input-wrapper"><input type="date" value={form.billing_date} onChange={(e) => setForm({ ...form, billing_date: e.target.value })} /></div></div><div className="form-group"><label>Due Date</label><div className="date-input-wrapper"><input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div></div></div>
      <div style={styles.formActions}><button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button><button type="submit" className="btn btn-primary">Save</button></div>
    </form>
  );
}

// Feature Form with AI
function FeatureForm({ item, onSave, onCancel }) {
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({ customer_id: item?.customer_id || '', feature_name: item?.feature_name || '', usage_count: item?.usage_count || '', adoption_rate: item?.adoption_rate || '', time_spent_minutes: item?.time_spent_minutes || '', last_used: item?.last_used?.slice(0,16) || '', period: item?.period || 'monthly', ai_response: item?.ai_response || null, ai_response_time_ms: item?.ai_response_time_ms || null });
  const [aiLoading, setAiLoading] = useState(false);
  const toast = useToast();
  useEffect(() => { api.get('/customers').then((res) => setCustomers(res.data)); }, []);
  const handleAI = async () => {
    if (!form.customer_id) { toast.warning('Select customer first'); return; }
    setAiLoading(true);
    try {
      const res = await api.post('/ai/analyze-feature', { customer_id: form.customer_id });
      console.log('AI Feature Response:', res.data);
      setForm(prev => ({ ...prev, feature_name: res.data.feature_name || '', usage_count: res.data.usage_count || '', adoption_rate: res.data.adoption_rate || '', time_spent_minutes: res.data.time_spent_minutes || '', last_used: res.data.last_used || prev.last_used, period: res.data.period || 'monthly', ai_response: res.data, ai_response_time_ms: res.data.response_time_ms }));
      toast.success(`AI complete in ${res.data.response_time_ms}ms`);
    } catch (err) { toast.error('AI failed'); }
    setAiLoading(false);
  };
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
      <div className="form-group"><label>Customer *</label><select value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })} required><option value="">Select</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.company})</option>)}</select></div>
      <button type="button" className="btn btn-primary" onClick={handleAI} disabled={aiLoading} style={{ marginBottom: '16px', background: 'linear-gradient(135deg, #8b5cf6, #6366f1)' }}>{aiLoading ? 'Analyzing...' : '🤖 AI Suggest Feature Usage'}</button>
      <div className="form-row"><div className="form-group"><label>Feature Name *</label><input value={form.feature_name} onChange={(e) => setForm({ ...form, feature_name: e.target.value })} required /></div><div className="form-group"><label>Usage Count</label><input type="number" value={form.usage_count} onChange={(e) => setForm({ ...form, usage_count: e.target.value })} /></div></div>
      <div className="form-row"><div className="form-group"><label>Adoption Rate (0-100)</label><input type="number" min="0" max="100" value={form.adoption_rate} onChange={(e) => setForm({ ...form, adoption_rate: e.target.value })} /></div><div className="form-group"><label>Time Spent (minutes)</label><input type="number" value={form.time_spent_minutes} onChange={(e) => setForm({ ...form, time_spent_minutes: e.target.value })} /></div></div>
      <div className="form-row"><div className="form-group"><label>Last Used</label><div className="date-input-wrapper"><input type="datetime-local" value={form.last_used} onChange={(e) => setForm({ ...form, last_used: e.target.value })} /></div></div><div className="form-group"><label>Period</label><select value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></div></div>
      <div style={styles.formActions}><button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button><button type="submit" className="btn btn-primary">Save</button></div>
    </form>
  );
}

// Session Form with AI
function SessionForm({ item, onSave, onCancel }) {
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({ customer_id: item?.customer_id || '', session_start: item?.session_start?.slice(0,16) || '', session_end: item?.session_end?.slice(0,16) || '', duration_minutes: item?.duration_minutes || '', pages_viewed: item?.pages_viewed || '', actions_taken: item?.actions_taken || '', device_type: item?.device_type || '', browser: item?.browser || '', ai_response: item?.ai_response || null, ai_response_time_ms: item?.ai_response_time_ms || null });
  const [aiLoading, setAiLoading] = useState(false);
  const toast = useToast();
  useEffect(() => { api.get('/customers').then((res) => setCustomers(res.data)); }, []);
  const handleAI = async () => {
    if (!form.customer_id) { toast.warning('Select customer first'); return; }
    setAiLoading(true);
    try {
      const res = await api.post('/ai/analyze-session', { customer_id: form.customer_id });
      console.log('AI Session Response:', res.data);
      setForm(prev => ({ ...prev, session_start: res.data.session_start || prev.session_start, session_end: res.data.session_end || prev.session_end, duration_minutes: res.data.duration_minutes || '', pages_viewed: res.data.pages_viewed || '', actions_taken: res.data.actions_taken || '', device_type: res.data.device_type || '', browser: res.data.browser || '', ai_response: res.data, ai_response_time_ms: res.data.response_time_ms }));
      toast.success(`AI complete in ${res.data.response_time_ms}ms`);
    } catch (err) { toast.error('AI failed'); }
    setAiLoading(false);
  };
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
      <div className="form-group"><label>Customer *</label><select value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })} required><option value="">Select</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.company})</option>)}</select></div>
      <button type="button" className="btn btn-primary" onClick={handleAI} disabled={aiLoading} style={{ marginBottom: '16px', background: 'linear-gradient(135deg, #22d3ee, #6366f1)' }}>{aiLoading ? 'Analyzing...' : '🤖 AI Suggest Session Data'}</button>
      <div className="form-row"><div className="form-group"><label>Session Start</label><div className="date-input-wrapper"><input type="datetime-local" value={form.session_start} onChange={(e) => setForm({ ...form, session_start: e.target.value })} /></div></div><div className="form-group"><label>Session End</label><div className="date-input-wrapper"><input type="datetime-local" value={form.session_end} onChange={(e) => setForm({ ...form, session_end: e.target.value })} /></div></div></div>
      <div className="form-row"><div className="form-group"><label>Duration (minutes)</label><input type="number" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} /></div><div className="form-group"><label>Pages Viewed</label><input type="number" value={form.pages_viewed} onChange={(e) => setForm({ ...form, pages_viewed: e.target.value })} /></div></div>
      <div className="form-row"><div className="form-group"><label>Actions Taken</label><input type="number" value={form.actions_taken} onChange={(e) => setForm({ ...form, actions_taken: e.target.value })} /></div><div className="form-group"><label>Device Type</label><input value={form.device_type} onChange={(e) => setForm({ ...form, device_type: e.target.value })} /></div></div>
      <div className="form-group"><label>Browser</label><input value={form.browser} onChange={(e) => setForm({ ...form, browser: e.target.value })} /></div>
      <div style={styles.formActions}><button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button><button type="submit" className="btn btn-primary">Save</button></div>
    </form>
  );
}

// NPS Form with AI
function NPSForm({ item, onSave, onCancel }) {
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({ customer_id: item?.customer_id || '', score: item?.score || '', feedback: item?.feedback || '', category: item?.category || 'Passive', survey_date: item?.survey_date?.split('T')[0] || '', follow_up_required: item?.follow_up_required || false, ai_response: item?.ai_response || null, ai_response_time_ms: item?.ai_response_time_ms || null });
  const [aiLoading, setAiLoading] = useState(false);
  const toast = useToast();
  useEffect(() => { api.get('/customers').then((res) => setCustomers(res.data)); }, []);
  const handleAI = async () => {
    if (!form.customer_id) { toast.warning('Select customer first'); return; }
    setAiLoading(true);
    try {
      const res = await api.post('/ai/analyze-nps', { customer_id: form.customer_id, feedback: form.feedback });
      console.log('AI NPS Response:', res.data);
      setForm(prev => ({ ...prev, score: res.data.score || '', category: res.data.category || 'Passive', feedback: res.data.feedback || prev.feedback, survey_date: res.data.survey_date || prev.survey_date, follow_up_required: res.data.follow_up_required || false, ai_response: res.data, ai_response_time_ms: res.data.response_time_ms }));
      toast.success(`AI complete in ${res.data.response_time_ms}ms`);
    } catch (err) { toast.error('AI failed'); }
    setAiLoading(false);
  };
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
      <div className="form-group"><label>Customer *</label><select value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })} required><option value="">Select</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.company})</option>)}</select></div>
      <div className="form-group"><label>Feedback</label><textarea value={form.feedback} onChange={(e) => setForm({ ...form, feedback: e.target.value })} rows={3} placeholder="Enter feedback to analyze..." /></div>
      <button type="button" className="btn btn-primary" onClick={handleAI} disabled={aiLoading} style={{ marginBottom: '16px', background: 'linear-gradient(135deg, #f59e0b, #10b981)' }}>{aiLoading ? 'Analyzing...' : '🤖 AI Analyze Feedback'}</button>
      <div className="form-row"><div className="form-group"><label>Score (0-10) *</label><input type="number" min="0" max="10" value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} required /></div><div className="form-group"><label>Category</label><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}><option value="Promoter">Promoter</option><option value="Passive">Passive</option><option value="Detractor">Detractor</option></select></div></div>
      <div className="form-row"><div className="form-group"><label>Survey Date</label><div className="date-input-wrapper"><input type="date" value={form.survey_date} onChange={(e) => setForm({ ...form, survey_date: e.target.value })} /></div></div><div className="form-group"><label>Follow-up Required</label><select value={form.follow_up_required} onChange={(e) => setForm({ ...form, follow_up_required: e.target.value === 'true' })}><option value="false">No</option><option value="true">Yes</option></select></div></div>
      <div style={styles.formActions}><button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button><button type="submit" className="btn btn-primary">Save</button></div>
    </form>
  );
}

// Health Form with AI
function HealthForm({ item, onSave, onCancel }) {
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({
    customer_id: item?.customer_id || '',
    overall_health: item?.overall_health || '',
    product_usage: item?.product_usage || '',
    customer_satisfaction: item?.customer_satisfaction || '',
    growth_potential: item?.growth_potential || '',
    support_health: item?.support_health || '',
    financial_health: item?.financial_health || '',
    trend: item?.trend || 'stable',
    ai_response: item?.ai_response || null,
    ai_response_time_ms: item?.ai_response_time_ms || null,
  });
  const [aiLoading, setAiLoading] = useState(false);
  const toast = useToast();

  useEffect(() => { api.get('/customers').then((res) => setCustomers(res.data)); }, []);

  const handleAIAnalysis = async () => {
    if (!form.customer_id) { toast.warning('Please select a customer first'); return; }
    setAiLoading(true);
    try {
      const res = await api.post('/ai/analyze-health', { customer_id: form.customer_id });
      console.log('AI Health Response:', res.data);
      setForm(prev => ({
        ...prev,
        overall_health: res.data.overall_health || '',
        product_usage: res.data.product_usage || '',
        customer_satisfaction: res.data.customer_satisfaction || '',
        growth_potential: res.data.growth_potential || '',
        support_health: res.data.support_health || '',
        financial_health: res.data.financial_health || '',
        trend: res.data.trend || 'stable',
        ai_response: res.data,
        ai_response_time_ms: res.data.response_time_ms,
      }));
      toast.success(`AI analysis complete in ${res.data.response_time_ms}ms`);
    } catch (err) {
      toast.error('AI analysis failed: ' + (err.response?.data?.error || err.message));
    }
    setAiLoading(false);
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
      <div className="form-group">
        <label>Customer *</label>
        <select value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })} required>
          <option value="">Select customer</option>
          {customers.map((c) => (<option key={c.id} value={c.id}>{c.name} ({c.company})</option>))}
        </select>
      </div>
      <button type="button" className="btn btn-primary" onClick={handleAIAnalysis} disabled={aiLoading} style={{ marginBottom: '16px', background: 'linear-gradient(135deg, #10b981, #22d3ee)' }}>
        {aiLoading ? <><span className="spinner" style={{ width: 16, height: 16, marginRight: 8 }}></span> Analyzing...</> : <><span style={{ marginRight: 8 }}>🤖</span> AI Health Analysis</>}
      </button>
      <div className="form-row">
        <div className="form-group"><label>Overall Health (0-100) *</label><input type="number" min="0" max="100" value={form.overall_health} onChange={(e) => setForm({ ...form, overall_health: e.target.value })} required /></div>
        <div className="form-group"><label>Product Usage (0-100)</label><input type="number" min="0" max="100" value={form.product_usage} onChange={(e) => setForm({ ...form, product_usage: e.target.value })} /></div>
      </div>
      <div className="form-row">
        <div className="form-group"><label>Customer Satisfaction (0-100)</label><input type="number" min="0" max="100" value={form.customer_satisfaction} onChange={(e) => setForm({ ...form, customer_satisfaction: e.target.value })} /></div>
        <div className="form-group"><label>Growth Potential (0-100)</label><input type="number" min="0" max="100" value={form.growth_potential} onChange={(e) => setForm({ ...form, growth_potential: e.target.value })} /></div>
      </div>
      <div className="form-row">
        <div className="form-group"><label>Support Health (0-100)</label><input type="number" min="0" max="100" value={form.support_health} onChange={(e) => setForm({ ...form, support_health: e.target.value })} /></div>
        <div className="form-group"><label>Financial Health (0-100)</label><input type="number" min="0" max="100" value={form.financial_health} onChange={(e) => setForm({ ...form, financial_health: e.target.value })} /></div>
      </div>
      <div className="form-group">
        <label>Trend</label>
        <select value={form.trend} onChange={(e) => setForm({ ...form, trend: e.target.value })}>
          <option value="up">Up</option><option value="down">Down</option><option value="stable">Stable</option>
        </select>
      </div>
      <div style={styles.formActions}>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary">Save</button>
      </div>
    </form>
  );
}

// Alert Form with AI
function AlertForm({ item, onSave, onCancel }) {
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({
    customer_id: item?.customer_id || '',
    alert_type: item?.alert_type || '',
    severity: item?.severity || 'medium',
    message: item?.message || '',
    is_read: item?.is_read || false,
    is_resolved: item?.is_resolved || false,
    ai_response: item?.ai_response || null,
    ai_response_time_ms: item?.ai_response_time_ms || null,
  });
  const [aiLoading, setAiLoading] = useState(false);
  const toast = useToast();

  useEffect(() => { api.get('/customers').then((res) => setCustomers(res.data)); }, []);

  const handleAIAnalysis = async () => {
    if (!form.customer_id) { toast.warning('Please select a customer first'); return; }
    setAiLoading(true);
    try {
      const res = await api.post('/ai/suggest-alert', { customer_id: form.customer_id });
      console.log('AI Alert Response:', res.data);
      setForm(prev => ({
        ...prev,
        alert_type: res.data.alert_type || '',
        severity: res.data.severity || 'medium',
        message: res.data.message || '',
        ai_response: res.data,
        ai_response_time_ms: res.data.response_time_ms,
      }));
      toast.success(`AI analysis complete in ${res.data.response_time_ms}ms`);
    } catch (err) {
      toast.error('AI analysis failed: ' + (err.response?.data?.error || err.message));
    }
    setAiLoading(false);
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
      <div className="form-group">
        <label>Customer *</label>
        <select value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })} required>
          <option value="">Select customer</option>
          {customers.map((c) => (<option key={c.id} value={c.id}>{c.name} ({c.company})</option>))}
        </select>
      </div>
      <button type="button" className="btn btn-primary" onClick={handleAIAnalysis} disabled={aiLoading} style={{ marginBottom: '16px', background: 'linear-gradient(135deg, #ef4444, #f59e0b)' }}>
        {aiLoading ? <><span className="spinner" style={{ width: 16, height: 16, marginRight: 8 }}></span> Generating...</> : <><span style={{ marginRight: 8 }}>🤖</span> AI Generate Alert</>}
      </button>
      <div className="form-row">
        <div className="form-group"><label>Alert Type *</label><input value={form.alert_type} onChange={(e) => setForm({ ...form, alert_type: e.target.value })} required /></div>
        <div className="form-group">
          <label>Severity</label>
          <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
            <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
          </select>
        </div>
      </div>
      <div className="form-group"><label>Message *</label><textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={3} required /></div>
      <div className="form-row">
        <div className="form-group">
          <label>Read</label>
          <select value={form.is_read} onChange={(e) => setForm({ ...form, is_read: e.target.value === 'true' })}>
            <option value="false">No</option><option value="true">Yes</option>
          </select>
        </div>
        <div className="form-group">
          <label>Resolved</label>
          <select value={form.is_resolved} onChange={(e) => setForm({ ...form, is_resolved: e.target.value === 'true' })}>
            <option value="false">No</option><option value="true">Yes</option>
          </select>
        </div>
      </div>
      <div style={styles.formActions}>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary">Save</button>
      </div>
    </form>
  );
}

// ============ SENTIMENT ANALYSIS FORM ============
function SentimentForm({ item, onSave, onCancel }) {
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({
    customer_id: item?.customer_id || '', feedback_source: item?.feedback_source || 'Survey', feedback_text: item?.feedback_text || '',
    sentiment_score: item?.sentiment_score || '', sentiment_label: item?.sentiment_label || 'Neutral', churn_signal_strength: item?.churn_signal_strength || '',
    key_phrases: item?.key_phrases?.map(k => typeof k === 'string' ? k : (k.phrase || k.text || JSON.stringify(k))).join(', ') || '', urgency_level: item?.urgency_level || 'Medium', recommended_action: item?.recommended_action || '',
    ai_response: item?.ai_response || null, ai_response_time_ms: item?.ai_response_time_ms || null,
  });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const toast = useToast();

  useEffect(() => { api.get('/customers').then((res) => setCustomers(res.data)); }, []);

  const handleAI = async () => {
    if (!form.customer_id) { toast.warning('Select customer first'); return; }
    if (!form.feedback_text) { toast.warning('Enter feedback text to analyze'); return; }
    setAiLoading(true);
    setAiResult(null);
    try {
      const res = await api.post('/ai/analyze-sentiment', { customer_id: form.customer_id, feedback_text: form.feedback_text, feedback_source: form.feedback_source });
      setAiResult(res.data);
      setForm(prev => ({
        ...prev, sentiment_score: res.data.sentiment_score, sentiment_label: res.data.sentiment_label, churn_signal_strength: res.data.churn_signal_strength,
        key_phrases: res.data.key_phrases?.map(k => typeof k === 'string' ? k : (k.phrase || k.text || JSON.stringify(k))).join(', ') || '', urgency_level: res.data.urgency_level, recommended_action: res.data.recommended_action,
        ai_response: res.data, ai_response_time_ms: res.data.response_time_ms,
      }));
      toast.success(`AI analysis complete in ${res.data.response_time_ms}ms`);
    } catch (err) { toast.error('AI failed: ' + (err.response?.data?.error || err.message)); }
    setAiLoading(false);
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave({ ...form, key_phrases: form.key_phrases.split(',').map(p => p.trim()).filter(p => p) }); }}>
      <div className="form-group"><label>Customer *</label><select value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })} required><option value="">Select</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.company})</option>)}</select></div>
      <div className="form-row">
        <div className="form-group"><label>Feedback Source</label><select value={form.feedback_source} onChange={(e) => setForm({ ...form, feedback_source: e.target.value })}><option value="Survey">Survey</option><option value="Support Ticket">Support Ticket</option><option value="Email">Email</option><option value="Chat">Chat</option><option value="NPS">NPS</option><option value="Social Media">Social Media</option></select></div>
      </div>
      <div className="form-group"><label>Feedback Text *</label><textarea value={form.feedback_text} onChange={(e) => setForm({ ...form, feedback_text: e.target.value })} rows={4} placeholder="Enter customer feedback to analyze for churn signals..." required /></div>
      <button type="button" className="btn btn-primary" onClick={handleAI} disabled={aiLoading} style={{ marginBottom: '16px', background: 'linear-gradient(135deg, #ec4899, #8b5cf6)' }}>{aiLoading ? <><span className="spinner" style={{ width: 16, height: 16, marginRight: 8 }}></span> Analyzing Sentiment...</> : '💬 AI Sentiment Analysis'}</button>
      {aiResult && (
        <div style={{ ...aiResultStyles.container, marginBottom: '20px' }}>
          <div style={aiResultStyles.header}><h4 style={aiResultStyles.title}>Sentiment Analysis Result</h4><span style={aiResultStyles.time}>{aiResult.response_time_ms}ms</span></div>
          <div style={{ display: 'flex', gap: '20px', marginBottom: '16px' }}>
            <div style={{ textAlign: 'center' }}>
              <svg width="80" height="80" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="none" stroke="#2d2d4a" strokeWidth="8" /><circle cx="50" cy="50" r="40" fill="none" stroke={aiResult.sentiment_score > 70 ? '#10b981' : aiResult.sentiment_score > 40 ? '#f59e0b' : '#ef4444'} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(aiResult.sentiment_score / 100) * 251.2} 251.2`} transform="rotate(-90 50 50)" /><text x="50" y="55" textAnchor="middle" fontSize="18" fontWeight="bold" fill={aiResult.sentiment_score > 70 ? '#10b981' : aiResult.sentiment_score > 40 ? '#f59e0b' : '#ef4444'}>{aiResult.sentiment_score}%</text></svg>
              <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>Sentiment</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <svg width="80" height="80" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="none" stroke="#2d2d4a" strokeWidth="8" /><circle cx="50" cy="50" r="40" fill="none" stroke={aiResult.churn_signal_strength > 60 ? '#ef4444' : aiResult.churn_signal_strength > 30 ? '#f59e0b' : '#10b981'} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(aiResult.churn_signal_strength / 100) * 251.2} 251.2`} transform="rotate(-90 50 50)" /><text x="50" y="55" textAnchor="middle" fontSize="18" fontWeight="bold" fill={aiResult.churn_signal_strength > 60 ? '#ef4444' : aiResult.churn_signal_strength > 30 ? '#f59e0b' : '#10b981'}>{aiResult.churn_signal_strength}%</text></svg>
              <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>Churn Signal</p>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ marginBottom: '12px' }}><span style={{ ...aiResultStyles.chip, background: aiResult.sentiment_label === 'Very Positive' || aiResult.sentiment_label === 'Positive' ? 'rgba(16, 185, 129, 0.2)' : aiResult.sentiment_label === 'Neutral' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.2)', color: aiResult.sentiment_label === 'Very Positive' || aiResult.sentiment_label === 'Positive' ? '#10b981' : aiResult.sentiment_label === 'Neutral' ? '#f59e0b' : '#ef4444' }}>{aiResult.sentiment_label}</span><span style={{ ...aiResultStyles.chip, marginLeft: '8px', background: aiResult.urgency_level === 'Critical' || aiResult.urgency_level === 'High' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(99, 102, 241, 0.2)', color: aiResult.urgency_level === 'Critical' || aiResult.urgency_level === 'High' ? '#ef4444' : '#a5b4fc' }}>{aiResult.urgency_level} Urgency</span></div>
              {aiResult.key_phrases?.length > 0 && (<div><p style={{ fontSize: '11px', color: '#6366f1', marginBottom: '6px' }}>Key Phrases:</p><div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>{aiResult.key_phrases.slice(0, 5).map((p, i) => <span key={i} style={{ ...aiResultStyles.chip, fontSize: '10px' }}>{p}</span>)}</div></div>)}
            </div>
          </div>
          {aiResult.recommended_action && (<div style={{ background: '#1a1a2e', padding: '12px', borderRadius: '8px' }}><p style={{ fontSize: '11px', color: '#6366f1', marginBottom: '4px' }}>Recommended Action:</p><p style={{ fontSize: '13px', color: '#e0e0e0' }}>{aiResult.recommended_action}</p></div>)}
        </div>
      )}
      <div className="form-row">
        <div className="form-group"><label>Sentiment Score (0-100)</label><input type="number" min="0" max="100" value={form.sentiment_score} onChange={(e) => setForm({ ...form, sentiment_score: e.target.value })} /></div>
        <div className="form-group"><label>Sentiment Label</label><select value={form.sentiment_label} onChange={(e) => setForm({ ...form, sentiment_label: e.target.value })}><option value="Very Positive">Very Positive</option><option value="Positive">Positive</option><option value="Neutral">Neutral</option><option value="Negative">Negative</option><option value="Very Negative">Very Negative</option></select></div>
      </div>
      <div className="form-row">
        <div className="form-group"><label>Churn Signal (0-100)</label><input type="number" min="0" max="100" value={form.churn_signal_strength} onChange={(e) => setForm({ ...form, churn_signal_strength: e.target.value })} /></div>
        <div className="form-group"><label>Urgency Level</label><select value={form.urgency_level} onChange={(e) => setForm({ ...form, urgency_level: e.target.value })}><option value="Low">Low</option><option value="Medium">Medium</option><option value="High">High</option><option value="Critical">Critical</option></select></div>
      </div>
      <div className="form-group"><label>Key Phrases (comma-separated)</label><input value={form.key_phrases} onChange={(e) => setForm({ ...form, key_phrases: e.target.value })} /></div>
      <div className="form-group"><label>Recommended Action</label><textarea value={form.recommended_action} onChange={(e) => setForm({ ...form, recommended_action: e.target.value })} rows={2} /></div>
      <div style={styles.formActions}><button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button><button type="submit" className="btn btn-primary">Save</button></div>
    </form>
  );
}

// ============ CUSTOMER JOURNEY FORM ============
function JourneyForm({ item, onSave, onCancel }) {
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({
    customer_id: item?.customer_id || '', journey_stage: item?.journey_stage || 'Active', touchpoint_type: item?.touchpoint_type || 'Product',
    touchpoint_name: item?.touchpoint_name || '', sentiment_at_touchpoint: item?.sentiment_at_touchpoint || 'Neutral', engagement_level: item?.engagement_level || '',
    is_churn_indicator: item?.is_churn_indicator || false, days_before_churn: item?.days_before_churn || '', ai_insights: item?.ai_insights || '',
    ai_response: item?.ai_response || null, ai_response_time_ms: item?.ai_response_time_ms || null,
  });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const toast = useToast();

  useEffect(() => { api.get('/customers').then((res) => setCustomers(res.data)); }, []);

  const handleAI = async () => {
    if (!form.customer_id) { toast.warning('Select customer first'); return; }
    setAiLoading(true);
    setAiResult(null);
    try {
      const res = await api.post('/ai/map-journey', { customer_id: form.customer_id });
      setAiResult(res.data);
      setForm(prev => ({
        ...prev, journey_stage: res.data.journey_stage, touchpoint_type: res.data.touchpoint_type, touchpoint_name: res.data.touchpoint_name,
        sentiment_at_touchpoint: res.data.sentiment_at_touchpoint, engagement_level: res.data.engagement_level, is_churn_indicator: res.data.is_churn_indicator,
        days_before_churn: res.data.days_before_churn || '', ai_insights: res.data.ai_insights, ai_response: res.data, ai_response_time_ms: res.data.response_time_ms,
      }));
      toast.success(`AI analysis complete in ${res.data.response_time_ms}ms`);
    } catch (err) { toast.error('AI failed: ' + (err.response?.data?.error || err.message)); }
    setAiLoading(false);
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
      <div className="form-group"><label>Customer *</label><select value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })} required><option value="">Select</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.company})</option>)}</select></div>
      <button type="button" className="btn btn-primary" onClick={handleAI} disabled={aiLoading} style={{ marginBottom: '16px', background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)' }}>{aiLoading ? <><span className="spinner" style={{ width: 16, height: 16, marginRight: 8 }}></span> Mapping Journey...</> : '🗺️ AI Map Journey'}</button>
      {aiResult && (
        <div style={{ ...aiResultStyles.container, marginBottom: '20px' }}>
          <div style={aiResultStyles.header}><h4 style={aiResultStyles.title}>Journey Mapping Result</h4><span style={aiResultStyles.time}>{aiResult.response_time_ms}ms</span></div>
          <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <span style={{ ...aiResultStyles.chip, background: 'rgba(99, 102, 241, 0.2)', color: '#a5b4fc', fontSize: '13px' }}>Stage: {aiResult.journey_stage}</span>
            <span style={{ ...aiResultStyles.chip, background: 'rgba(34, 211, 238, 0.2)', color: '#22d3ee', fontSize: '13px' }}>{aiResult.touchpoint_type}</span>
            <span style={{ ...aiResultStyles.chip, background: aiResult.sentiment_at_touchpoint?.includes('Positive') ? 'rgba(16, 185, 129, 0.2)' : aiResult.sentiment_at_touchpoint === 'Neutral' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.2)', color: aiResult.sentiment_at_touchpoint?.includes('Positive') ? '#10b981' : aiResult.sentiment_at_touchpoint === 'Neutral' ? '#f59e0b' : '#ef4444', fontSize: '13px' }}>{aiResult.sentiment_at_touchpoint}</span>
            {aiResult.is_churn_indicator && <span style={{ ...aiResultStyles.chip, background: 'rgba(239, 68, 68, 0.3)', color: '#ef4444', fontSize: '13px' }}>Churn Indicator</span>}
          </div>
          <div style={{ marginBottom: '12px' }}><p style={{ fontSize: '12px', color: '#6366f1', marginBottom: '4px' }}>Touchpoint:</p><p style={{ fontSize: '14px', color: '#fff', fontWeight: '500' }}>{aiResult.touchpoint_name}</p></div>
          <div style={{ background: '#1a1a2e', padding: '12px', borderRadius: '8px', marginBottom: '12px' }}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><span style={{ fontSize: '12px', color: '#9ca3af' }}>Engagement:</span><div style={{ flex: 1, height: '8px', background: '#2d2d4a', borderRadius: '4px', overflow: 'hidden' }}><div style={{ width: `${aiResult.engagement_level}%`, height: '100%', background: `linear-gradient(90deg, ${aiResult.engagement_level > 70 ? '#10b981' : aiResult.engagement_level > 40 ? '#f59e0b' : '#ef4444'}, #22d3ee)`, borderRadius: '4px' }} /></div><span style={{ fontSize: '14px', fontWeight: '600', color: aiResult.engagement_level > 70 ? '#10b981' : aiResult.engagement_level > 40 ? '#f59e0b' : '#ef4444' }}>{aiResult.engagement_level}%</span></div></div>
          {aiResult.ai_insights && (<div style={{ background: '#1a1a2e', padding: '12px', borderRadius: '8px' }}><p style={{ fontSize: '11px', color: '#6366f1', marginBottom: '4px' }}>AI Insights:</p><p style={{ fontSize: '13px', color: '#e0e0e0', lineHeight: '1.5' }}>{aiResult.ai_insights}</p></div>)}
        </div>
      )}
      <div className="form-row">
        <div className="form-group"><label>Journey Stage</label><select value={form.journey_stage} onChange={(e) => setForm({ ...form, journey_stage: e.target.value })}><option value="Onboarding">Onboarding</option><option value="Active">Active</option><option value="Growth">Growth</option><option value="Expansion">Expansion</option><option value="At-Risk">At-Risk</option><option value="Declining">Declining</option><option value="Churned">Churned</option><option value="Advocacy">Advocacy</option></select></div>
        <div className="form-group"><label>Touchpoint Type</label><select value={form.touchpoint_type} onChange={(e) => setForm({ ...form, touchpoint_type: e.target.value })}><option value="Product">Product</option><option value="Support">Support</option><option value="Sales">Sales</option><option value="Marketing">Marketing</option><option value="Billing">Billing</option><option value="Success">Success</option><option value="Training">Training</option></select></div>
      </div>
      <div className="form-group"><label>Touchpoint Name *</label><input value={form.touchpoint_name} onChange={(e) => setForm({ ...form, touchpoint_name: e.target.value })} placeholder="e.g., Feature Adoption Milestone" required /></div>
      <div className="form-row">
        <div className="form-group"><label>Sentiment</label><select value={form.sentiment_at_touchpoint} onChange={(e) => setForm({ ...form, sentiment_at_touchpoint: e.target.value })}><option value="Very Positive">Very Positive</option><option value="Positive">Positive</option><option value="Neutral">Neutral</option><option value="Negative">Negative</option><option value="Very Negative">Very Negative</option></select></div>
        <div className="form-group"><label>Engagement Level (0-100)</label><input type="number" min="0" max="100" value={form.engagement_level} onChange={(e) => setForm({ ...form, engagement_level: e.target.value })} /></div>
      </div>
      <div className="form-row">
        <div className="form-group"><label>Churn Indicator</label><select value={form.is_churn_indicator} onChange={(e) => setForm({ ...form, is_churn_indicator: e.target.value === 'true' })}><option value="false">No</option><option value="true">Yes</option></select></div>
        <div className="form-group"><label>Days Before Churn</label><input type="number" value={form.days_before_churn} onChange={(e) => setForm({ ...form, days_before_churn: e.target.value })} placeholder="If churn indicator" /></div>
      </div>
      <div className="form-group"><label>AI Insights</label><textarea value={form.ai_insights} onChange={(e) => setForm({ ...form, ai_insights: e.target.value })} rows={3} /></div>
      <div style={styles.formActions}><button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button><button type="submit" className="btn btn-primary">Save</button></div>
    </form>
  );
}

// ============ WIN-BACK CAMPAIGN FORM ============
function WinbackForm({ item, onSave, onCancel }) {
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({
    customer_id: item?.customer_id || '', campaign_name: item?.campaign_name || '', campaign_type: item?.campaign_type || 'Personalized',
    offer_type: item?.offer_type || 'Discount', offer_details: item?.offer_details || '', discount_percentage: item?.discount_percentage || '',
    personalization_score: item?.personalization_score || '', predicted_success_rate: item?.predicted_success_rate || '',
    email_subject: item?.email_subject || '', email_body: item?.email_body || '', status: item?.status || 'draft',
    ai_response: item?.ai_response || null, ai_response_time_ms: item?.ai_response_time_ms || null,
  });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const toast = useToast();

  useEffect(() => { api.get('/customers').then((res) => setCustomers(res.data)); }, []);

  const handleAI = async () => {
    if (!form.customer_id) { toast.warning('Select customer first'); return; }
    setAiLoading(true);
    setAiResult(null);
    try {
      const res = await api.post('/ai/generate-winback', { customer_id: form.customer_id, campaign_type: form.campaign_type });
      setAiResult(res.data);
      setForm(prev => ({
        ...prev, campaign_name: res.data.campaign_name, campaign_type: res.data.campaign_type, offer_type: res.data.offer_type,
        offer_details: res.data.offer_details, discount_percentage: res.data.discount_percentage, personalization_score: res.data.personalization_score,
        predicted_success_rate: res.data.predicted_success_rate, email_subject: res.data.email_subject, email_body: res.data.email_body,
        ai_response: res.data, ai_response_time_ms: res.data.response_time_ms,
      }));
      toast.success(`AI generated campaign in ${res.data.response_time_ms}ms`);
    } catch (err) { toast.error('AI failed: ' + (err.response?.data?.error || err.message)); }
    setAiLoading(false);
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
      <div className="form-group"><label>Customer *</label><select value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })} required><option value="">Select</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.company})</option>)}</select></div>
      <button type="button" className="btn btn-primary" onClick={handleAI} disabled={aiLoading} style={{ marginBottom: '16px', background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}>{aiLoading ? <><span className="spinner" style={{ width: 16, height: 16, marginRight: 8 }}></span> Generating Campaign...</> : '🎁 AI Generate Win-Back'}</button>
      {aiResult && (
        <div style={{ ...aiResultStyles.container, marginBottom: '20px' }}>
          <div style={aiResultStyles.header}><h4 style={aiResultStyles.title}>Win-Back Campaign Generated</h4><span style={aiResultStyles.time}>{aiResult.response_time_ms}ms</span></div>
          <div style={{ display: 'flex', gap: '20px', marginBottom: '16px' }}>
            <div style={{ textAlign: 'center' }}>
              <svg width="80" height="80" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="none" stroke="#2d2d4a" strokeWidth="8" /><circle cx="50" cy="50" r="40" fill="none" stroke="#10b981" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(aiResult.predicted_success_rate / 100) * 251.2} 251.2`} transform="rotate(-90 50 50)" /><text x="50" y="55" textAnchor="middle" fontSize="16" fontWeight="bold" fill="#10b981">{aiResult.predicted_success_rate}%</text></svg>
              <p style={{ fontSize: '10px', color: '#9ca3af', marginTop: '4px' }}>Success Rate</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <svg width="80" height="80" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="none" stroke="#2d2d4a" strokeWidth="8" /><circle cx="50" cy="50" r="40" fill="none" stroke="#6366f1" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(aiResult.personalization_score / 100) * 251.2} 251.2`} transform="rotate(-90 50 50)" /><text x="50" y="55" textAnchor="middle" fontSize="16" fontWeight="bold" fill="#6366f1">{aiResult.personalization_score}%</text></svg>
              <p style={{ fontSize: '10px', color: '#9ca3af', marginTop: '4px' }}>Personalization</p>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '16px', color: '#fff', fontWeight: '600', marginBottom: '8px' }}>{aiResult.campaign_name}</p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ ...aiResultStyles.chip, background: 'rgba(99, 102, 241, 0.2)' }}>{aiResult.campaign_type}</span>
                <span style={{ ...aiResultStyles.chip, background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' }}>{aiResult.offer_type}</span>
                {aiResult.discount_percentage > 0 && <span style={{ ...aiResultStyles.chip, background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' }}>{aiResult.discount_percentage}% OFF</span>}
              </div>
            </div>
          </div>
          <div style={{ background: '#1a1a2e', padding: '12px', borderRadius: '8px', marginBottom: '12px' }}><p style={{ fontSize: '11px', color: '#f59e0b', marginBottom: '4px' }}>Email Subject:</p><p style={{ fontSize: '14px', color: '#fff', fontWeight: '500' }}>{aiResult.email_subject}</p></div>
          {aiResult.key_selling_points?.length > 0 && (<div><p style={{ fontSize: '11px', color: '#6366f1', marginBottom: '6px' }}>Key Selling Points:</p><div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>{aiResult.key_selling_points.map((p, i) => <span key={i} style={{ fontSize: '12px', color: '#e0e0e0' }}>• {p}</span>)}</div></div>)}
        </div>
      )}
      <div className="form-group"><label>Campaign Name *</label><input value={form.campaign_name} onChange={(e) => setForm({ ...form, campaign_name: e.target.value })} required /></div>
      <div className="form-row">
        <div className="form-group"><label>Campaign Type</label><select value={form.campaign_type} onChange={(e) => setForm({ ...form, campaign_type: e.target.value })}><option value="Personalized">Personalized</option><option value="Re-engagement">Re-engagement</option><option value="Price Sensitive">Price Sensitive</option><option value="Feature Preview">Feature Preview</option><option value="Retention">Retention</option></select></div>
        <div className="form-group"><label>Offer Type</label><select value={form.offer_type} onChange={(e) => setForm({ ...form, offer_type: e.target.value })}><option value="Discount">Discount</option><option value="Feature Unlock">Feature Unlock</option><option value="Extended Trial">Extended Trial</option><option value="Concierge Service">Concierge Service</option><option value="Training">Training</option></select></div>
      </div>
      <div className="form-group"><label>Offer Details</label><textarea value={form.offer_details} onChange={(e) => setForm({ ...form, offer_details: e.target.value })} rows={2} /></div>
      <div className="form-row">
        <div className="form-group"><label>Discount %</label><input type="number" min="0" max="100" value={form.discount_percentage} onChange={(e) => setForm({ ...form, discount_percentage: e.target.value })} /></div>
        <div className="form-group"><label>Success Rate (0-100)</label><input type="number" min="0" max="100" value={form.predicted_success_rate} onChange={(e) => setForm({ ...form, predicted_success_rate: e.target.value })} /></div>
      </div>
      <div className="form-group"><label>Email Subject</label><input value={form.email_subject} onChange={(e) => setForm({ ...form, email_subject: e.target.value })} /></div>
      <div className="form-group"><label>Email Body</label><textarea value={form.email_body} onChange={(e) => setForm({ ...form, email_body: e.target.value })} rows={5} /></div>
      <div className="form-group"><label>Status</label><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="draft">Draft</option><option value="scheduled">Scheduled</option><option value="sent">Sent</option></select></div>
      <div style={styles.formActions}><button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button><button type="submit" className="btn btn-primary">Save</button></div>
    </form>
  );
}

// ============ HEALTH DASHBOARD FORM ============
function HealthDashboardForm({ item, onSave, onCancel }) {
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({
    customer_id: item?.customer_id || '', health_score: item?.health_score || '', engagement_index: item?.engagement_index || '',
    satisfaction_index: item?.satisfaction_index || '', financial_health: item?.financial_health || '', product_adoption: item?.product_adoption || '',
    support_sentiment: item?.support_sentiment || '', trend_direction: item?.trend_direction || 'stable', trend_percentage: item?.trend_percentage || '',
    last_activity_days: item?.last_activity_days || '', recommended_actions: item?.recommended_actions?.map(a => typeof a === 'string' ? a : (a.action || a.recommendation || JSON.stringify(a))).join('\n') || '', ai_summary: item?.ai_summary || '',
    ai_response: item?.ai_response || null, ai_response_time_ms: item?.ai_response_time_ms || null,
  });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const toast = useToast();

  useEffect(() => { api.get('/customers').then((res) => setCustomers(res.data)); }, []);

  const handleAI = async () => {
    if (!form.customer_id) { toast.warning('Select customer first'); return; }
    setAiLoading(true);
    setAiResult(null);
    try {
      const res = await api.post('/ai/calculate-health', { customer_id: form.customer_id });
      setAiResult(res.data);
      setForm(prev => ({
        ...prev, health_score: res.data.health_score, engagement_index: res.data.engagement_index, satisfaction_index: res.data.satisfaction_index,
        financial_health: res.data.financial_health, product_adoption: res.data.product_adoption, support_sentiment: res.data.support_sentiment,
        trend_direction: res.data.trend_direction, trend_percentage: res.data.trend_percentage, last_activity_days: res.data.last_activity_days,
        recommended_actions: res.data.recommended_actions?.map(a => typeof a === 'string' ? a : (a.action || a.recommendation || JSON.stringify(a))).join('\n') || '', ai_summary: res.data.ai_summary,
        ai_response: res.data, ai_response_time_ms: res.data.response_time_ms,
      }));
      toast.success(`AI analysis complete in ${res.data.response_time_ms}ms`);
    } catch (err) { toast.error('AI failed: ' + (err.response?.data?.error || err.message)); }
    setAiLoading(false);
  };

  const getHealthColor = (score) => score > 70 ? '#10b981' : score > 40 ? '#f59e0b' : '#ef4444';

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave({ ...form, recommended_actions: form.recommended_actions.split('\n').filter(a => a.trim()) }); }}>
      <div className="form-group"><label>Customer *</label><select value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })} required><option value="">Select</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.company})</option>)}</select></div>
      <button type="button" className="btn btn-primary" onClick={handleAI} disabled={aiLoading} style={{ marginBottom: '16px', background: 'linear-gradient(135deg, #10b981, #22d3ee)' }}>{aiLoading ? <><span className="spinner" style={{ width: 16, height: 16, marginRight: 8 }}></span> Calculating Health...</> : '💚 AI Health Analysis'}</button>
      {aiResult && (
        <div style={{ ...aiResultStyles.container, marginBottom: '20px' }}>
          <div style={aiResultStyles.header}><h4 style={aiResultStyles.title}>Health Score Dashboard</h4><span style={aiResultStyles.time}>{aiResult.response_time_ms}ms</span></div>
          <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'center' }}>
              <svg width="100" height="100" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="none" stroke="#2d2d4a" strokeWidth="10" /><circle cx="50" cy="50" r="40" fill="none" stroke={getHealthColor(aiResult.health_score)} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(aiResult.health_score / 100) * 251.2} 251.2`} transform="rotate(-90 50 50)" /><text x="50" y="50" textAnchor="middle" fontSize="22" fontWeight="bold" fill={getHealthColor(aiResult.health_score)}>{aiResult.health_score}</text><text x="50" y="65" textAnchor="middle" fontSize="10" fill="#9ca3af">Health</text></svg>
            </div>
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              {[{label: 'Engagement', value: aiResult.engagement_index}, {label: 'Satisfaction', value: aiResult.satisfaction_index}, {label: 'Financial', value: aiResult.financial_health}, {label: 'Adoption', value: aiResult.product_adoption}, {label: 'Support', value: aiResult.support_sentiment}].map((m, i) => (
                <div key={i} style={{ background: '#1a1a2e', padding: '8px 12px', borderRadius: '8px' }}><span style={{ fontSize: '10px', color: '#9ca3af' }}>{m.label}</span><div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ flex: 1, height: '4px', background: '#2d2d4a', borderRadius: '2px', overflow: 'hidden' }}><div style={{ width: `${m.value}%`, height: '100%', background: getHealthColor(m.value) }} /></div><span style={{ fontSize: '12px', fontWeight: '600', color: getHealthColor(m.value) }}>{m.value}</span></div></div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
            <span style={{ ...aiResultStyles.chip, background: aiResult.trend_direction === 'up' ? 'rgba(16, 185, 129, 0.2)' : aiResult.trend_direction === 'down' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(99, 102, 241, 0.2)', color: aiResult.trend_direction === 'up' ? '#10b981' : aiResult.trend_direction === 'down' ? '#ef4444' : '#a5b4fc' }}>{aiResult.trend_direction === 'up' ? '↑' : aiResult.trend_direction === 'down' ? '↓' : '→'} {aiResult.trend_percentage}%</span>
            <span style={{ ...aiResultStyles.chip, background: '#1a1a2e' }}>Last Activity: {aiResult.last_activity_days} days ago</span>
          </div>
          {(aiResult.risk_indicators?.items?.length > 0 || aiResult.positive_signals?.items?.length > 0) && (
            <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
              {aiResult.risk_indicators?.items?.length > 0 && (<div style={{ flex: 1 }}><p style={{ fontSize: '10px', color: '#ef4444', marginBottom: '4px' }}>Risk Indicators:</p>{aiResult.risk_indicators.items.map((r, i) => <span key={i} style={{ display: 'block', fontSize: '11px', color: '#fca5a5' }}>• {typeof r === 'string' ? r : (r.risk_factor || r.description || JSON.stringify(r))}</span>)}</div>)}
              {aiResult.positive_signals?.items?.length > 0 && (<div style={{ flex: 1 }}><p style={{ fontSize: '10px', color: '#10b981', marginBottom: '4px' }}>Positive Signals:</p>{aiResult.positive_signals.items.map((p, i) => <span key={i} style={{ display: 'block', fontSize: '11px', color: '#6ee7b7' }}>• {typeof p === 'string' ? p : (p.positive_factor || p.description || JSON.stringify(p))}</span>)}</div>)}
            </div>
          )}
          {aiResult.ai_summary && (<div style={{ background: '#1a1a2e', padding: '12px', borderRadius: '8px' }}><p style={{ fontSize: '11px', color: '#6366f1', marginBottom: '4px' }}>AI Summary:</p><p style={{ fontSize: '13px', color: '#e0e0e0', lineHeight: '1.5' }}>{aiResult.ai_summary}</p></div>)}
        </div>
      )}
      <div className="form-row">
        <div className="form-group"><label>Health Score (0-100) *</label><input type="number" min="0" max="100" value={form.health_score} onChange={(e) => setForm({ ...form, health_score: e.target.value })} required /></div>
        <div className="form-group"><label>Engagement Index (0-100)</label><input type="number" min="0" max="100" value={form.engagement_index} onChange={(e) => setForm({ ...form, engagement_index: e.target.value })} /></div>
      </div>
      <div className="form-row">
        <div className="form-group"><label>Satisfaction Index (0-100)</label><input type="number" min="0" max="100" value={form.satisfaction_index} onChange={(e) => setForm({ ...form, satisfaction_index: e.target.value })} /></div>
        <div className="form-group"><label>Financial Health (0-100)</label><input type="number" min="0" max="100" value={form.financial_health} onChange={(e) => setForm({ ...form, financial_health: e.target.value })} /></div>
      </div>
      <div className="form-row">
        <div className="form-group"><label>Product Adoption (0-100)</label><input type="number" min="0" max="100" value={form.product_adoption} onChange={(e) => setForm({ ...form, product_adoption: e.target.value })} /></div>
        <div className="form-group"><label>Support Sentiment (0-100)</label><input type="number" min="0" max="100" value={form.support_sentiment} onChange={(e) => setForm({ ...form, support_sentiment: e.target.value })} /></div>
      </div>
      <div className="form-row">
        <div className="form-group"><label>Trend</label><select value={form.trend_direction} onChange={(e) => setForm({ ...form, trend_direction: e.target.value })}><option value="up">Up</option><option value="down">Down</option><option value="stable">Stable</option></select></div>
        <div className="form-group"><label>Trend %</label><input type="number" step="0.1" value={form.trend_percentage} onChange={(e) => setForm({ ...form, trend_percentage: e.target.value })} /></div>
      </div>
      <div className="form-group"><label>Recommended Actions (one per line)</label><textarea value={form.recommended_actions} onChange={(e) => setForm({ ...form, recommended_actions: e.target.value })} rows={3} /></div>
      <div className="form-group"><label>AI Summary</label><textarea value={form.ai_summary} onChange={(e) => setForm({ ...form, ai_summary: e.target.value })} rows={3} /></div>
      <div style={styles.formActions}><button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button><button type="submit" className="btn btn-primary">Save</button></div>
    </form>
  );
}

// ============ ESCALATION PREDICTION FORM ============
function EscalationForm({ item, onSave, onCancel }) {
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({
    customer_id: item?.customer_id || '', frustration_score: item?.frustration_score || '', escalation_probability: item?.escalation_probability || '',
    frustration_indicators: item?.frustration_indicators?.map(f => typeof f === 'string' ? f : (f.indicator || f.description || JSON.stringify(f))).join(', ') || '', communication_sentiment: item?.communication_sentiment || 'Neutral',
    response_urgency: item?.response_urgency || 'Medium', predicted_escalation_type: item?.predicted_escalation_type || '',
    recommended_preemptive_action: item?.recommended_preemptive_action || '', agent_talking_points: item?.agent_talking_points?.map(p => typeof p === 'string' ? p : (p.point || p.text || JSON.stringify(p))).join('\n') || '',
    priority_level: item?.priority_level || 'Medium', status: item?.status || 'active',
    ai_response: item?.ai_response || null, ai_response_time_ms: item?.ai_response_time_ms || null,
  });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const toast = useToast();

  useEffect(() => { api.get('/customers').then((res) => setCustomers(res.data)); }, []);

  const handleAI = async () => {
    if (!form.customer_id) { toast.warning('Select customer first'); return; }
    setAiLoading(true);
    setAiResult(null);
    try {
      const res = await api.post('/ai/predict-escalation', { customer_id: form.customer_id });
      setAiResult(res.data);
      setForm(prev => ({
        ...prev, frustration_score: res.data.frustration_score, escalation_probability: res.data.escalation_probability,
        frustration_indicators: res.data.frustration_indicators?.map(f => typeof f === 'string' ? f : (f.indicator || f.description || JSON.stringify(f))).join(', ') || '', communication_sentiment: res.data.communication_sentiment,
        response_urgency: res.data.response_urgency, predicted_escalation_type: res.data.predicted_escalation_type,
        recommended_preemptive_action: res.data.recommended_preemptive_action, agent_talking_points: res.data.agent_talking_points?.map(p => typeof p === 'string' ? p : (p.point || p.text || JSON.stringify(p))).join('\n') || '',
        priority_level: res.data.priority_level, ai_response: res.data, ai_response_time_ms: res.data.response_time_ms,
      }));
      toast.success(`AI prediction complete in ${res.data.response_time_ms}ms`);
    } catch (err) { toast.error('AI failed: ' + (err.response?.data?.error || err.message)); }
    setAiLoading(false);
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave({ ...form, frustration_indicators: form.frustration_indicators.split(',').map(i => i.trim()).filter(i => i), agent_talking_points: form.agent_talking_points.split('\n').filter(p => p.trim()) }); }}>
      <div className="form-group"><label>Customer *</label><select value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })} required><option value="">Select</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.company})</option>)}</select></div>
      <button type="button" className="btn btn-primary" onClick={handleAI} disabled={aiLoading} style={{ marginBottom: '16px', background: 'linear-gradient(135deg, #ef4444, #f59e0b)' }}>{aiLoading ? <><span className="spinner" style={{ width: 16, height: 16, marginRight: 8 }}></span> Predicting Escalation...</> : '🚨 AI Predict Escalation'}</button>
      {aiResult && (
        <div style={{ ...aiResultStyles.container, marginBottom: '20px', borderColor: aiResult.escalation_probability > 60 ? '#ef4444' : '#2d2d4a' }}>
          <div style={aiResultStyles.header}><h4 style={aiResultStyles.title}>Escalation Prediction</h4><span style={aiResultStyles.time}>{aiResult.response_time_ms}ms</span></div>
          <div style={{ display: 'flex', gap: '20px', marginBottom: '16px' }}>
            <div style={{ textAlign: 'center' }}>
              <svg width="90" height="90" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="none" stroke="#2d2d4a" strokeWidth="8" /><circle cx="50" cy="50" r="40" fill="none" stroke={aiResult.frustration_score > 60 ? '#ef4444' : aiResult.frustration_score > 30 ? '#f59e0b' : '#10b981'} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(aiResult.frustration_score / 100) * 251.2} 251.2`} transform="rotate(-90 50 50)" /><text x="50" y="50" textAnchor="middle" fontSize="20" fontWeight="bold" fill={aiResult.frustration_score > 60 ? '#ef4444' : aiResult.frustration_score > 30 ? '#f59e0b' : '#10b981'}>{aiResult.frustration_score}</text><text x="50" y="65" textAnchor="middle" fontSize="9" fill="#9ca3af">Frustration</text></svg>
            </div>
            <div style={{ textAlign: 'center' }}>
              <svg width="90" height="90" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="none" stroke="#2d2d4a" strokeWidth="8" /><circle cx="50" cy="50" r="40" fill="none" stroke={aiResult.escalation_probability > 60 ? '#ef4444' : aiResult.escalation_probability > 30 ? '#f59e0b' : '#10b981'} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(aiResult.escalation_probability / 100) * 251.2} 251.2`} transform="rotate(-90 50 50)" /><text x="50" y="50" textAnchor="middle" fontSize="20" fontWeight="bold" fill={aiResult.escalation_probability > 60 ? '#ef4444' : aiResult.escalation_probability > 30 ? '#f59e0b' : '#10b981'}>{aiResult.escalation_probability}%</text><text x="50" y="65" textAnchor="middle" fontSize="9" fill="#9ca3af">Escalation</text></svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                <span style={{ ...aiResultStyles.chip, background: aiResult.priority_level === 'Critical' || aiResult.priority_level === 'High' ? 'rgba(239, 68, 68, 0.3)' : aiResult.priority_level === 'Medium' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)', color: aiResult.priority_level === 'Critical' || aiResult.priority_level === 'High' ? '#ef4444' : aiResult.priority_level === 'Medium' ? '#f59e0b' : '#10b981', fontWeight: '600' }}>{aiResult.priority_level} Priority</span>
                <span style={{ ...aiResultStyles.chip, background: 'rgba(99, 102, 241, 0.2)' }}>{aiResult.response_urgency}</span>
                <span style={{ ...aiResultStyles.chip, background: '#1a1a2e' }}>{aiResult.communication_sentiment}</span>
              </div>
              <p style={{ fontSize: '12px', color: '#f59e0b', marginBottom: '4px' }}>Predicted Type:</p>
              <p style={{ fontSize: '14px', color: '#fff', fontWeight: '500' }}>{aiResult.predicted_escalation_type}</p>
            </div>
          </div>
          {aiResult.frustration_indicators?.length > 0 && (<div style={{ marginBottom: '12px' }}><p style={{ fontSize: '10px', color: '#ef4444', marginBottom: '4px' }}>Frustration Indicators:</p><div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>{aiResult.frustration_indicators.map((ind, i) => <span key={i} style={{ ...aiResultStyles.chip, background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', fontSize: '10px' }}>{ind}</span>)}</div></div>)}
          {aiResult.recommended_preemptive_action && (<div style={{ background: '#1a1a2e', padding: '12px', borderRadius: '8px', marginBottom: '12px' }}><p style={{ fontSize: '10px', color: '#10b981', marginBottom: '4px' }}>Recommended Preemptive Action:</p><p style={{ fontSize: '13px', color: '#e0e0e0', lineHeight: '1.5' }}>{aiResult.recommended_preemptive_action}</p></div>)}
          {aiResult.agent_talking_points?.length > 0 && (<div><p style={{ fontSize: '10px', color: '#6366f1', marginBottom: '4px' }}>Agent Talking Points:</p>{aiResult.agent_talking_points.map((p, i) => <span key={i} style={{ display: 'block', fontSize: '12px', color: '#a5b4fc', marginBottom: '4px' }}>• {p}</span>)}</div>)}
        </div>
      )}
      <div className="form-row">
        <div className="form-group"><label>Frustration Score (0-100)</label><input type="number" min="0" max="100" value={form.frustration_score} onChange={(e) => setForm({ ...form, frustration_score: e.target.value })} /></div>
        <div className="form-group"><label>Escalation Probability (0-100)</label><input type="number" min="0" max="100" value={form.escalation_probability} onChange={(e) => setForm({ ...form, escalation_probability: e.target.value })} /></div>
      </div>
      <div className="form-group"><label>Frustration Indicators (comma-separated)</label><input value={form.frustration_indicators} onChange={(e) => setForm({ ...form, frustration_indicators: e.target.value })} /></div>
      <div className="form-row">
        <div className="form-group"><label>Communication Sentiment</label><select value={form.communication_sentiment} onChange={(e) => setForm({ ...form, communication_sentiment: e.target.value })}><option value="Delighted">Delighted</option><option value="Satisfied">Satisfied</option><option value="Neutral">Neutral</option><option value="Frustrated">Frustrated</option><option value="Angry">Angry</option><option value="Very Frustrated">Very Frustrated</option></select></div>
        <div className="form-group"><label>Response Urgency</label><select value={form.response_urgency} onChange={(e) => setForm({ ...form, response_urgency: e.target.value })}><option value="Low">Low</option><option value="Medium">Medium</option><option value="High">High</option><option value="Immediate">Immediate</option></select></div>
      </div>
      <div className="form-group"><label>Predicted Escalation Type</label><input value={form.predicted_escalation_type} onChange={(e) => setForm({ ...form, predicted_escalation_type: e.target.value })} /></div>
      <div className="form-group"><label>Recommended Preemptive Action</label><textarea value={form.recommended_preemptive_action} onChange={(e) => setForm({ ...form, recommended_preemptive_action: e.target.value })} rows={2} /></div>
      <div className="form-group"><label>Agent Talking Points (one per line)</label><textarea value={form.agent_talking_points} onChange={(e) => setForm({ ...form, agent_talking_points: e.target.value })} rows={3} /></div>
      <div className="form-row">
        <div className="form-group"><label>Priority Level</label><select value={form.priority_level} onChange={(e) => setForm({ ...form, priority_level: e.target.value })}><option value="Low">Low</option><option value="Medium">Medium</option><option value="High">High</option><option value="Critical">Critical</option></select></div>
        <div className="form-group"><label>Status</label><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="active">Active</option><option value="monitoring">Monitoring</option><option value="escalated">Escalated</option><option value="resolved">Resolved</option></select></div>
      </div>
      <div style={styles.formActions}><button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button><button type="submit" className="btn btn-primary">Save</button></div>
    </form>
  );
}

// ============ SERVICE LEVEL PREDICTION FORM ============
function ServiceLevelForm({ item, onSave, onCancel }) {
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({
    customer_id: item?.customer_id || '', predicted_response_time: item?.predicted_response_time || '',
    predicted_resolution_time: item?.predicted_resolution_time || '', sla_compliance_probability: item?.sla_compliance_probability || '',
    service_tier: item?.service_tier || 'Standard', priority_score: item?.priority_score || '',
    queue_position: item?.queue_position || '', expected_first_response: item?.expected_first_response || '',
    expected_resolution: item?.expected_resolution || '', bottleneck_factors: item?.bottleneck_factors?.join(', ') || '',
    optimization_suggestions: item?.optimization_suggestions?.join(', ') || '', agent_workload_impact: item?.agent_workload_impact || 'Medium',
    customer_patience_index: item?.customer_patience_index || '', ai_response: item?.ai_response || null, ai_response_time_ms: item?.ai_response_time_ms || null,
  });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const toast = useToast();

  useEffect(() => { api.get('/customers').then((res) => setCustomers(res.data)); }, []);

  const handleAI = async () => {
    if (!form.customer_id) { toast.warning('Select customer first'); return; }
    setAiLoading(true);
    setAiResult(null);
    try {
      const res = await api.post('/ai/predict-service-level', { customer_id: form.customer_id, issue_type: 'General Support' });
      setAiResult(res.data);
      setForm(prev => ({
        ...prev, predicted_response_time: res.data.predicted_response_time, predicted_resolution_time: res.data.predicted_resolution_time,
        sla_compliance_probability: res.data.sla_compliance_probability, service_tier: res.data.service_tier,
        priority_score: res.data.priority_score, queue_position: res.data.queue_position,
        expected_first_response: res.data.expected_first_response, expected_resolution: res.data.expected_resolution,
        bottleneck_factors: res.data.bottleneck_factors?.join(', ') || '', optimization_suggestions: res.data.optimization_suggestions?.join(', ') || '',
        agent_workload_impact: res.data.agent_workload_impact, customer_patience_index: res.data.customer_patience_index,
        ai_response: res.data, ai_response_time_ms: res.data.response_time_ms,
      }));
      toast.success(`AI prediction complete in ${res.data.response_time_ms}ms`);
    } catch (err) { toast.error('AI failed: ' + (err.response?.data?.error || err.message)); }
    setAiLoading(false);
  };

  const getTierColor = (tier) => tier === 'VIP' ? '#f59e0b' : tier === 'Premium' ? '#8b5cf6' : tier === 'Priority' ? '#6366f1' : '#3b82f6';

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave({ ...form, bottleneck_factors: form.bottleneck_factors.split(',').map(i => i.trim()).filter(i => i), optimization_suggestions: form.optimization_suggestions.split(',').map(i => i.trim()).filter(i => i) }); }}>
      <div className="form-group"><label>Customer *</label><select value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })} required><option value="">Select</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.company})</option>)}</select></div>
      <button type="button" className="btn btn-primary" onClick={handleAI} disabled={aiLoading} style={{ marginBottom: '16px', background: 'linear-gradient(135deg, #3b82f6, #06b6d4)' }}>{aiLoading ? <><span className="spinner" style={{ width: 16, height: 16, marginRight: 8 }}></span> Predicting Service Level...</> : '⏱️ AI Predict Service Level'}</button>
      {aiResult && (
        <div style={{ ...aiResultStyles.container, marginBottom: '20px', borderColor: '#3b82f6' }}>
          <div style={aiResultStyles.header}><h4 style={aiResultStyles.title}>Service Level Prediction</h4><span style={aiResultStyles.time}>{aiResult.response_time_ms}ms</span></div>
          <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <div style={{ background: getTierColor(aiResult.service_tier), padding: '12px 20px', borderRadius: '12px', textAlign: 'center' }}>
              <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.8)', marginBottom: '4px' }}>Service Tier</p>
              <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#fff' }}>{aiResult.service_tier}</p>
            </div>
            <div style={{ background: '#1a1a2e', padding: '12px 20px', borderRadius: '12px', textAlign: 'center' }}>
              <p style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '4px' }}>Response Time</p>
              <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#3b82f6' }}>{aiResult.predicted_response_time} min</p>
            </div>
            <div style={{ background: '#1a1a2e', padding: '12px 20px', borderRadius: '12px', textAlign: 'center' }}>
              <p style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '4px' }}>Resolution Time</p>
              <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#06b6d4' }}>{aiResult.predicted_resolution_time}h</p>
            </div>
            <div style={{ background: '#1a1a2e', padding: '12px 20px', borderRadius: '12px', textAlign: 'center' }}>
              <p style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '4px' }}>SLA Compliance</p>
              <p style={{ fontSize: '20px', fontWeight: 'bold', color: aiResult.sla_compliance_probability > 80 ? '#10b981' : aiResult.sla_compliance_probability > 60 ? '#f59e0b' : '#ef4444' }}>{aiResult.sla_compliance_probability}%</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
            <span style={{ ...aiResultStyles.chip, background: 'rgba(99, 102, 241, 0.2)' }}>Queue Position: #{aiResult.queue_position}</span>
            <span style={{ ...aiResultStyles.chip, background: 'rgba(16, 185, 129, 0.2)', color: '#10b981' }}>Priority: {aiResult.priority_score}</span>
            <span style={{ ...aiResultStyles.chip, background: aiResult.agent_workload_impact === 'High' ? 'rgba(239, 68, 68, 0.2)' : aiResult.agent_workload_impact === 'Medium' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)', color: aiResult.agent_workload_impact === 'High' ? '#ef4444' : aiResult.agent_workload_impact === 'Medium' ? '#f59e0b' : '#10b981' }}>{aiResult.agent_workload_impact} Workload</span>
            <span style={{ ...aiResultStyles.chip, background: 'rgba(139, 92, 246, 0.2)', color: '#a78bfa' }}>Patience: {aiResult.customer_patience_index}</span>
          </div>
          {aiResult.bottleneck_factors?.length > 0 && (<div style={{ marginBottom: '12px' }}><p style={{ fontSize: '10px', color: '#f59e0b', marginBottom: '4px' }}>Bottleneck Factors:</p><div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>{aiResult.bottleneck_factors.map((f, i) => <span key={i} style={{ ...aiResultStyles.chip, background: 'rgba(245, 158, 11, 0.15)', color: '#fcd34d', fontSize: '10px' }}>{typeof f === 'object' ? JSON.stringify(f) : f}</span>)}</div></div>)}
          {aiResult.optimization_suggestions?.length > 0 && (<div><p style={{ fontSize: '10px', color: '#10b981', marginBottom: '4px' }}>Optimization Suggestions:</p>{aiResult.optimization_suggestions.map((s, i) => <span key={i} style={{ display: 'block', fontSize: '12px', color: '#6ee7b7', marginBottom: '4px' }}>• {typeof s === 'object' ? JSON.stringify(s) : s}</span>)}</div>)}
        </div>
      )}
      <div className="form-row">
        <div className="form-group"><label>Response Time (min)</label><input type="number" value={form.predicted_response_time} onChange={(e) => setForm({ ...form, predicted_response_time: e.target.value })} /></div>
        <div className="form-group"><label>Resolution Time (hours)</label><input type="number" value={form.predicted_resolution_time} onChange={(e) => setForm({ ...form, predicted_resolution_time: e.target.value })} /></div>
      </div>
      <div className="form-row">
        <div className="form-group"><label>SLA Compliance %</label><input type="number" min="0" max="100" value={form.sla_compliance_probability} onChange={(e) => setForm({ ...form, sla_compliance_probability: e.target.value })} /></div>
        <div className="form-group"><label>Service Tier</label><select value={form.service_tier} onChange={(e) => setForm({ ...form, service_tier: e.target.value })}><option value="Standard">Standard</option><option value="Priority">Priority</option><option value="Premium">Premium</option><option value="VIP">VIP</option></select></div>
      </div>
      <div className="form-row">
        <div className="form-group"><label>Priority Score (0-100)</label><input type="number" min="0" max="100" value={form.priority_score} onChange={(e) => setForm({ ...form, priority_score: e.target.value })} /></div>
        <div className="form-group"><label>Queue Position</label><input type="number" min="1" value={form.queue_position} onChange={(e) => setForm({ ...form, queue_position: e.target.value })} /></div>
      </div>
      <div className="form-group"><label>Bottleneck Factors (comma-separated)</label><input value={form.bottleneck_factors} onChange={(e) => setForm({ ...form, bottleneck_factors: e.target.value })} /></div>
      <div className="form-group"><label>Optimization Suggestions (comma-separated)</label><input value={form.optimization_suggestions} onChange={(e) => setForm({ ...form, optimization_suggestions: e.target.value })} /></div>
      <div className="form-row">
        <div className="form-group"><label>Agent Workload Impact</label><select value={form.agent_workload_impact} onChange={(e) => setForm({ ...form, agent_workload_impact: e.target.value })}><option value="Low">Low</option><option value="Medium">Medium</option><option value="High">High</option></select></div>
        <div className="form-group"><label>Customer Patience Index (0-100)</label><input type="number" min="0" max="100" value={form.customer_patience_index} onChange={(e) => setForm({ ...form, customer_patience_index: e.target.value })} /></div>
      </div>
      <div style={styles.formActions}><button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button><button type="submit" className="btn btn-primary">Save</button></div>
    </form>
  );
}

// ============ RESPONSE SUGGESTION FORM ============
function ResponseSuggestionForm({ item, onSave, onCancel }) {
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({
    customer_id: item?.customer_id || '', ticket_subject: item?.ticket_subject || '', ticket_description: item?.ticket_description || '',
    suggested_response: item?.suggested_response || '', response_tone: item?.response_tone || 'Professional',
    personalization_level: item?.personalization_level || '', key_points: item?.key_points?.join(', ') || '',
    empathy_phrases: item?.empathy_phrases?.join(', ') || '', solution_steps: item?.solution_steps?.join('\n') || '',
    estimated_satisfaction: item?.estimated_satisfaction || '', knowledge_base_links: item?.knowledge_base_links?.map(l => typeof l === 'object' ? (l.title || l.url || JSON.stringify(l)) : l).join(', ') || '',
    ai_response: item?.ai_response || null, ai_response_time_ms: item?.ai_response_time_ms || null,
  });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const toast = useToast();

  useEffect(() => { api.get('/customers').then((res) => setCustomers(res.data)); }, []);

  const handleAI = async () => {
    if (!form.customer_id) { toast.warning('Select customer first'); return; }
    setAiLoading(true);
    setAiResult(null);
    try {
      const res = await api.post('/ai/suggest-response', { customer_id: form.customer_id, ticket_subject: form.ticket_subject, ticket_description: form.ticket_description });
      setAiResult(res.data);
      setForm(prev => ({
        ...prev, suggested_response: res.data.suggested_response, response_tone: res.data.response_tone,
        personalization_level: res.data.personalization_level, key_points: res.data.key_points?.join(', ') || '',
        empathy_phrases: res.data.empathy_phrases?.join(', ') || '', solution_steps: res.data.solution_steps?.join('\n') || '',
        estimated_satisfaction: res.data.estimated_satisfaction, knowledge_base_links: res.data.knowledge_base_links?.map(l => typeof l === 'object' ? (l.title || l.url || JSON.stringify(l)) : l).join(', ') || '',
        ai_response: res.data, ai_response_time_ms: res.data.response_time_ms,
      }));
      toast.success(`AI suggestion complete in ${res.data.response_time_ms}ms`);
    } catch (err) { toast.error('AI failed: ' + (err.response?.data?.error || err.message)); }
    setAiLoading(false);
  };

  const getToneColor = (tone) => tone === 'Empathetic' ? '#ec4899' : tone === 'Apologetic' ? '#f59e0b' : tone === 'Friendly' ? '#10b981' : tone === 'Solution-Focused' ? '#06b6d4' : '#6366f1';

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave({ ...form, key_points: form.key_points.split(',').map(i => i.trim()).filter(i => i), empathy_phrases: form.empathy_phrases.split(',').map(i => i.trim()).filter(i => i), solution_steps: form.solution_steps.split('\n').filter(s => s.trim()), knowledge_base_links: form.knowledge_base_links.split(',').map(i => i.trim()).filter(i => i) }); }}>
      <div className="form-group"><label>Customer *</label><select value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })} required><option value="">Select</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.company})</option>)}</select></div>
      <div className="form-group"><label>Ticket Subject</label><input value={form.ticket_subject} onChange={(e) => setForm({ ...form, ticket_subject: e.target.value })} placeholder="Enter support ticket subject" /></div>
      <div className="form-group"><label>Ticket Description</label><textarea value={form.ticket_description} onChange={(e) => setForm({ ...form, ticket_description: e.target.value })} rows={2} placeholder="Describe the customer's issue" /></div>
      <button type="button" className="btn btn-primary" onClick={handleAI} disabled={aiLoading} style={{ marginBottom: '16px', background: 'linear-gradient(135deg, #ec4899, #8b5cf6)' }}>{aiLoading ? <><span className="spinner" style={{ width: 16, height: 16, marginRight: 8 }}></span> Generating Response...</> : '💡 AI Suggest Response'}</button>
      {aiResult && (
        <div style={{ ...aiResultStyles.container, marginBottom: '20px', borderColor: '#ec4899' }}>
          <div style={aiResultStyles.header}><h4 style={aiResultStyles.title}>AI Response Suggestion</h4><span style={aiResultStyles.time}>{aiResult.response_time_ms}ms</span></div>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <div style={{ background: getToneColor(aiResult.response_tone), padding: '8px 16px', borderRadius: '20px' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#fff' }}>{aiResult.response_tone}</span>
            </div>
            <div style={{ background: '#1a1a2e', padding: '8px 16px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', color: '#9ca3af' }}>Personalization:</span>
              <span style={{ fontSize: '14px', fontWeight: '600', color: '#a78bfa' }}>{aiResult.personalization_level}%</span>
            </div>
            <div style={{ background: '#1a1a2e', padding: '8px 16px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', color: '#9ca3af' }}>Est. Satisfaction:</span>
              <span style={{ fontSize: '14px', fontWeight: '600', color: aiResult.estimated_satisfaction > 80 ? '#10b981' : aiResult.estimated_satisfaction > 60 ? '#f59e0b' : '#ef4444' }}>{aiResult.estimated_satisfaction}%</span>
            </div>
          </div>
          {aiResult.empathy_phrases?.length > 0 && (<div style={{ marginBottom: '12px' }}><p style={{ fontSize: '10px', color: '#ec4899', marginBottom: '4px' }}>Empathy Phrases:</p><div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>{aiResult.empathy_phrases.map((p, i) => <span key={i} style={{ ...aiResultStyles.chip, background: 'rgba(236, 72, 153, 0.15)', color: '#f9a8d4', fontSize: '10px' }}>"{typeof p === 'object' ? JSON.stringify(p) : p}"</span>)}</div></div>)}
          {aiResult.key_points?.length > 0 && (<div style={{ marginBottom: '12px' }}><p style={{ fontSize: '10px', color: '#6366f1', marginBottom: '4px' }}>Key Points to Address:</p>{aiResult.key_points.map((p, i) => <span key={i} style={{ display: 'block', fontSize: '11px', color: '#a5b4fc', marginBottom: '2px' }}>• {typeof p === 'object' ? JSON.stringify(p) : p}</span>)}</div>)}
          {aiResult.solution_steps?.length > 0 && (<div style={{ marginBottom: '12px' }}><p style={{ fontSize: '10px', color: '#10b981', marginBottom: '4px' }}>Solution Steps:</p>{aiResult.solution_steps.map((s, i) => <span key={i} style={{ display: 'block', fontSize: '11px', color: '#6ee7b7', marginBottom: '2px' }}>{i + 1}. {typeof s === 'object' ? JSON.stringify(s) : s}</span>)}</div>)}
          <div style={{ background: '#0f0f1a', padding: '16px', borderRadius: '12px', border: '1px solid #2d2d4a' }}>
            <p style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '8px' }}>Suggested Response:</p>
            <p style={{ fontSize: '13px', color: '#e0e0e0', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{aiResult.suggested_response}</p>
          </div>
          {aiResult.knowledge_base_links?.length > 0 && (<div style={{ marginTop: '12px' }}><p style={{ fontSize: '10px', color: '#06b6d4', marginBottom: '4px' }}>Relevant Knowledge Base:</p><div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>{aiResult.knowledge_base_links.map((l, i) => <span key={i} style={{ ...aiResultStyles.chip, background: 'rgba(6, 182, 212, 0.15)', color: '#67e8f9', fontSize: '10px' }}>{typeof l === 'object' ? (l.title || l.url || JSON.stringify(l)) : l}</span>)}</div></div>)}
        </div>
      )}
      <div className="form-group"><label>Suggested Response</label><textarea value={form.suggested_response} onChange={(e) => setForm({ ...form, suggested_response: e.target.value })} rows={6} /></div>
      <div className="form-row">
        <div className="form-group"><label>Response Tone</label><select value={form.response_tone} onChange={(e) => setForm({ ...form, response_tone: e.target.value })}><option value="Professional">Professional</option><option value="Empathetic">Empathetic</option><option value="Friendly">Friendly</option><option value="Apologetic">Apologetic</option><option value="Solution-Focused">Solution-Focused</option></select></div>
        <div className="form-group"><label>Personalization Level (0-100)</label><input type="number" min="0" max="100" value={form.personalization_level} onChange={(e) => setForm({ ...form, personalization_level: e.target.value })} /></div>
      </div>
      <div className="form-group"><label>Key Points (comma-separated)</label><input value={form.key_points} onChange={(e) => setForm({ ...form, key_points: e.target.value })} /></div>
      <div className="form-group"><label>Empathy Phrases (comma-separated)</label><input value={form.empathy_phrases} onChange={(e) => setForm({ ...form, empathy_phrases: e.target.value })} /></div>
      <div className="form-group"><label>Solution Steps (one per line)</label><textarea value={form.solution_steps} onChange={(e) => setForm({ ...form, solution_steps: e.target.value })} rows={3} /></div>
      <div className="form-row">
        <div className="form-group"><label>Est. Satisfaction (0-100)</label><input type="number" min="0" max="100" value={form.estimated_satisfaction} onChange={(e) => setForm({ ...form, estimated_satisfaction: e.target.value })} /></div>
        <div className="form-group"><label>Knowledge Base Links (comma-separated)</label><input value={form.knowledge_base_links} onChange={(e) => setForm({ ...form, knowledge_base_links: e.target.value })} /></div>
      </div>
      <div style={styles.formActions}><button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button><button type="submit" className="btn btn-primary">Save</button></div>
    </form>
  );
}

// ============ PAGE COMPONENTS ============
const Customers = () => <GenericList title="Customers" apiEndpoint="/customers"
  columns={[
    { key: 'name', label: 'Name' },
    { key: 'company', label: 'Company' },
    { key: 'plan', label: 'Plan', render: (v) => <span className="badge badge-primary">{v}</span> },
    { key: 'monthly_revenue', label: 'Revenue', render: (v) => `$${parseFloat(v || 0).toLocaleString()}` },
    { key: 'status', label: 'Status', render: (v) => <span className={`badge badge-${v === 'active' ? 'success' : v === 'at-risk' ? 'warning' : 'danger'}`}>{v}</span> },
  ]}
  detailFields={[
    { key: 'id', label: 'ID' }, { key: 'name', label: 'Name' }, { key: 'email', label: 'Email' },
    { key: 'company', label: 'Company' }, { key: 'plan', label: 'Plan' },
    { key: 'monthly_revenue', label: 'Monthly Revenue', render: (v) => `$${parseFloat(v || 0).toLocaleString()}` },
    { key: 'signup_date', label: 'Signup Date', render: (v) => v?.split('T')[0] },
    { key: 'last_activity', label: 'Last Activity', render: (v) => v?.split('T')[0] },
    { key: 'status', label: 'Status' },
  ]}
  FormComponent={CustomerForm}
/>;

const Predictions = () => <GenericList title="Churn Predictions" apiEndpoint="/predictions"
  columns={[
    { key: 'customer_name', label: 'Customer' },
    { key: 'company', label: 'Company' },
    { key: 'prediction_score', label: 'Churn Score', render: (v) => <span className={`badge badge-${parseFloat(v) > 70 ? 'danger' : parseFloat(v) > 40 ? 'warning' : 'success'}`}>{parseFloat(v).toFixed(1)}%</span> },
    { key: 'confidence_level', label: 'Confidence', render: (v) => `${parseFloat(v || 0).toFixed(0)}%` },
    { key: 'status', label: 'Status', render: (v) => <span className="badge badge-info">{v}</span> },
  ]}
  detailFields={[
    { key: 'id', label: 'ID' }, { key: 'customer_name', label: 'Customer' }, { key: 'company', label: 'Company' },
    { key: 'prediction_score', label: 'Churn Score', render: (v) => `${parseFloat(v).toFixed(1)}%` },
    { key: 'confidence_level', label: 'Confidence', render: (v) => `${parseFloat(v || 0).toFixed(0)}%` },
    { key: 'factors', label: 'Risk Factors', render: (v) => v?.join(', ') || 'N/A' },
    { key: 'status', label: 'Status' },
    { key: 'prediction_date', label: 'Prediction Date', render: (v) => v?.split('T')[0] },
    { key: 'ai_analysis', label: 'AI Analysis' },
  ]}
  FormComponent={PredictionForm}
/>;

const RiskScores = () => <GenericList title="Risk Scores" apiEndpoint="/risk-scores"
  columns={[
    { key: 'customer_name', label: 'Customer' },
    { key: 'risk_level', label: 'Risk Level', render: (v) => <span className={`badge badge-${v === 'Low' ? 'success' : v === 'Medium' ? 'warning' : 'danger'}`}>{v}</span> },
    { key: 'score', label: 'Score', render: (v) => parseFloat(v).toFixed(1) },
    { key: 'category', label: 'Category' },
  ]}
  detailFields={[
    { key: 'id', label: 'ID' }, { key: 'customer_name', label: 'Customer' },
    { key: 'risk_level', label: 'Risk Level' }, { key: 'score', label: 'Score' }, { key: 'category', label: 'Category' },
    { key: 'contributing_factors', label: 'Contributing Factors', render: (v) => v?.join(', ') || 'N/A' },
    { key: 'recommended_actions', label: 'Recommended Actions', render: (v) => v?.map(a => typeof a === 'string' ? a : (a.action || a.recommendation || '')).join(', ') || 'N/A' },
  ]}
  FormComponent={RiskScoreForm}
/>;

const Segments = () => <GenericList title="Customer Segments" apiEndpoint="/segments"
  columns={[
    { key: 'name', label: 'Segment' },
    { key: 'customer_count', label: 'Customers' },
    { key: 'avg_revenue', label: 'Avg Revenue', render: (v) => `$${parseFloat(v || 0).toLocaleString()}` },
    { key: 'churn_rate', label: 'Churn Rate', render: (v) => <span className={`badge badge-${parseFloat(v) > 20 ? 'danger' : parseFloat(v) > 10 ? 'warning' : 'success'}`}>{parseFloat(v).toFixed(1)}%</span> },
  ]}
  detailFields={[
    { key: 'id', label: 'ID' }, { key: 'name', label: 'Name' }, { key: 'description', label: 'Description' },
    { key: 'criteria', label: 'Criteria', render: (v) => JSON.stringify(v) },
    { key: 'customer_count', label: 'Customer Count' },
    { key: 'avg_revenue', label: 'Avg Revenue', render: (v) => `$${parseFloat(v || 0).toLocaleString()}` },
    { key: 'churn_rate', label: 'Churn Rate', render: (v) => `${parseFloat(v).toFixed(1)}%` },
  ]}
  FormComponent={SegmentForm}
/>;

const Interventions = () => <GenericList title="Interventions" apiEndpoint="/interventions"
  columns={[
    { key: 'customer_name', label: 'Customer' },
    { key: 'type', label: 'Type' },
    { key: 'priority', label: 'Priority', render: (v) => <span className={`badge badge-${v === 'High' ? 'danger' : v === 'Medium' ? 'warning' : 'success'}`}>{v}</span> },
    { key: 'status', label: 'Status', render: (v) => <span className="badge badge-info">{v}</span> },
    { key: 'due_date', label: 'Due Date', render: (v) => v?.split('T')[0] },
    { key: 'ai_suggestions', label: 'AI', render: (v) => v ? <span className="badge badge-primary">🤖 AI</span> : <span className="badge badge-secondary">Manual</span> },
  ]}
  detailFields={[
    { key: 'id', label: 'ID' }, { key: 'customer_name', label: 'Customer' }, { key: 'type', label: 'Type' },
    { key: 'description', label: 'Description' }, { key: 'priority', label: 'Priority' }, { key: 'status', label: 'Status' },
    { key: 'suggested_by', label: 'Suggested By' }, { key: 'effectiveness_score', label: 'Effectiveness Score' },
    { key: 'due_date', label: 'Due Date', render: (v) => v?.split('T')[0] },
    { key: 'ai_response_time_ms', label: 'AI Response Time', render: (v) => v ? `${v}ms` : 'N/A' },
    { key: 'ai_suggestions', label: 'All AI Suggestions', render: (v) => {
      if (!v || v.length === 0) return 'No AI suggestions';
      return (
        <div style={{ marginTop: '8px' }}>
          {v.map((s, i) => (
            <div key={i} style={{ background: '#1a1a2e', border: '1px solid #2d2d4a', borderRadius: '8px', padding: '12px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <strong style={{ color: '#fff' }}>{s.type}</strong>
                <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: s.priority === 'High' ? '#ef4444' : s.priority === 'Medium' ? '#f59e0b' : '#10b981', color: '#fff' }}>{s.priority}</span>
              </div>
              <p style={{ fontSize: '13px', color: '#9ca3af', margin: '4px 0' }}>{s.description}</p>
              {s.effectiveness && <span style={{ fontSize: '12px', color: '#22d3ee' }}>Effectiveness: {s.effectiveness}%</span>}
            </div>
          ))}
        </div>
      );
    }},
  ]}
  FormComponent={InterventionForm}
/>;

const Behavior = () => <GenericList title="Behavior Analytics" apiEndpoint="/behavior"
  columns={[
    { key: 'customer_name', label: 'Customer' },
    { key: 'event_type', label: 'Event Type' },
    { key: 'page_visited', label: 'Page' },
    { key: 'action_taken', label: 'Action' },
    { key: 'timestamp', label: 'Time', render: (v) => new Date(v).toLocaleString() },
  ]}
  detailFields={[
    { key: 'id', label: 'ID' }, { key: 'customer_name', label: 'Customer' }, { key: 'event_type', label: 'Event Type' },
    { key: 'event_data', label: 'Event Data', render: (v) => JSON.stringify(v) },
    { key: 'session_id', label: 'Session ID' }, { key: 'page_visited', label: 'Page Visited' },
    { key: 'action_taken', label: 'Action Taken' },
    { key: 'timestamp', label: 'Timestamp', render: (v) => new Date(v).toLocaleString() },
  ]}
  FormComponent={BehaviorForm}
/>;

const Metrics = () => <GenericList title="Usage Metrics" apiEndpoint="/metrics"
  columns={[
    { key: 'customer_name', label: 'Customer' },
    { key: 'metric_name', label: 'Metric' },
    { key: 'metric_value', label: 'Value', render: (v) => parseFloat(v).toLocaleString() },
    { key: 'trend', label: 'Trend', render: (v) => <span className={`badge badge-${v === 'up' ? 'success' : v === 'down' ? 'danger' : 'info'}`}>{v === 'up' ? '↑' : v === 'down' ? '↓' : '→'} {v}</span> },
  ]}
  detailFields={[
    { key: 'id', label: 'ID' }, { key: 'customer_name', label: 'Customer' }, { key: 'metric_name', label: 'Metric Name' },
    { key: 'metric_value', label: 'Metric Value' },
    { key: 'period_start', label: 'Period Start', render: (v) => v?.split('T')[0] },
    { key: 'period_end', label: 'Period End', render: (v) => v?.split('T')[0] },
    { key: 'trend', label: 'Trend' }, { key: 'comparison_value', label: 'Comparison Value' },
  ]}
  FormComponent={MetricForm}
/>;

const Engagement = () => <GenericList title="Engagement Scores" apiEndpoint="/engagement"
  columns={[
    { key: 'customer_name', label: 'Customer' },
    { key: 'overall_score', label: 'Overall', render: (v) => <span className={`badge badge-${parseFloat(v) > 70 ? 'success' : parseFloat(v) > 40 ? 'warning' : 'danger'}`}>{parseFloat(v).toFixed(0)}</span> },
    { key: 'login_frequency', label: 'Login', render: (v) => `${parseFloat(v || 0).toFixed(0)}` },
    { key: 'feature_adoption', label: 'Features', render: (v) => `${parseFloat(v || 0).toFixed(0)}` },
    { key: 'feedback_score', label: 'Feedback', render: (v) => `${parseFloat(v || 0).toFixed(0)}` },
  ]}
  detailFields={[
    { key: 'id', label: 'ID' }, { key: 'customer_name', label: 'Customer' }, { key: 'overall_score', label: 'Overall Score' },
    { key: 'login_frequency', label: 'Login Frequency' }, { key: 'feature_adoption', label: 'Feature Adoption' },
    { key: 'support_interaction', label: 'Support Interaction' }, { key: 'feedback_score', label: 'Feedback Score' },
  ]}
  FormComponent={EngagementForm}
/>;

const Tickets = () => <GenericList title="Support Tickets" apiEndpoint="/tickets"
  columns={[
    { key: 'customer_name', label: 'Customer' },
    { key: 'subject', label: 'Subject' },
    { key: 'priority', label: 'Priority', render: (v) => <span className={`badge badge-${v === 'High' ? 'danger' : v === 'Medium' ? 'warning' : 'success'}`}>{v}</span> },
    { key: 'status', label: 'Status', render: (v) => <span className="badge badge-info">{v}</span> },
    { key: 'category', label: 'Category' },
  ]}
  detailFields={[
    { key: 'id', label: 'ID' }, { key: 'customer_name', label: 'Customer' }, { key: 'subject', label: 'Subject' },
    { key: 'description', label: 'Description' }, { key: 'priority', label: 'Priority' }, { key: 'status', label: 'Status' },
    { key: 'category', label: 'Category' }, { key: 'assigned_to', label: 'Assigned To' }, { key: 'resolution', label: 'Resolution' },
    { key: 'created_at', label: 'Created', render: (v) => new Date(v).toLocaleString() },
  ]}
  FormComponent={TicketForm}
/>;

const Billing = () => <GenericList title="Billing History" apiEndpoint="/billing"
  columns={[
    { key: 'customer_name', label: 'Customer' },
    { key: 'invoice_number', label: 'Invoice' },
    { key: 'amount', label: 'Amount', render: (v, row) => `${row.currency} ${parseFloat(v).toLocaleString()}` },
    { key: 'status', label: 'Status', render: (v) => <span className={`badge badge-${v === 'paid' ? 'success' : v === 'overdue' ? 'danger' : 'warning'}`}>{v}</span> },
    { key: 'billing_date', label: 'Date', render: (v) => v?.split('T')[0] },
  ]}
  detailFields={[
    { key: 'id', label: 'ID' }, { key: 'customer_name', label: 'Customer' }, { key: 'invoice_number', label: 'Invoice Number' },
    { key: 'amount', label: 'Amount', render: (v, row) => `${row.currency} ${parseFloat(v).toLocaleString()}` },
    { key: 'status', label: 'Status' }, { key: 'payment_method', label: 'Payment Method' },
    { key: 'billing_date', label: 'Billing Date', render: (v) => v?.split('T')[0] },
    { key: 'due_date', label: 'Due Date', render: (v) => v?.split('T')[0] },
    { key: 'paid_at', label: 'Paid At', render: (v) => v ? new Date(v).toLocaleString() : 'Not paid' },
  ]}
  FormComponent={BillingForm}
/>;

const Features = () => <GenericList title="Feature Usage" apiEndpoint="/features"
  columns={[
    { key: 'customer_name', label: 'Customer' },
    { key: 'feature_name', label: 'Feature' },
    { key: 'usage_count', label: 'Usage' },
    { key: 'adoption_rate', label: 'Adoption', render: (v) => <span className={`badge badge-${parseFloat(v) > 70 ? 'success' : parseFloat(v) > 40 ? 'warning' : 'danger'}`}>{parseFloat(v || 0).toFixed(0)}%</span> },
    { key: 'period', label: 'Period' },
  ]}
  detailFields={[
    { key: 'id', label: 'ID' }, { key: 'customer_name', label: 'Customer' }, { key: 'feature_name', label: 'Feature Name' },
    { key: 'usage_count', label: 'Usage Count' }, { key: 'adoption_rate', label: 'Adoption Rate', render: (v) => `${parseFloat(v || 0).toFixed(1)}%` },
    { key: 'time_spent_minutes', label: 'Time Spent', render: (v) => `${v || 0} minutes` },
    { key: 'last_used', label: 'Last Used', render: (v) => v ? new Date(v).toLocaleString() : 'N/A' },
    { key: 'period', label: 'Period' },
  ]}
  FormComponent={FeatureForm}
/>;

const Sessions = () => <GenericList title="User Sessions" apiEndpoint="/sessions"
  columns={[
    { key: 'customer_name', label: 'Customer' },
    { key: 'session_start', label: 'Start', render: (v) => new Date(v).toLocaleString() },
    { key: 'duration_minutes', label: 'Duration', render: (v) => `${v} min` },
    { key: 'pages_viewed', label: 'Pages' },
    { key: 'device_type', label: 'Device' },
  ]}
  detailFields={[
    { key: 'id', label: 'ID' }, { key: 'customer_name', label: 'Customer' },
    { key: 'session_start', label: 'Session Start', render: (v) => new Date(v).toLocaleString() },
    { key: 'session_end', label: 'Session End', render: (v) => v ? new Date(v).toLocaleString() : 'Active' },
    { key: 'duration_minutes', label: 'Duration', render: (v) => `${v} minutes` },
    { key: 'pages_viewed', label: 'Pages Viewed' }, { key: 'actions_taken', label: 'Actions Taken' },
    { key: 'device_type', label: 'Device Type' }, { key: 'browser', label: 'Browser' }, { key: 'ip_address', label: 'IP Address' },
  ]}
  FormComponent={SessionForm}
/>;

const NPS = () => <GenericList title="NPS Scores" apiEndpoint="/nps"
  columns={[
    { key: 'customer_name', label: 'Customer' },
    { key: 'score', label: 'Score', render: (v) => <span className={`badge badge-${parseInt(v) >= 9 ? 'success' : parseInt(v) >= 7 ? 'warning' : 'danger'}`}>{v}</span> },
    { key: 'category', label: 'Category' },
    { key: 'survey_date', label: 'Date', render: (v) => v?.split('T')[0] },
    { key: 'follow_up_required', label: 'Follow-up', render: (v) => v ? 'Yes' : 'No' },
  ]}
  detailFields={[
    { key: 'id', label: 'ID' }, { key: 'customer_name', label: 'Customer' }, { key: 'score', label: 'Score' },
    { key: 'category', label: 'Category' }, { key: 'feedback', label: 'Feedback' },
    { key: 'survey_date', label: 'Survey Date', render: (v) => v?.split('T')[0] },
    { key: 'follow_up_required', label: 'Follow-up Required', render: (v) => v ? 'Yes' : 'No' },
  ]}
  FormComponent={NPSForm}
/>;

const Health = () => <GenericList title="Health Scores" apiEndpoint="/health"
  columns={[
    { key: 'customer_name', label: 'Customer' },
    { key: 'overall_health', label: 'Health', render: (v) => <span className={`badge badge-${parseFloat(v) > 70 ? 'success' : parseFloat(v) > 40 ? 'warning' : 'danger'}`}>{parseFloat(v).toFixed(0)}</span> },
    { key: 'product_usage', label: 'Usage', render: (v) => `${parseFloat(v || 0).toFixed(0)}` },
    { key: 'customer_satisfaction', label: 'Satisfaction', render: (v) => `${parseFloat(v || 0).toFixed(0)}` },
    { key: 'trend', label: 'Trend', render: (v) => <span className={`badge badge-${v === 'up' ? 'success' : v === 'down' ? 'danger' : 'info'}`}>{v === 'up' ? '↑' : v === 'down' ? '↓' : '→'} {v}</span> },
  ]}
  detailFields={[
    { key: 'id', label: 'ID' }, { key: 'customer_name', label: 'Customer' }, { key: 'overall_health', label: 'Overall Health' },
    { key: 'product_usage', label: 'Product Usage' }, { key: 'customer_satisfaction', label: 'Customer Satisfaction' },
    { key: 'growth_potential', label: 'Growth Potential' }, { key: 'support_health', label: 'Support Health' },
    { key: 'financial_health', label: 'Financial Health' }, { key: 'trend', label: 'Trend' },
  ]}
  FormComponent={HealthForm}
/>;

const Alerts = () => <GenericList title="Alerts" apiEndpoint="/alerts"
  columns={[
    { key: 'customer_name', label: 'Customer' },
    { key: 'alert_type', label: 'Type' },
    { key: 'severity', label: 'Severity', render: (v) => <span className={`badge badge-${v === 'critical' || v === 'high' ? 'danger' : v === 'medium' ? 'warning' : 'success'}`}>{v}</span> },
    { key: 'is_resolved', label: 'Status', render: (v) => <span className={`badge badge-${v ? 'success' : 'warning'}`}>{v ? 'Resolved' : 'Open'}</span> },
    { key: 'triggered_at', label: 'Time', render: (v) => new Date(v).toLocaleString() },
  ]}
  detailFields={[
    { key: 'id', label: 'ID' }, { key: 'customer_name', label: 'Customer' }, { key: 'alert_type', label: 'Alert Type' },
    { key: 'severity', label: 'Severity' }, { key: 'message', label: 'Message' },
    { key: 'is_read', label: 'Read', render: (v) => v ? 'Yes' : 'No' },
    { key: 'is_resolved', label: 'Resolved', render: (v) => v ? 'Yes' : 'No' },
    { key: 'triggered_at', label: 'Triggered At', render: (v) => new Date(v).toLocaleString() },
    { key: 'resolved_at', label: 'Resolved At', render: (v) => v ? new Date(v).toLocaleString() : 'Not resolved' },
  ]}
  FormComponent={AlertForm}
/>;

// ============ NEW AI FEATURES PAGE COMPONENTS ============
const Sentiment = () => <GenericList title="AI Sentiment Analysis" apiEndpoint="/sentiment"
  columns={[
    { key: 'customer_name', label: 'Customer' },
    { key: 'feedback_source', label: 'Source' },
    { key: 'sentiment_label', label: 'Sentiment', render: (v) => <span className={`badge badge-${v?.includes('Positive') ? 'success' : v === 'Neutral' ? 'warning' : 'danger'}`}>{v}</span> },
    { key: 'sentiment_score', label: 'Score', render: (v) => `${parseFloat(v || 0).toFixed(0)}%` },
    { key: 'churn_signal_strength', label: 'Churn Signal', render: (v) => <span className={`badge badge-${parseFloat(v) > 60 ? 'danger' : parseFloat(v) > 30 ? 'warning' : 'success'}`}>{parseFloat(v || 0).toFixed(0)}%</span> },
    { key: 'urgency_level', label: 'Urgency', render: (v) => <span className={`badge badge-${v === 'Critical' || v === 'High' ? 'danger' : v === 'Medium' ? 'warning' : 'success'}`}>{v}</span> },
  ]}
  detailFields={[
    { key: 'id', label: 'ID' }, { key: 'customer_name', label: 'Customer' }, { key: 'feedback_source', label: 'Source' },
    { key: 'feedback_text', label: 'Feedback Text' },
    { key: 'sentiment_score', label: 'Sentiment Score', render: (v) => `${parseFloat(v || 0).toFixed(1)}%` },
    { key: 'sentiment_label', label: 'Sentiment Label' },
    { key: 'churn_signal_strength', label: 'Churn Signal', render: (v) => `${parseFloat(v || 0).toFixed(1)}%` },
    { key: 'key_phrases', label: 'Key Phrases', render: (v) => v?.map(k => typeof k === 'string' ? k : (k.phrase || k.text || '')).join(', ') || 'N/A' },
    { key: 'emotions', label: 'Emotions', render: (v) => v ? Object.entries(v).map(([k, val]) => `${k}: ${(val * 100).toFixed(0)}%`).join(', ') : 'N/A' },
    { key: 'urgency_level', label: 'Urgency Level' },
    { key: 'recommended_action', label: 'Recommended Action' },
    { key: 'analyzed_at', label: 'Analyzed At', render: (v) => new Date(v).toLocaleString() },
  ]}
  FormComponent={SentimentForm}
/>;

const Journeys = () => <GenericList title="AI Customer Journey Mapper" apiEndpoint="/journeys"
  columns={[
    { key: 'customer_name', label: 'Customer' },
    { key: 'journey_stage', label: 'Stage', render: (v) => <span className={`badge badge-${v === 'Advocacy' || v === 'Expansion' ? 'success' : v === 'At-Risk' || v === 'Declining' || v === 'Churned' ? 'danger' : 'info'}`}>{v}</span> },
    { key: 'touchpoint_type', label: 'Type' },
    { key: 'touchpoint_name', label: 'Touchpoint' },
    { key: 'sentiment_at_touchpoint', label: 'Sentiment', render: (v) => <span className={`badge badge-${v?.includes('Positive') ? 'success' : v === 'Neutral' ? 'warning' : 'danger'}`}>{v}</span> },
    { key: 'is_churn_indicator', label: 'Churn?', render: (v) => v ? <span className="badge badge-danger">Yes</span> : <span className="badge badge-success">No</span> },
  ]}
  detailFields={[
    { key: 'id', label: 'ID' }, { key: 'customer_name', label: 'Customer' }, { key: 'journey_stage', label: 'Journey Stage' },
    { key: 'touchpoint_type', label: 'Touchpoint Type' }, { key: 'touchpoint_name', label: 'Touchpoint Name' },
    { key: 'touchpoint_date', label: 'Touchpoint Date', render: (v) => new Date(v).toLocaleString() },
    { key: 'sentiment_at_touchpoint', label: 'Sentiment' },
    { key: 'engagement_level', label: 'Engagement Level', render: (v) => `${parseFloat(v || 0).toFixed(0)}%` },
    { key: 'is_churn_indicator', label: 'Churn Indicator', render: (v) => v ? 'Yes' : 'No' },
    { key: 'days_before_churn', label: 'Days Before Churn', render: (v) => v || 'N/A' },
    { key: 'journey_path', label: 'Journey Path', render: (v) => v?.path?.join(' → ') || 'N/A' },
    { key: 'ai_insights', label: 'AI Insights' },
  ]}
  FormComponent={JourneyForm}
/>;

const Winback = () => <GenericList title="AI Win-Back Campaigns" apiEndpoint="/winback"
  columns={[
    { key: 'customer_name', label: 'Customer' },
    { key: 'campaign_name', label: 'Campaign' },
    { key: 'offer_type', label: 'Offer', render: (v) => <span className="badge badge-primary">{v}</span> },
    { key: 'discount_percentage', label: 'Discount', render: (v) => v > 0 ? `${v}%` : '-' },
    { key: 'predicted_success_rate', label: 'Success Rate', render: (v) => <span className={`badge badge-${parseFloat(v) > 50 ? 'success' : parseFloat(v) > 25 ? 'warning' : 'danger'}`}>{parseFloat(v || 0).toFixed(0)}%</span> },
    { key: 'status', label: 'Status', render: (v) => <span className={`badge badge-${v === 'sent' ? 'success' : v === 'draft' ? 'info' : 'warning'}`}>{v}</span> },
  ]}
  detailFields={[
    { key: 'id', label: 'ID' }, { key: 'customer_name', label: 'Customer' }, { key: 'campaign_name', label: 'Campaign Name' },
    { key: 'campaign_type', label: 'Campaign Type' }, { key: 'offer_type', label: 'Offer Type' },
    { key: 'offer_details', label: 'Offer Details' },
    { key: 'discount_percentage', label: 'Discount', render: (v) => `${v || 0}%` },
    { key: 'personalization_score', label: 'Personalization', render: (v) => `${parseFloat(v || 0).toFixed(0)}%` },
    { key: 'predicted_success_rate', label: 'Success Rate', render: (v) => `${parseFloat(v || 0).toFixed(0)}%` },
    { key: 'email_subject', label: 'Email Subject' },
    { key: 'email_body', label: 'Email Body' },
    { key: 'status', label: 'Status' },
    { key: 'conversion_status', label: 'Conversion', render: (v) => v || 'Pending' },
    { key: 'created_at', label: 'Created', render: (v) => new Date(v).toLocaleString() },
  ]}
  FormComponent={WinbackForm}
/>;

const HealthDashboard = () => <GenericList title="AI Customer Health Score" apiEndpoint="/health-dashboard"
  columns={[
    { key: 'customer_name', label: 'Customer' },
    { key: 'health_score', label: 'Health', render: (v) => <span className={`badge badge-${parseFloat(v) > 70 ? 'success' : parseFloat(v) > 40 ? 'warning' : 'danger'}`}>{parseFloat(v).toFixed(0)}</span> },
    { key: 'engagement_index', label: 'Engagement', render: (v) => `${parseFloat(v || 0).toFixed(0)}` },
    { key: 'satisfaction_index', label: 'Satisfaction', render: (v) => `${parseFloat(v || 0).toFixed(0)}` },
    { key: 'trend_direction', label: 'Trend', render: (v) => <span className={`badge badge-${v === 'up' ? 'success' : v === 'down' ? 'danger' : 'info'}`}>{v === 'up' ? '↑' : v === 'down' ? '↓' : '→'} {v}</span> },
    { key: 'last_activity_days', label: 'Last Active', render: (v) => `${v || 0}d ago` },
  ]}
  detailFields={[
    { key: 'id', label: 'ID' }, { key: 'customer_name', label: 'Customer' },
    { key: 'health_score', label: 'Health Score', render: (v) => `${parseFloat(v).toFixed(1)}%` },
    { key: 'engagement_index', label: 'Engagement Index' }, { key: 'satisfaction_index', label: 'Satisfaction Index' },
    { key: 'financial_health', label: 'Financial Health' }, { key: 'product_adoption', label: 'Product Adoption' },
    { key: 'support_sentiment', label: 'Support Sentiment' },
    { key: 'risk_indicators', label: 'Risk Indicators', render: (v) => v?.items?.map(r => typeof r === 'string' ? r : (r.risk_factor || r.description || '')).join(', ') || 'None' },
    { key: 'positive_signals', label: 'Positive Signals', render: (v) => v?.items?.map(p => typeof p === 'string' ? p : (p.positive_factor || p.description || '')).join(', ') || 'None' },
    { key: 'trend_direction', label: 'Trend' }, { key: 'trend_percentage', label: 'Trend %', render: (v) => `${v || 0}%` },
    { key: 'last_activity_days', label: 'Days Since Activity' },
    { key: 'recommended_actions', label: 'Recommended Actions', render: (v) => v?.map(a => typeof a === 'string' ? a : (a.action || a.recommendation || '')).join(', ') || 'N/A' },
    { key: 'ai_summary', label: 'AI Summary' },
  ]}
  FormComponent={HealthDashboardForm}
/>;

const Escalations = () => <GenericList title="AI Escalation Predictor" apiEndpoint="/escalations"
  columns={[
    { key: 'customer_name', label: 'Customer' },
    { key: 'frustration_score', label: 'Frustration', render: (v) => <span className={`badge badge-${parseFloat(v) > 60 ? 'danger' : parseFloat(v) > 30 ? 'warning' : 'success'}`}>{parseFloat(v).toFixed(0)}</span> },
    { key: 'escalation_probability', label: 'Escalation %', render: (v) => <span className={`badge badge-${parseFloat(v) > 60 ? 'danger' : parseFloat(v) > 30 ? 'warning' : 'success'}`}>{parseFloat(v || 0).toFixed(0)}%</span> },
    { key: 'priority_level', label: 'Priority', render: (v) => <span className={`badge badge-${v === 'Critical' || v === 'High' ? 'danger' : v === 'Medium' ? 'warning' : 'success'}`}>{v}</span> },
    { key: 'communication_sentiment', label: 'Sentiment' },
    { key: 'status', label: 'Status', render: (v) => <span className={`badge badge-${v === 'resolved' ? 'success' : v === 'escalated' ? 'danger' : 'info'}`}>{v}</span> },
  ]}
  detailFields={[
    { key: 'id', label: 'ID' }, { key: 'customer_name', label: 'Customer' },
    { key: 'frustration_score', label: 'Frustration Score', render: (v) => `${parseFloat(v).toFixed(1)}` },
    { key: 'escalation_probability', label: 'Escalation Probability', render: (v) => `${parseFloat(v || 0).toFixed(1)}%` },
    { key: 'frustration_indicators', label: 'Frustration Indicators', render: (v) => v?.map(f => typeof f === 'string' ? f : (f.indicator || f.description || '')).join(', ') || 'None' },
    { key: 'recent_issues', label: 'Recent Issues', render: (v) => v?.issues?.map(i => `${i.type} (${i.resolved ? 'Resolved' : 'Open'})`).join(', ') || 'None' },
    { key: 'communication_sentiment', label: 'Communication Sentiment' },
    { key: 'response_urgency', label: 'Response Urgency' },
    { key: 'predicted_escalation_type', label: 'Predicted Escalation Type' },
    { key: 'recommended_preemptive_action', label: 'Preemptive Action' },
    { key: 'agent_talking_points', label: 'Agent Talking Points', render: (v) => v?.map(p => typeof p === 'string' ? p : (p.point || p.text || '')).join(', ') || 'N/A' },
    { key: 'priority_level', label: 'Priority Level' },
    { key: 'status', label: 'Status' },
    { key: 'predicted_at', label: 'Predicted At', render: (v) => new Date(v).toLocaleString() },
  ]}
  FormComponent={EscalationForm}
/>;

// ============ SERVICE LEVELS PAGE ============
const ServiceLevels = () => <GenericList
  title="AI Service Level Predictor"
  icon="⏱️"
  apiEndpoint="/service-levels"
  columns={[
    { key: 'customer_name', label: 'Customer' },
    { key: 'service_tier', label: 'Tier', render: (v) => <span className={`badge badge-${v === 'Enterprise' || v === 'Premium' ? 'success' : v === 'Standard' ? 'info' : 'warning'}`}>{v}</span> },
    { key: 'predicted_response_time', label: 'Response Time', render: (v) => `${v} min` },
    { key: 'predicted_resolution_time', label: 'Resolution Time', render: (v) => `${v} min` },
    { key: 'sla_compliance_probability', label: 'SLA Compliance', render: (v) => <span className={`badge badge-${parseFloat(v) > 80 ? 'success' : parseFloat(v) > 50 ? 'warning' : 'danger'}`}>{parseFloat(v).toFixed(0)}%</span> },
    { key: 'priority_score', label: 'Priority', render: (v) => parseFloat(v).toFixed(1) },
    { key: 'queue_position', label: 'Queue' },
  ]}
  detailFields={[
    { key: 'id', label: 'ID' }, { key: 'customer_name', label: 'Customer' },
    { key: 'service_tier', label: 'Service Tier' },
    { key: 'predicted_response_time', label: 'Predicted Response Time', render: (v) => `${v} minutes` },
    { key: 'predicted_resolution_time', label: 'Predicted Resolution Time', render: (v) => `${v} minutes` },
    { key: 'sla_compliance_probability', label: 'SLA Compliance Probability', render: (v) => `${parseFloat(v).toFixed(1)}%` },
    { key: 'priority_score', label: 'Priority Score', render: (v) => parseFloat(v).toFixed(2) },
    { key: 'queue_position', label: 'Queue Position' },
    { key: 'expected_first_response', label: 'Expected First Response' },
    { key: 'expected_resolution', label: 'Expected Resolution' },
    { key: 'bottleneck_factors', label: 'Bottleneck Factors', render: (v) => v?.join(', ') || 'None' },
    { key: 'optimization_suggestions', label: 'Optimization Suggestions', render: (v) => v?.join('; ') || 'None' },
    { key: 'agent_workload_impact', label: 'Agent Workload Impact' },
    { key: 'customer_patience_index', label: 'Customer Patience Index', render: (v) => parseFloat(v).toFixed(2) },
    { key: 'predicted_at', label: 'Predicted At', render: (v) => new Date(v).toLocaleString() },
  ]}
  FormComponent={ServiceLevelForm}
/>;

// ============ RESPONSE SUGGESTIONS PAGE ============
const ResponseSuggestions = () => <GenericList
  title="AI Response Suggester"
  icon="💡"
  apiEndpoint="/response-suggestions"
  columns={[
    { key: 'customer_name', label: 'Customer' },
    { key: 'ticket_subject', label: 'Subject' },
    { key: 'response_tone', label: 'Tone', render: (v) => <span className={`badge badge-${v === 'Empathetic' || v === 'Supportive' ? 'success' : v === 'Professional' ? 'info' : 'warning'}`}>{v}</span> },
    { key: 'personalization_level', label: 'Personalization', render: (v) => <span className={`badge badge-${parseFloat(v) > 80 ? 'success' : parseFloat(v) > 50 ? 'info' : 'warning'}`}>{parseFloat(v).toFixed(0)}%</span> },
    { key: 'estimated_satisfaction', label: 'Est. Satisfaction', render: (v) => <span className={`badge badge-${parseFloat(v) > 80 ? 'success' : parseFloat(v) > 60 ? 'info' : 'warning'}`}>{parseFloat(v).toFixed(0)}%</span> },
  ]}
  detailFields={[
    { key: 'id', label: 'ID' }, { key: 'customer_name', label: 'Customer' },
    { key: 'ticket_subject', label: 'Ticket Subject' },
    { key: 'ticket_description', label: 'Ticket Description' },
    { key: 'response_tone', label: 'Response Tone' },
    { key: 'personalization_level', label: 'Personalization Level', render: (v) => `${parseFloat(v).toFixed(1)}%` },
    { key: 'estimated_satisfaction', label: 'Estimated Satisfaction', render: (v) => `${parseFloat(v).toFixed(1)}%` },
    { key: 'key_points', label: 'Key Points', render: (v) => v?.join('; ') || 'None' },
    { key: 'empathy_phrases', label: 'Empathy Phrases', render: (v) => v?.join('; ') || 'None' },
    { key: 'solution_steps', label: 'Solution Steps', render: (v) => v?.join('; ') || 'None' },
    { key: 'suggested_response', label: 'Suggested Response' },
    { key: 'knowledge_base_links', label: 'Knowledge Base Links', render: (v) => v?.join(', ') || 'None' },
    { key: 'created_at', label: 'Created At', render: (v) => new Date(v).toLocaleString() },
  ]}
  FormComponent={ResponseSuggestionForm}
/>;

// ============ APP COMPONENT ============
function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (token && storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const login = (token, userData) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  return (
    <ErrorBoundary>
    <AuthContext.Provider value={{ user, login, logout }}>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
            <Route path="/register" element={user ? <Navigate to="/" /> : <Register />} />
            <Route path="/forgot-password" element={user ? <Navigate to="/" /> : <ForgotPassword />} />
            <Route path="/reset-password" element={user ? <Navigate to="/" /> : <ResetPassword />} />
            <Route
              path="/*"
              element={
                user ? (
                  <Layout>
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/profile" element={<UserProfile />} />
                      <Route path="/customers" element={<Customers />} />
                      <Route path="/predictions" element={<Predictions />} />
                      <Route path="/risk-scores" element={<RiskScores />} />
                      <Route path="/segments" element={<Segments />} />
                      <Route path="/interventions" element={<Interventions />} />
                      <Route path="/behavior" element={<Behavior />} />
                      <Route path="/metrics" element={<Metrics />} />
                      <Route path="/engagement" element={<Engagement />} />
                      <Route path="/tickets" element={<Tickets />} />
                      <Route path="/billing" element={<Billing />} />
                      <Route path="/features" element={<Features />} />
                      <Route path="/sessions" element={<Sessions />} />
                      <Route path="/nps" element={<NPS />} />
                      <Route path="/health" element={<Health />} />
                      <Route path="/alerts" element={<Alerts />} />
                      <Route path="/sentiment" element={<Sentiment />} />
                      <Route path="/journeys" element={<Journeys />} />
                      <Route path="/winback" element={<Winback />} />
                      <Route path="/health-dashboard" element={<HealthDashboard />} />
                      <Route path="/escalations" element={<Escalations />} />
                      <Route path="/service-levels" element={<ServiceLevels />} />
                      <Route path="/response-suggestions" element={<ResponseSuggestions />} />
                      <Route path="/ai-reports" element={<AIReports />} />
                      <Route path="/cohort-survival" element={<CohortSurvival />} />
                      <Route path="/intervention-performance" element={<InterventionPerformance />} />
                      <Route path="/churn-triggers" element={<ChurnTriggers />} />
                      <Route path="/winback-orchestration" element={<WinbackOrchestration />} />
                      <Route path="/feature-correlation" element={<FeatureCorrelation />} />
                      <Route path="/competitor-intel" element={<CompetitorIntel />} />
                      <Route path="/forecast-confidence" element={<ForecastConfidence />} />
                      <Route path="/batch-interventions" element={<BatchInterventions />} />
                      <Route path="/custom-views" element={<CustomViewsPage />} />
                    </Routes>
                  </Layout>
                ) : (
                  <Navigate to="/login" />
                )
              }
            />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthContext.Provider>
    </ErrorBoundary>
  );
}

// ============ STYLES ============
const styles = {
  loginContainer: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 100%)',
  },
  loginCard: {
    background: '#1a1a2e',
    border: '1px solid #2d2d4a',
    borderRadius: '16px',
    padding: '48px',
    width: '100%',
    maxWidth: '420px',
  },
  loginHeader: {
    textAlign: 'center',
    marginBottom: '32px',
  },
  loginTitle: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#fff',
    marginBottom: '8px',
  },
  loginSubtitle: {
    color: '#9ca3af',
    fontSize: '14px',
  },
  error: {
    background: 'rgba(239, 68, 68, 0.2)',
    border: '1px solid #ef4444',
    borderRadius: '8px',
    padding: '12px',
    marginBottom: '16px',
    color: '#ef4444',
    fontSize: '14px',
  },
  layout: {
    display: 'flex',
    minHeight: '100vh',
  },
  sidebar: {
    width: '260px',
    background: '#1a1a2e',
    borderRight: '1px solid #2d2d4a',
    display: 'flex',
    flexDirection: 'column',
    position: 'fixed',
    height: '100vh',
    overflowY: 'auto',
  },
  sidebarHeader: {
    padding: '24px',
    borderBottom: '1px solid #2d2d4a',
  },
  logo: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#6366f1',
  },
  nav: {
    flex: 1,
    padding: '16px 0',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 24px',
    color: '#9ca3af',
    textDecoration: 'none',
    fontSize: '14px',
    transition: 'all 0.2s ease',
  },
  sidebarFooter: {
    padding: '16px 24px',
    borderTop: '1px solid #2d2d4a',
  },
  userInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '14px',
  },
  main: {
    flex: 1,
    marginLeft: '260px',
    padding: '32px',
    background: '#0f0f1a',
    minHeight: '100vh',
  },
  formActions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
    marginTop: '24px',
  },
};

export default App;
