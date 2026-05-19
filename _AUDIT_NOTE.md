# Audit Note — AIChurnPredictionSystem

Source: `_AUDIT/reports/batch_01.md` (Project 22)

## Maturity: SKELETON (0 routes, 0 AI endpoints in audit)

The project has only `backend/server.js`, `db.js`, `seed.js` — no routes folder. The audit identifies it as a skeleton with no domain routes or AI endpoints, although `server.js` does have substantial code (~1000+ lines, monolithic).

## Original audit recommendations

### Strategic Feature Suggestions
1. Agentic Workflow Orchestration
2. RAG over Domain Documents
3. Real-time Anomaly Detection
4. White-label/Reseller Platform

## Categorization
- **MECHANICAL:** None — there is no canonical route folder/pattern; modifying the monolithic `server.js` to add new endpoints risks breakage without familiarity.
- **NEEDS-PRODUCT-DECISION:** All four strategic suggestions plus the underlying churn-model itself (which model? which features? which DB tables for behavior events?).

## Implementations applied
- None this round. The project lacks the conventional `routes/` modular layout and a clear AI integration pattern, so a safe mechanical addition would still require analyzing the monolithic server first.

## Backlog (prioritized)

### High priority
- **Refactor `server.js` into `routes/` modules** before further additions.
- **Add `/api/predict-churn` AI endpoint** consuming customer behavior features and emitting risk scores + drivers.
- **Add behavior-event ingestion** (`POST /api/events`) to feed the churn model.

### Medium priority
- **Real-time anomaly stream** (SSE) over event ingestion.
- **Cohort analysis report** endpoints.

### Low priority
- White-label / multi-tenant capability.
- Agentic retention-playbook automation.

## Apply pass 3 (frontend)

LEFT-AS-IS — frontend already wires all backend AI endpoints (JWT Bearer from localStorage, existing styling, backend error surfaced verbatim including 503-no-key). No FE changes required by idempotence rule. See `_AUDIT/apply3_logs/ab3_57.md` for endpoint inventory.

## Apply pass 4 (mechanical backlog)

SKIPPED — categorization explicitly states "MECHANICAL: None". The remaining backlog (refactor monolithic `server.js`, add churn-model endpoints, behavior-event ingestion, anomaly streams, multi-tenancy) is TOO-RISKY (touches a ~1000-line monolith without a routes/ folder pattern) or NEEDS-PRODUCT-DECISION (model + schema choices). No mechanical-only addition is safe under the pass-4 constraints.
