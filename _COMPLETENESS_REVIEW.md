# Completeness Review: AIChurnPredictionSystem

- **Review date:** 2026-07-18
- **Assessment basis:** Static source and configuration inspection only. Dependencies were not installed, and no build, database migration, external integration, or runtime workflow was executed.

## Classification

**Prototype-demo**

## Verdict

The repository presents a broad customer-retention analytics surface (40 source files and 10 route modules), but the static evidence is characteristic of a generated prototype. Pages and endpoints demonstrate concepts; they do not establish a verified execution path for connect governed customer history to reproducible feature generation, calibrated scoring, interventions, and outcome measurement.

## Why it is not complete

- 9 files are explicitly named as gap/gap-feature implementations; route/page count therefore overstates completed product capability.
- 13 files reference model-provider or chat-completion behavior; these generic LLM paths are not a substitute for deterministic domain execution, grounding, or evaluation.
- 9 files contain mock, sample, placeholder, or random-data signals, leaving important outcomes disconnected from authoritative systems.
- No recognizable application test files were found in the inspected tree.
- No CI workflow was found to continuously verify builds, tests, migrations, or security checks.
- No environment example/template was found, so required configuration and secret boundaries are undocumented.

## Needed features

- 1. Implement a workflow to connect governed customer history to reproducible feature generation, calibrated scoring, interventions, and outcome measurement.
- 2. Connect CRM, billing, product telemetry, support, experimentation, and messaging systems; replace seed/demo records with durable, synchronized data and explicit failure handling.
- 3. Validate leakage, calibration, lift, drift, fairness, and intervention incrementality.
- 4. Enforce consent, explainability, suppression rules, access controls, and experiment governance.
- 5. Add contract, integration, authorization, migration, and end-to-end tests in CI, plus a documented non-destructive deployment/run path.

## Risks or launch blockers

- Credential/secret fallback or demo-password patterns occur in 4 files and must be removed or made development-only.
- The root launcher can terminate unrelated processes occupying configured ports.
- The root launcher seeds, creates, migrates, or otherwise mutates database state during startup.
- The root launcher installs dependencies at run time, reducing reproducibility and expanding supply-chain risk.
- Ungrounded or malformed model output can become a domain action unless schemas, evidence, evaluations, and approval gates are added.

## Evidence inspected

- `backend/package.json` — declared scripts, runtime dependencies, and application boundaries.
- `frontend/package.json` — declared scripts, runtime dependencies, and application boundaries.
- `backend/server.js` — service composition, middleware, and registered routes.
- `backend/routes/customViews.js` — implemented API surface and domain/AI request handling.
- `start.sh` — launcher behavior, dependency/database setup, and process handling.

## Recommended next action

Treat this as a prototype: select one narrow customer-retention analytics outcome, remove or quarantine generated gap routes, and implement that outcome end to end with real data, deterministic rules, and tests before adding features.

## Implementation progress

- Needed feature 1: implemented \`/api/governed-retention\` for versioned snapshots, reproducible feature/model/calibration metadata, scores, review/suppression, governed experiment authorization, intervention, and outcome state with durable batches/events.
- Needed feature 2: added a retry/dead-letter outbox contract for CRM, billing, telemetry, support, experimentation, and messaging. Live provider adapters and credentials remain external blockers.
- Needed features 3–4: added mandatory calibration/drift metrics, deterministic suppression, consent-policy/model/feature versioning, holdout experiments, role-gated authorization, idempotency, optimistic concurrency, and audit events. Leakage/lift/fairness/incrementality validation on representative production data remains external.
- Needed feature 5 and launcher/auth risks: moved schema setup out of startup, removed DB password fallback and unrestricted CORS, added runtime validation, explicit migration/bootstrap/guarded seed, nondestructive start, environment/operations docs, CI/tests, and removed mounted gap routes.
- Validation: 4/4 domain tests passed; changed JavaScript and shell syntax checks passed. No service, provider, database, model training, or production-data evaluation was run.
