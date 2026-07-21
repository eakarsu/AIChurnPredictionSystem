# Governed retention operations

The production-boundary workflow is \`/api/governed-retention/runs\`: versioned source snapshots → reproducible features → calibrated scoring → review/suppression → governed experiment authorization → intervention → outcome measurement. Creation requires bearer auth, \`x-tenant-id\`, and \`idempotency-key\`; roles live in \`retention_tenant_memberships\`.

CRM, billing, telemetry, support, experimentation, and messaging work is queued in \`retention_outbox\`. Production enablement requires real adapters plus leakage, calibration, lift, drift, fairness, and incrementality reports. Generative recommendations are advisory and cannot authorize contact.

## Safe lifecycle

1. Copy `.env.example` to `.env` and replace every placeholder.
2. Run `scripts/bootstrap.sh` once to install locked dependencies.
3. Run `scripts/migrate.sh` explicitly against the intended database.
4. Provision tenant memberships through an audited administrator process.
5. Run `./start.sh`; it never installs, seeds, migrates, starts PostgreSQL, or kills ports.

Legacy seed data is demo-only. Where `scripts/seed-demo.sh` exists it requires `CONFIRM_DEMO_SEED=yes` and refuses production. External provider calls and production data were not exercised by this implementation.
