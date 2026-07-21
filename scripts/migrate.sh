#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[ -f "$ROOT/.env" ] && set -a && . "$ROOT/.env" && set +a
[ -n "${DATABASE_URL:-}" ] || { echo 'DATABASE_URL is required for explicit migrations.' >&2; exit 1; }
for migration in "$ROOT/backend/migrations/"*.sql; do [ -f "$migration" ] && psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$migration"; done
