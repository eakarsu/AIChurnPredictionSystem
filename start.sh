#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[ -f "$ROOT/.env" ] || { echo 'Missing .env; copy .env.example and configure it.' >&2; exit 1; }
[ -d "$ROOT/backend/node_modules" ] && [ -d "$ROOT/frontend/node_modules" ] || { echo 'Dependencies absent; run scripts/bootstrap.sh.' >&2; exit 1; }
(cd "$ROOT/backend" && npm start) & BACKEND_PID=$!
(cd "$ROOT/frontend" && npm start) & FRONTEND_PID=$!
cleanup(){ kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true; wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true; }
trap cleanup EXIT INT TERM
wait "$BACKEND_PID" "$FRONTEND_PID"
