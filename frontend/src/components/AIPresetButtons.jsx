import React from 'react';

// Example content only. Record references remain the ones selected by the user.
const examples = {
  name: ['Northstar renewal review', 'Harbor onboarding recovery'], company: ['Northstar Labs', 'Harbor Analytics'], email: ['contact@northstarlabs.example', 'team@harboranalytics.example'], plan: ['Professional', 'Enterprise'], monthly_revenue: ['2400', '7800'], signup_date: ['2025-04-15', '2024-11-01'],
  factors: ['Declining weekly usage, unresolved support issue', 'Payment interruption, limited feature adoption'], prediction_score: ['72', '84'], confidence_level: ['86', '91'],
  contributing_factors: ['Usage fell over the last month, delayed ticket response', 'Billing dispute, sponsor changed teams'], recommended_actions: ['Schedule success review, resolve open ticket', 'Offer billing review, arrange product training'], risk_level: ['High', 'Critical'], score: ['72', '8'], category: ['Engagement', 'Detractor'],
  description: ['Usage has declined for four weeks and an open support request needs attention.', 'A recent billing issue and low adoption warrant a follow-up.'], criteria: ['{"status":"at-risk","monthly_revenue_min":1000}', '{"status":"active","engagement_below":50}'], customer_count: ['12', '8'], avg_revenue: ['2400', '7800'], churn_rate: ['18', '24'],
  type: ['Success outreach', 'Product training'], priority: ['High', 'Medium'], status: ['pending', 'in-progress'], due_date: ['2026-10-20', '2026-10-27'], suggested_by: ['Customer success', 'Support team'], effectiveness_score: ['68', '75'],
  event_type: ['feature_view', 'session_end'], page_visited: ['/dashboard', '/billing'], action_taken: ['Viewed retention dashboard', 'Reviewed invoice'], session_id: ['sample-session-alpha', 'sample-session-beta'],
  metric_name: ['Weekly active users', 'Support response time'], metric_value: ['38', '14'], period_start: ['2026-09-01', '2026-09-15'], period_end: ['2026-09-30', '2026-10-01'], trend: ['down', 'up'], comparison_value: ['52', '9'],
  overall_score: ['64', '48'], login_frequency: ['44', '29'], feature_adoption: ['56', '33'], support_interaction: ['3', '7'], feedback_score: ['6', '4'],
  subject: ['Dashboard access issue', 'Billing question after renewal'], assigned_to: ['Customer success queue', 'Billing support queue'], invoice_number: ['INV-SAMPLE-1042', 'INV-SAMPLE-2048'], amount: ['2400', '7800'], currency: ['USD', 'EUR'], payment_method: ['Bank transfer', 'Card'], billing_date: ['2026-10-01', '2026-09-15'], due_date: ['2026-10-31', '2026-10-15'],
  feature_name: ['Retention dashboard', 'Automated alerts'], usage_count: ['18', '5'], adoption_rate: ['52', '21'], time_spent_minutes: ['95', '24'], last_used: ['2026-10-09T14:30', '2026-10-07T09:15'], period: ['monthly', 'weekly'],
  session_start: ['2026-10-09T14:00', '2026-10-07T09:00'], session_end: ['2026-10-09T14:30', '2026-10-07T09:15'], duration_minutes: ['30', '15'], pages_viewed: ['7', '3'], actions_taken: ['Viewed dashboard and exports', 'Reviewed alerts'], device_type: ['Desktop', 'Laptop'], browser: ['Chrome', 'Safari'],
  feedback: ['The dashboard is useful, but reports load slowly.', 'We need clearer billing details and faster support.'], survey_date: ['2026-10-08', '2026-10-06'], follow_up_required: ['true', 'true'],
  overall_health: ['64', '48'], product_usage: ['57', '31'], customer_satisfaction: ['68', '43'], growth_potential: ['71', '52'], support_health: ['60', '37'], financial_health: ['82', '55'],
  alert_type: ['Usage decline', 'Billing risk'], severity: ['high', 'critical'], message: ['Weekly usage dropped after the last release.', 'An overdue payment and support complaint need review.'], is_read: ['false', 'false'], is_resolved: ['false', 'false'],
  feedback_text: ['The new dashboard is helpful, but export times are too long.', 'I am frustrated that the invoice and support case are still unresolved.'], feedback_source: ['Survey', 'Support Ticket'], key_phrases: ['helpful dashboard, slow exports', 'unresolved invoice, delayed support'], sentiment_score: ['35', '12'], sentiment_label: ['Negative', 'Very Negative'], churn_signal_strength: ['62', '89'], urgency_level: ['High', 'Critical'], recommended_action: ['Follow up on performance and share an update.', 'Escalate billing and support issues today.'],
  journey_stage: ['At-Risk', 'Declining'], touchpoint_type: ['Product', 'Support'], touchpoint_name: ['Dashboard export', 'Billing support call'], sentiment_at_touchpoint: ['Negative', 'Very Negative'], engagement_level: ['35', '18'], is_churn_indicator: ['true', 'true'], days_before_churn: ['30', '14'],
  campaign_type: ['Personalized', 'Re-engagement'], campaign_name: ['October success check-in', 'Renewal recovery outreach'], offer_type: ['Training', 'Concierge Service'], offer_details: ['One-on-one dashboard workshop', 'Dedicated billing and support review'], discount_percentage: ['0', '10'], predicted_success_rate: ['64', '57'], email_subject: ['Let us help you get more from your dashboard', 'A plan to resolve your renewal concerns'], email_body: ['We noticed dashboard usage has changed. Could we schedule a short workshop?', 'We would like to review your billing and support concerns together.'],
  health_score: ['64', '48'], engagement_index: ['58', '35'], satisfaction_index: ['68', '43'], product_adoption: ['56', '33'], support_sentiment: ['Neutral', 'Negative'], trend_direction: ['down', 'down'], trend_percentage: ['-12', '-24'],
  frustration_indicators: ['Slow exports, repeated follow-ups', 'Unresolved invoice, repeated support contacts'], agent_talking_points: ['Acknowledge the delay\nOffer a timeline', 'Confirm invoice details\nExplain next steps'], frustration_score: ['68', '88'], escalation_probability: ['67', '86'], communication_sentiment: ['Frustrated', 'Very Frustrated'], response_urgency: ['High', 'Immediate'], predicted_escalation_type: ['Manager request', 'Executive complaint'], recommended_preemptive_action: ['Arrange a same-day success call.', 'Connect billing and support leads today.'], priority_level: ['High', 'Critical'],
  bottleneck_factors: ['Queue volume, specialist availability', 'Billing handoff, repeated ticket transfers'], optimization_suggestions: ['Route to dashboard specialist, send status update', 'Assign one owner, coordinate billing and support'], predicted_response_time: ['4', '8'], predicted_resolution_time: ['24', '48'], sla_compliance_probability: ['82', '61'], service_tier: ['Priority', 'Premium'], priority_score: ['72', '88'], queue_position: ['3', '2'], agent_workload_impact: ['Medium', 'High'], customer_patience_index: ['45', '28'],
  ticket_subject: ['Export takes too long', 'Invoice still shows an incorrect amount'], ticket_description: ['Exports time out when our team selects a full month of data.', 'The latest renewal invoice appears to include a charge we do not recognize.'], key_points: ['Confirm export size, provide a workaround', 'Review line items, confirm the corrected amount'], empathy_phrases: ['I understand this delay disrupts your work.', 'I understand why an unexpected charge is concerning.'], solution_steps: ['Check export logs\nOffer smaller date ranges\nFollow up with engineering', 'Review invoice\nCoordinate correction\nSend written confirmation'], knowledge_base_links: ['https://docs.example.com/exports', 'https://docs.example.com/billing'], suggested_response: ['Thanks for reporting the export delay. I will investigate and update you today.', 'Thanks for flagging the invoice. I will review the charge and follow up today.'], response_tone: ['Empathetic', 'Professional'], personalization_level: ['85', '72'], estimated_satisfaction: ['78', '72']
};

const byForm = {
  CustomerForm: { name: ['Morgan Ellis', 'Casey Patel'], status: ['at-risk', 'active'] },
  PredictionForm: { status: ['high-risk', 'medium-risk'] },
  InterventionForm: { status: ['pending', 'in-progress'] },
  TicketForm: { status: ['open', 'in-progress'], category: ['Technical', 'Billing'] },
  BillingForm: { status: ['pending', 'overdue'] },
  NPSForm: { score: ['7', '3'], category: ['Passive', 'Detractor'] },
  RiskScoreForm: { score: ['72', '84'] },
  SentimentForm: { ai_insights: ['Acknowledge the export delay and provide a follow-up date.', 'Coordinate a billing review and a support update.'] },
  JourneyForm: { ai_insights: ['Usage fell after a slow export experience.', 'The unresolved invoice coincided with lower engagement.'] },
  HealthDashboardForm: { ai_summary: ['Engagement is declining, but the account remains recoverable.', 'Billing and support issues are affecting account health.'] },
  WinbackForm: { status: ['draft', 'scheduled'] },
  EscalationForm: { status: ['monitoring', 'active'] }
};

export function presetValues(form, scenario, formName) {
  const next = { ...form };
  for (const key of Object.keys(form)) {
    if (key === 'customer_id' || key.endsWith('_id') && key !== 'session_id' || ['ai_response', 'ai_response_time_ms', 'ai_suggestions', 'ai_analysis'].includes(key) || key === 'id') continue;
    const choices = byForm[formName]?.[key] || examples[key];
    if (!choices) continue;
    next[key] = choices[scenario];
  }
  return next;
}

export default function AIPresetButtons({ form, setForm, formName }) {
  const apply = (scenario) => setForm((previous) => presetValues(previous, scenario, formName));
  return <div className="ai-preset-bar"><div><strong>Sample inputs</strong><p>Fill the form, then review it before saving or generating. {Object.prototype.hasOwnProperty.call(form, 'customer_id') && !form.customer_id ? 'Select a real customer to continue.' : ''}</p></div><div style={{ display: 'flex', gap: 8 }}><button type="button" className="btn btn-secondary" onClick={() => apply(0)}>Usage decline</button><button type="button" className="btn btn-secondary" onClick={() => apply(1)}>Support and billing risk</button></div></div>;
}
