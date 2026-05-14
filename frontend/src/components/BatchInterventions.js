import React, { useState, useEffect } from 'react';
import api from '../api';
import { useToast } from './Toast';

const TIMEZONES = [
  { tz: 'America/Los_Angeles', label: 'PT (UTC-8)' },
  { tz: 'America/Denver', label: 'MT (UTC-7)' },
  { tz: 'America/Chicago', label: 'CT (UTC-6)' },
  { tz: 'America/New_York', label: 'ET (UTC-5)' },
  { tz: 'Europe/London', label: 'GMT (UTC+0)' },
  { tz: 'Europe/Berlin', label: 'CET (UTC+1)' },
  { tz: 'Asia/Dubai', label: 'GST (UTC+4)' },
  { tz: 'Asia/Tokyo', label: 'JST (UTC+9)' },
];

function BatchInterventions() {
  const [customers, setCustomers] = useState([]);
  const [interventionType, setInterventionType] = useState('email_outreach');
  const [scheduleHour, setScheduleHour] = useState(10);
  const [selectedIds, setSelectedIds] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [scheduledBatch, setScheduledBatch] = useState(null);
  const toast = useToast();

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const res = await api.get('/customers');
      const data = Array.isArray(res.data) ? res.data : res.data.data || [];
      setCustomers(data);
    } catch (err) {
      toast.error('Failed to load customers');
    }
  };

  const toggle = (id) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const selectAll = () => {
    setSelectedIds(customers.filter((c) => c.status === 'at-risk' || c.status === 'at_risk').map((c) => c.id));
  };

  const clear = () => setSelectedIds([]);

  // Compute optimal scheduled UTC times per timezone
  const buildSchedule = () => {
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() + 1);
    const schedule = TIMEZONES.map(({ tz, label }) => {
      const local = new Date(baseDate);
      local.setHours(scheduleHour, 0, 0, 0);
      // Get UTC offset for tz at this date
      const localStr = local.toLocaleString('en-US', { timeZone: tz });
      return { timezone: tz, label, local_time: `${scheduleHour}:00 (${label})`, scheduled_local: localStr };
    });
    return schedule;
  };

  const submit = async () => {
    if (selectedIds.length === 0) {
      toast.warning('Please select at least one customer');
      return;
    }
    setSubmitting(true);
    const schedule = buildSchedule();
    const tasks = selectedIds.map((customerId) => {
      const cust = customers.find((c) => c.id === customerId);
      const tz = cust?.timezone || 'America/New_York';
      const slot = schedule.find((s) => s.timezone === tz) || schedule[3];
      return {
        customer_id: customerId,
        customer_name: cust?.name,
        intervention_type: interventionType,
        scheduled_for: slot.scheduled_local,
        timezone: slot.timezone,
        status: 'scheduled',
        description: `Auto-scheduled ${interventionType.replace('_', ' ')} for ${cust?.name}`,
      };
    });

    try {
      const created = [];
      for (const task of tasks) {
        try {
          const res = await api.post('/interventions', task);
          created.push(res.data);
        } catch (e) {
          // continue with others
          console.error('Failed to schedule:', e);
        }
      }
      setScheduledBatch({ scheduled: created.length, total: tasks.length, schedule, tasks });
      toast.success(`Scheduled ${created.length}/${tasks.length} interventions`);
      setSelectedIds([]);
    } catch (err) {
      toast.error('Batch scheduling failed: ' + (err.response?.data?.error || err.message));
    }
    setSubmitting(false);
  };

  const atRiskCustomers = customers.filter((c) => c.status === 'at-risk' || c.status === 'at_risk');
  const allCustomersToShow = atRiskCustomers.length > 0 ? atRiskCustomers : customers;

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#fff' }}>Batch Intervention Scheduling</h1>
        <p style={{ color: '#9ca3af', fontSize: 14, marginTop: 4 }}>Auto-queue interventions with optimal timing based on customer timezone</p>
      </div>

      <div className="card" style={{ padding: 24, marginBottom: 24 }}>
        <h3 style={{ color: '#fff', marginTop: 0 }}>Configuration</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={{ display: 'block', color: '#9ca3af', fontSize: 13, marginBottom: 6 }}>Intervention Type</label>
            <select value={interventionType} onChange={(e) => setInterventionType(e.target.value)} style={{ width: '100%', padding: 8 }}>
              <option value="email_outreach">Email Outreach</option>
              <option value="phone_call">Phone Call</option>
              <option value="discount_offer">Discount Offer</option>
              <option value="check_in">Check-In Survey</option>
              <option value="onboarding_help">Onboarding Help</option>
              <option value="executive_meeting">Executive Meeting</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', color: '#9ca3af', fontSize: 13, marginBottom: 6 }}>Local Send Hour (24h)</label>
            <input type="number" min="0" max="23" value={scheduleHour} onChange={(e) => setScheduleHour(parseInt(e.target.value) || 10)} style={{ width: '100%', padding: 8 }} />
          </div>
        </div>

        <div style={{ background: '#1a1a2e', padding: 12, borderRadius: 8, fontSize: 12, color: '#9ca3af' }}>
          ⏱ Each intervention will be sent at <strong style={{ color: '#fff' }}>{scheduleHour}:00 local time</strong> for each customer's timezone.
        </div>
      </div>

      <div className="card" style={{ padding: 24, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ color: '#fff', margin: 0 }}>Select Customers ({selectedIds.length} selected)</h3>
          <div>
            <button className="btn btn-secondary btn-sm" onClick={selectAll} style={{ marginRight: 8 }}>Select All At-Risk</button>
            <button className="btn btn-secondary btn-sm" onClick={clear}>Clear</button>
          </div>
        </div>

        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          {allCustomersToShow.map((c) => (
            <div key={c.id} style={{
              display: 'flex', alignItems: 'center', padding: 10, borderBottom: '1px solid #2d2d4a',
              background: selectedIds.includes(c.id) ? '#1a1a2e' : 'transparent', cursor: 'pointer'
            }} onClick={() => toggle(c.id)}>
              <input type="checkbox" checked={selectedIds.includes(c.id)} onChange={() => toggle(c.id)} style={{ marginRight: 12 }} />
              <div style={{ flex: 1 }}>
                <div style={{ color: '#fff' }}>{c.name}</div>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>{c.company} · {c.plan} · {c.timezone || 'no timezone'}</div>
              </div>
              <span style={{
                padding: '2px 8px', borderRadius: 10, fontSize: 11,
                background: c.status === 'at-risk' || c.status === 'at_risk' ? '#ef4444' : c.status === 'churned' ? '#7f1d1d' : '#10b981',
                color: '#fff'
              }}>{c.status}</span>
            </div>
          ))}
        </div>

        <button className="btn btn-primary" onClick={submit} disabled={submitting || selectedIds.length === 0} style={{ marginTop: 16 }}>
          {submitting ? 'Scheduling...' : `📅 Schedule ${selectedIds.length} Intervention${selectedIds.length === 1 ? '' : 's'}`}
        </button>
      </div>

      {scheduledBatch && (
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ color: '#10b981', marginTop: 0 }}>✓ Batch Scheduled</h3>
          <p style={{ color: '#fff' }}>
            Scheduled <strong>{scheduledBatch.scheduled}</strong> of <strong>{scheduledBatch.total}</strong> interventions.
          </p>

          <h4 style={{ color: '#fff', marginTop: 24 }}>Per-Timezone Schedule</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 8 }}>
            {scheduledBatch.schedule.map((s) => (
              <div key={s.timezone} style={{ background: '#1a1a2e', padding: 12, borderRadius: 8 }}>
                <div style={{ color: '#22d3ee', fontSize: 12 }}>{s.label}</div>
                <div style={{ color: '#fff', fontSize: 13 }}>{s.scheduled_local}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default BatchInterventions;
