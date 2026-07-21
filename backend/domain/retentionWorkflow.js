'use strict';

const STATES = Object.freeze({ ingested: ['featured'], featured: ['scored'], scored: ['reviewed', 'suppressed'], reviewed: ['authorized'], authorized: ['intervened'], intervened: ['measured'], suppressed: [], measured: [] });
const APPROVERS = new Set(['retention_manager', 'data_scientist', 'admin']);
function text(v, f, max = 500) { if (typeof v !== 'string' || !v.trim() || v.trim().length > max) throw new Error(`${f} is required`); return v.trim(); }
function validateCohort(input) {
  if (!input || typeof input !== 'object') throw new Error('cohort run must be an object');
  if (!Array.isArray(input.sources) || !input.sources.length || input.sources.some(s => !s.system || !s.snapshotAt || !s.contractVersion)) throw new Error('versioned source snapshots are required');
  if (!input.featureSet?.version || !input.featureSet?.asOf) throw new Error('featureSet version and asOf are required');
  if (!input.model?.version || !input.model?.calibrationVersion) throw new Error('model and calibration versions are required');
  return { cohortName: text(input.cohortName, 'cohortName', 200), sources: input.sources, featureSet: input.featureSet, model: input.model, consentPolicyVersion: text(input.consentPolicyVersion, 'consentPolicyVersion', 100), suppressionRules: Array.isArray(input.suppressionRules) ? input.suppressionRules : [], experiment: input.experiment || null, metrics: input.metrics || {} };
}
function transition(current, next, role, record, note) {
  if (!STATES[current]?.includes(next)) throw new Error(`transition ${current} -> ${next} is not allowed`);
  if (next === 'scored' && (!Number.isFinite(record.metrics.calibrationError) || !Number.isFinite(record.metrics.driftScore))) throw new Error('calibration and drift metrics are required before scoring');
  if (next === 'authorized' && (!APPROVERS.has(role) || !note || note.trim().length < 10 || !record.experiment?.holdoutPercent)) throw new Error('governed experiment and documented approval are required');
  return next;
}
function shouldSuppress(customer, rules) { return rules.some(r => r.field && customer[r.field] === r.equals); }
module.exports = { STATES, validateCohort, transition, shouldSuppress };
