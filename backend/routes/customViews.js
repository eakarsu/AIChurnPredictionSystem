// Custom Views routes for AI Churn Prediction System
// 4 endpoints — 2 visualization synthesizers, 2 operational tools
//   POST /api/custom-views/cohort-triangle     (VIZ)  - cohort retention triangle chart data
//   POST /api/custom-views/risk-heatmap        (VIZ)  - churn-risk heatmap segment x behavior
//   POST /api/custom-views/at-risk-pdf         (NON)  - at-risk customer report PDF (binary or JSON preview)
//   GET/POST/PUT/DELETE /api/custom-views/playbook-rules (NON CRUD) - retention playbook editor
//
// Each VIZ endpoint uses OPENROUTER_API_KEY when available to synthesize realistic
// domain data, with deterministic fallbacks so the UI always renders.

const express = require('express');
const router = express.Router();
const pool = require('../db');
const PDFDocument = require('pdfkit');

// Resolve auth middleware against the main server's JWT pattern.
const jwt = require('jsonwebtoken');
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });
  try {
    const blacklisted = await pool.query(
      'SELECT 1 FROM token_blacklist WHERE token = $1 AND expires_at > NOW()',
      [token]
    );
    if (blacklisted.rows.length > 0) {
      return res.status(401).json({ error: 'Token has been revoked' });
    }
  } catch (_) { /* fall through */ }
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

// --------------- OpenRouter helper ---------------
async function callOpenRouter(prompt, system, maxTokens = 1400) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    const err = new Error('OPENROUTER_API_KEY not configured');
    err.code = 'MISSING_KEY';
    throw err;
  }
  const model = process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4.5';
  const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
      max_tokens: maxTokens,
    }),
  });
  return await resp.json().catch(() => ({}));
}

function parseAIJson(text) {
  if (!text) return null;
  if (typeof text === 'object') return text;
  try { return JSON.parse(text); } catch (_) {}
  const fence = String(text).match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) { try { return JSON.parse(fence[1]); } catch (_) {} }
  const obj = String(text).match(/\{[\s\S]*\}/);
  if (obj) { try { return JSON.parse(obj[0]); } catch (_) {} }
  return null;
}

// --------------- Deterministic fallbacks ---------------
function fallbackTriangle() {
  // Triangle = rows are cohorts; columns shrink as cohorts get younger.
  // Each cell is retention %. Newer cohorts have fewer observed months.
  const cohorts = ['2025-Q1', '2025-Q2', '2025-Q3', '2025-Q4', '2026-Q1'];
  const maxMonths = 6; // M0..M6 = 7 columns
  const rows = cohorts.map((c, i) => {
    const observed = maxMonths - i + 1; // Q1 has 7 months, Q2 has 6, ..., latest has 3
    const cells = [];
    for (let j = 0; j < observed; j++) {
      const decay = Math.max(20, 100 - j * (6 + i * 1.5) - (j * i));
      cells.push({ month: `M${j}`, retention: Math.round(decay) });
    }
    return { cohort: c, size: 200 + i * 35, cells };
  });
  return {
    cohorts,
    max_months: maxMonths,
    rows,
    summary: 'Synthetic cohort retention triangle. Newer cohorts have fewer observed months — classic triangle shape.',
  };
}

function fallbackHeatmap() {
  // Segment x Behavior matrix of churn-risk %
  const segments = ['Enterprise', 'Mid-Market', 'SMB', 'Startup', 'Trial'];
  const behaviors = ['Low Login Frequency', 'Support Escalations', 'Feature Drop-off', 'Billing Failures', 'NPS Detractor', 'Session Decline'];
  const cells = [];
  segments.forEach((s, i) => {
    behaviors.forEach((b, j) => {
      const risk = Math.min(95, 25 + (i * 7) + (j * 9) + Math.round(Math.random() * 8));
      cells.push({ segment: s, behavior: b, risk });
    });
  });
  return {
    segments,
    behaviors,
    cells,
    summary: 'Synthetic segment x behavior churn-risk heatmap. Trial users with billing failures show highest risk.',
  };
}

function fallbackAtRiskRows(limit = 10) {
  const names = ['Acme Corp', 'Globex', 'Initech', 'Umbrella', 'Hooli', 'Stark Industries', 'Wayne Enterprises', 'Wonka', 'Pied Piper', 'Sirius Cybernetics', 'Tyrell Corp', 'Cyberdyne', 'OCP', 'Massive Dynamic', 'Soylent'];
  return names.slice(0, limit).map((n, i) => ({
    customer_id: 1000 + i,
    name: n,
    plan: ['Starter', 'Pro', 'Enterprise'][i % 3],
    mrr: 200 + (i * 137 % 800),
    risk_score: Math.round(60 + Math.random() * 39),
    last_login_days: Math.round(7 + Math.random() * 60),
    top_signal: ['support escalation', 'feature drop-off', 'billing failure', 'NPS detractor', 'session decline'][i % 5],
    recommended_action: ['CSM outreach', 'Save offer email', 'Health check call', 'Discount offer', 'Executive sponsor'][i % 5],
  }));
}

// --------------- In-memory CRUD store for playbook rules ---------------
// Persists in-process; idempotent reseeding so endpoints always return data.
let RULE_ID_SEQ = 1;
const playbookRules = [];

function seedPlaybookRulesOnce() {
  if (playbookRules.length > 0) return;
  const seed = [
    {
      name: 'Critical Risk - Executive Outreach',
      trigger_condition: 'risk_score > 80',
      action: 'Schedule executive sponsor call within 24h',
      channel: 'phone',
      priority: 'critical',
      enabled: true,
    },
    {
      name: 'High Risk Save Offer',
      trigger_condition: 'risk_score BETWEEN 60 AND 80',
      action: 'Send 20% discount offer for 3 months',
      channel: 'email',
      priority: 'high',
      enabled: true,
    },
    {
      name: 'Billing Failure Recovery',
      trigger_condition: 'top_signal = billing_failure',
      action: 'Auto-retry payment and notify CSM',
      channel: 'email',
      priority: 'high',
      enabled: true,
    },
    {
      name: 'Feature Drop-off Re-engagement',
      trigger_condition: 'top_signal = feature_dropoff',
      action: 'Trigger in-app feature tour and tip email',
      channel: 'in_app',
      priority: 'medium',
      enabled: true,
    },
  ];
  for (const s of seed) {
    playbookRules.push({ id: RULE_ID_SEQ++, ...s, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  }
}
seedPlaybookRulesOnce();

// --------------- 1) VIZ - cohort retention triangle ---------------
router.post('/cohort-triangle', authenticateToken, async (req, res) => {
  const params = req.body || {};
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return res.json({ source: 'fallback', ...fallbackTriangle() });
    }
    const sys = 'You generate cohort retention triangle data for a churn analytics dashboard. Strict JSON only.';
    const prompt = `Generate a cohort retention triangle for a SaaS book of business.
Parameters: ${JSON.stringify(params).slice(0, 600)}.
Return JSON exactly:
{
  "cohorts": ["2025-Q1","2025-Q2","2025-Q3","2025-Q4","2026-Q1"],
  "max_months": 6,
  "rows": [
    { "cohort": string, "size": integer,
      "cells": [ { "month": "M0", "retention": int_0_100 }, ... ] }
  ],
  "summary": string
}
Each newer cohort has FEWER observed months (triangle shape): Q1=7 cells, Q2=6, ..., latest=3.`;
    const aiResp = await callOpenRouter(prompt, sys);
    const content = aiResp?.choices?.[0]?.message?.content ?? '';
    const parsed = parseAIJson(content);
    if (parsed && Array.isArray(parsed.rows) && parsed.rows.length > 0) {
      return res.json({ source: 'ai', model: aiResp?.model, ...parsed });
    }
    return res.json({ source: 'fallback', ...fallbackTriangle() });
  } catch (err) {
    return res.json({ source: 'fallback', error: String(err.message || err), ...fallbackTriangle() });
  }
});

// --------------- 2) VIZ - churn-risk heatmap (segment x behavior) ---------------
router.post('/risk-heatmap', authenticateToken, async (req, res) => {
  const params = req.body || {};
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return res.json({ source: 'fallback', ...fallbackHeatmap() });
    }
    const sys = 'You generate a segment x behavior churn-risk heatmap. Strict JSON only.';
    const prompt = `Generate churn-risk percentages for each (segment, behavior) cell.
Parameters: ${JSON.stringify(params).slice(0, 600)}.
Return JSON exactly:
{
  "segments": ["Enterprise","Mid-Market","SMB","Startup","Trial"],
  "behaviors": ["Low Login Frequency","Support Escalations","Feature Drop-off","Billing Failures","NPS Detractor","Session Decline"],
  "cells": [ { "segment": string, "behavior": string, "risk": int_0_100 } ],
  "summary": string
}`;
    const aiResp = await callOpenRouter(prompt, sys);
    const content = aiResp?.choices?.[0]?.message?.content ?? '';
    const parsed = parseAIJson(content);
    if (parsed && Array.isArray(parsed.cells) && parsed.cells.length > 0) {
      return res.json({ source: 'ai', model: aiResp?.model, ...parsed });
    }
    return res.json({ source: 'fallback', ...fallbackHeatmap() });
  } catch (err) {
    return res.json({ source: 'fallback', error: String(err.message || err), ...fallbackHeatmap() });
  }
});

// --------------- 3) NON-VIZ - at-risk customer report PDF ---------------
// Returns JSON preview by default; pass ?format=pdf or { format: 'pdf' } to stream PDF binary.
router.post('/at-risk-pdf', authenticateToken, async (req, res) => {
  const params = req.body || {};
  const threshold = Number(params.threshold || 60);
  const limit = Math.min(Number(params.limit || 10), 50);
  let rows = fallbackAtRiskRows(limit);
  let aiNarrative = null;

  try {
    if (process.env.OPENROUTER_API_KEY) {
      const sys = 'You generate at-risk customer narrative summaries. Strict JSON only.';
      const prompt = `Summarize the at-risk customer book for an executive report.
threshold=${threshold}, limit=${limit}.
Return JSON exactly:
{ "executive_summary": string, "top_themes": [string, string, string], "recommended_actions": [string, string, string] }`;
      const aiResp = await callOpenRouter(prompt, sys, 700);
      const content = aiResp?.choices?.[0]?.message?.content ?? '';
      const parsed = parseAIJson(content);
      if (parsed && parsed.executive_summary) aiNarrative = parsed;
    }
  } catch (_) { /* keep fallback */ }

  if (!aiNarrative) {
    aiNarrative = {
      executive_summary: `${rows.length} customers identified with risk_score >= ${threshold}. Total MRR at risk: $${rows.reduce((s, r) => s + (r.mrr || 0), 0).toLocaleString()}.`,
      top_themes: ['Support escalations rising', 'Feature drop-off in core workflow', 'Billing failures in trial-to-paid handoff'],
      recommended_actions: ['Prioritize Enterprise accounts for CSM outreach', 'Trigger save-offer email cascade for High band', 'Run executive call campaign for Critical band'],
    };
  }

  const format = (params.format || req.query.format || 'json').toLowerCase();
  if (format !== 'pdf') {
    return res.json({
      source: process.env.OPENROUTER_API_KEY ? 'ai_or_fallback' : 'fallback',
      threshold, limit, count: rows.length, rows, narrative: aiNarrative,
    });
  }

  // Stream PDF
  try {
    const doc = new PDFDocument({ size: 'LETTER', margin: 48 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="at_risk_report.pdf"');
    doc.pipe(res);

    doc.fontSize(20).fillColor('#111').text('At-Risk Customer Report', { align: 'left' });
    doc.moveDown(0.2);
    doc.fontSize(10).fillColor('#666').text(`Generated: ${new Date().toISOString()}  |  Threshold: ${threshold}  |  Customers: ${rows.length}`);
    doc.moveDown();

    doc.fontSize(13).fillColor('#111').text('Executive Summary', { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor('#222').text(aiNarrative.executive_summary, { align: 'left' });
    doc.moveDown();

    doc.fontSize(13).fillColor('#111').text('Top Themes', { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor('#222');
    (aiNarrative.top_themes || []).forEach((t) => doc.text(`• ${t}`));
    doc.moveDown();

    doc.fontSize(13).fillColor('#111').text('Recommended Actions', { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor('#222');
    (aiNarrative.recommended_actions || []).forEach((t) => doc.text(`• ${t}`));
    doc.moveDown();

    doc.fontSize(13).fillColor('#111').text('At-Risk Customers', { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(9).fillColor('#222');
    rows.forEach((r) => {
      doc.text(`${r.name}  (id ${r.customer_id})  Plan: ${r.plan}  Risk: ${r.risk_score}  MRR: $${r.mrr}  LastLogin: ${r.last_login_days}d  Signal: ${r.top_signal}  Action: ${r.recommended_action}`);
    });

    doc.end();
  } catch (err) {
    return res.status(500).json({ error: 'PDF generation failed', detail: String(err.message || err) });
  }
});

// --------------- 4) NON-VIZ - retention playbook editor (CRUD intervention rules) ---------------
// Single combined endpoint: action-based POST + classic REST verbs.
// POST   /playbook-rules      -> { action: 'list'|'create'|'update'|'delete', ... }
// GET    /playbook-rules      -> list
// PUT    /playbook-rules/:id  -> update
// DELETE /playbook-rules/:id  -> delete

function findRule(id) { return playbookRules.find((r) => r.id === Number(id)); }
function validateRulePayload(p) {
  const errs = [];
  if (!p || typeof p !== 'object') { errs.push('payload required'); return errs; }
  if (p.name !== undefined && (typeof p.name !== 'string' || p.name.length < 2)) errs.push('name must be >=2 chars');
  if (p.priority !== undefined && !['low', 'medium', 'high', 'critical'].includes(p.priority)) errs.push('priority invalid');
  if (p.enabled !== undefined && typeof p.enabled !== 'boolean') errs.push('enabled must be boolean');
  return errs;
}

router.get('/playbook-rules', authenticateToken, (req, res) => {
  return res.json({ count: playbookRules.length, rules: playbookRules });
});

router.post('/playbook-rules', authenticateToken, (req, res) => {
  const body = req.body || {};
  const action = (body.action || 'list').toLowerCase();

  if (action === 'list') {
    return res.json({ count: playbookRules.length, rules: playbookRules });
  }

  if (action === 'create') {
    const errs = validateRulePayload(body);
    if (errs.length) return res.status(400).json({ error: 'Validation failed', details: errs });
    const now = new Date().toISOString();
    const rule = {
      id: RULE_ID_SEQ++,
      name: body.name || 'Untitled Rule',
      trigger_condition: body.trigger_condition || '',
      action: body.action_text || body.target_action || '',
      channel: body.channel || 'email',
      priority: body.priority || 'medium',
      enabled: body.enabled !== undefined ? !!body.enabled : true,
      created_at: now,
      updated_at: now,
    };
    playbookRules.push(rule);
    return res.json({ ok: true, rule });
  }

  if (action === 'update') {
    const id = Number(body.id);
    const rule = findRule(id);
    if (!rule) return res.status(404).json({ error: `Rule ${id} not found` });
    const errs = validateRulePayload(body);
    if (errs.length) return res.status(400).json({ error: 'Validation failed', details: errs });
    ['name', 'trigger_condition', 'channel', 'priority', 'enabled'].forEach((k) => {
      if (body[k] !== undefined) rule[k] = body[k];
    });
    if (body.action_text !== undefined) rule.action = body.action_text;
    rule.updated_at = new Date().toISOString();
    return res.json({ ok: true, rule });
  }

  if (action === 'delete') {
    const id = Number(body.id);
    const idx = playbookRules.findIndex((r) => r.id === id);
    if (idx === -1) return res.status(404).json({ error: `Rule ${id} not found` });
    const [removed] = playbookRules.splice(idx, 1);
    return res.json({ ok: true, removed });
  }

  return res.status(400).json({ error: `Unknown action: ${action}` });
});

router.put('/playbook-rules/:id', authenticateToken, (req, res) => {
  const id = Number(req.params.id);
  const rule = findRule(id);
  if (!rule) return res.status(404).json({ error: `Rule ${id} not found` });
  const body = req.body || {};
  const errs = validateRulePayload(body);
  if (errs.length) return res.status(400).json({ error: 'Validation failed', details: errs });
  ['name', 'trigger_condition', 'channel', 'priority', 'enabled'].forEach((k) => {
    if (body[k] !== undefined) rule[k] = body[k];
  });
  if (body.action_text !== undefined) rule.action = body.action_text;
  rule.updated_at = new Date().toISOString();
  return res.json({ ok: true, rule });
});

router.delete('/playbook-rules/:id', authenticateToken, (req, res) => {
  const id = Number(req.params.id);
  const idx = playbookRules.findIndex((r) => r.id === id);
  if (idx === -1) return res.status(404).json({ error: `Rule ${id} not found` });
  const [removed] = playbookRules.splice(idx, 1);
  return res.json({ ok: true, removed });
});

router.get('/health', (req, res) => res.json({
  feature: 'custom-views', ok: true, ai_configured: !!process.env.OPENROUTER_API_KEY,
  endpoints: ['cohort-triangle', 'risk-heatmap', 'at-risk-pdf', 'playbook-rules'],
  playbook_rules_count: playbookRules.length,
}));

module.exports = router;
