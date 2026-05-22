import React, { useEffect, useState } from 'react';
import api from '../api';

// NON-VIZ 2: Retention Playbook Editor (CRUD intervention rules)
const EMPTY = {
  id: null,
  name: '',
  trigger_condition: '',
  action_text: '',
  channel: 'email',
  priority: 'medium',
  enabled: true,
};

const PRIORITIES = ['low', 'medium', 'high', 'critical'];
const CHANNELS = ['email', 'in_app', 'phone', 'sms', 'slack'];

export default function SaveOfferWizard() {
  const [rules, setRules] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const load = async () => {
    setLoading(true); setErr('');
    try {
      const r = await api.get('/custom-views/playbook-rules');
      setRules(r.data?.rules || []);
    } catch (e) {
      setErr(e?.response?.data?.error || e.message || 'Failed to load');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e?.preventDefault();
    setErr(''); setMsg('');
    const payload = {
      action: editingId ? 'update' : 'create',
      id: editingId || undefined,
      name: form.name,
      trigger_condition: form.trigger_condition,
      action_text: form.action_text,
      channel: form.channel,
      priority: form.priority,
      enabled: form.enabled,
    };
    try {
      const r = await api.post('/custom-views/playbook-rules', payload);
      setMsg(editingId ? `Updated rule #${r.data?.rule?.id}` : `Created rule #${r.data?.rule?.id}`);
      setForm(EMPTY);
      setEditingId(null);
      await load();
    } catch (e) {
      setErr(e?.response?.data?.error || e.message || 'Save failed');
    }
  };

  const startEdit = (rule) => {
    setEditingId(rule.id);
    setForm({
      id: rule.id,
      name: rule.name,
      trigger_condition: rule.trigger_condition,
      action_text: rule.action,
      channel: rule.channel,
      priority: rule.priority,
      enabled: !!rule.enabled,
    });
    setMsg(''); setErr('');
  };

  const cancelEdit = () => { setEditingId(null); setForm(EMPTY); };

  const removeRule = async (id) => {
    setErr(''); setMsg('');
    try {
      await api.post('/custom-views/playbook-rules', { action: 'delete', id });
      setMsg(`Deleted rule #${id}`);
      await load();
    } catch (e) {
      setErr(e?.response?.data?.error || e.message || 'Delete failed');
    }
  };

  const inputStyle = {
    background: '#0f0f1a', color: '#fff', border: '1px solid #2d2d4a',
    padding: '6px 10px', borderRadius: 4, width: '100%',
  };
  const labelStyle = { color: '#9ca3af', fontSize: 12, display: 'block', marginBottom: 4 };

  return (
    <div data-testid="playbook-editor" style={{
      background: '#1a1a2e', border: '1px solid #2d2d4a',
      borderRadius: 12, padding: 24, marginBottom: 24,
    }}>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ color: '#fff', margin: 0 }}>Retention Playbook Editor</h3>
        <p style={{ color: '#9ca3af', fontSize: 13, marginTop: 4 }}>
          Create, update, and delete retention intervention rules that drive your save-offer playbook.
        </p>
      </div>

      <form onSubmit={submit} style={{
        background: '#0f0f1a', padding: 16, borderRadius: 8,
        display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16,
      }}>
        <div>
          <label style={labelStyle}>Rule Name</label>
          <input style={inputStyle} value={form.name} required
            onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label style={labelStyle}>Trigger Condition</label>
          <input style={inputStyle} value={form.trigger_condition}
            placeholder="e.g. risk_score > 80"
            onChange={(e) => setForm({ ...form, trigger_condition: e.target.value })} />
        </div>
        <div style={{ gridColumn: '1 / span 2' }}>
          <label style={labelStyle}>Action</label>
          <input style={inputStyle} value={form.action_text}
            placeholder="e.g. Send 20% discount offer for 3 months"
            onChange={(e) => setForm({ ...form, action_text: e.target.value })} />
        </div>
        <div>
          <label style={labelStyle}>Channel</label>
          <select style={inputStyle} value={form.channel}
            onChange={(e) => setForm({ ...form, channel: e.target.value })}>
            {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Priority</label>
          <select style={inputStyle} value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value })}>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" id="enabled" checked={form.enabled}
            onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
          <label htmlFor="enabled" style={{ color: '#d1d5db', fontSize: 13 }}>Enabled</label>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, justifyContent: 'flex-end' }}>
          {editingId && (
            <button type="button" onClick={cancelEdit}
              style={{ background: '#2d2d4a', color: '#fff', border: 'none',
                       padding: '8px 14px', borderRadius: 6, cursor: 'pointer' }}>
              Cancel
            </button>
          )}
          <button type="submit" data-testid="save-rule-btn"
            style={{ background: '#6366f1', color: '#fff', border: 'none',
                     padding: '8px 14px', borderRadius: 6, cursor: 'pointer' }}>
            {editingId ? 'Update Rule' : 'Create Rule'}
          </button>
        </div>
      </form>

      {err && <div style={{ color: '#ef4444', marginBottom: 12 }}>{err}</div>}
      {msg && <div style={{ color: '#10b981', marginBottom: 12 }}>{msg}</div>}

      <div style={{ color: '#9ca3af', fontSize: 13, marginBottom: 8 }}>
        {loading ? 'Loading...' : `${rules.length} rule${rules.length === 1 ? '' : 's'}`}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', color: '#d1d5db', fontSize: 13 }}>
          <thead>
            <tr style={{ color: '#9ca3af', textAlign: 'left' }}>
              <th style={{ padding: 8 }}>ID</th>
              <th style={{ padding: 8 }}>Name</th>
              <th style={{ padding: 8 }}>Trigger</th>
              <th style={{ padding: 8 }}>Action</th>
              <th style={{ padding: 8 }}>Channel</th>
              <th style={{ padding: 8 }}>Priority</th>
              <th style={{ padding: 8 }}>Enabled</th>
              <th style={{ padding: 8 }}></th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id} style={{ borderTop: '1px solid #2d2d4a' }}>
                <td style={{ padding: 8 }}>{r.id}</td>
                <td style={{ padding: 8 }}>{r.name}</td>
                <td style={{ padding: 8, fontFamily: 'monospace', fontSize: 12 }}>{r.trigger_condition}</td>
                <td style={{ padding: 8 }}>{r.action}</td>
                <td style={{ padding: 8 }}>{r.channel}</td>
                <td style={{ padding: 8 }}>{r.priority}</td>
                <td style={{ padding: 8 }}>{r.enabled ? 'Yes' : 'No'}</td>
                <td style={{ padding: 8, display: 'flex', gap: 6 }}>
                  <button onClick={() => startEdit(r)}
                    style={{ background: '#2d2d4a', color: '#fff', border: 'none',
                             padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>
                    Edit
                  </button>
                  <button onClick={() => removeRule(r.id)}
                    style={{ background: '#7f1d1d', color: '#fff', border: 'none',
                             padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
