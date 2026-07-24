#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[ -f "$ROOT/.env" ] || { echo 'Missing .env; copy .env.example and configure it.' >&2; exit 1; }
[ -d "$ROOT/backend/node_modules" ] && [ -d "$ROOT/frontend/node_modules" ] || { echo 'Dependencies absent; run scripts/bootstrap.sh.' >&2; exit 1; }
set -a; . "$ROOT/.env"; set +a
if [ "${MIGRATE_ON_START:-false}" = true ]; then
  "$ROOT/scripts/migrate.sh"
  (cd "$ROOT/backend" && node scripts/provision-admin.js)
fi
(cd "$ROOT/backend" && npm start) & BACKEND_PID=$!
(cd "$ROOT/frontend" && BROWSER=none PORT="${FRONTEND_PORT:-3400}" REACT_APP_API_URL="http://127.0.0.1:${BACKEND_PORT:-3401}/api" npm start) & FRONTEND_PID=$!
cleanup(){ kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true; wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true; }
trap cleanup EXIT INT TERM
wait "$BACKEND_PID" "$FRONTEND_PID"
