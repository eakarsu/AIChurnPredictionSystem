#!/usr/bin/env bash
set -euo pipefail
[ "${CONFIRM_DEMO_SEED:-}" = 'yes' ] || { echo 'Refusing demo seed. Set CONFIRM_DEMO_SEED=yes for an isolated non-production database.' >&2; exit 1; }
[ "${NODE_ENV:-development}" != 'production' ] || { echo 'Demo seed is forbidden in production.' >&2; exit 1; }
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
(cd "$ROOT/backend" && npm run seed)
