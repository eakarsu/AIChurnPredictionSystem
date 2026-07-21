#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[ -f "$ROOT/.env" ] || cp "$ROOT/.env.example" "$ROOT/.env"
(cd "$ROOT/backend" && npm ci)
(cd "$ROOT/frontend" && npm ci)
echo 'Dependencies installed. Configure .env, then run scripts/migrate.sh.'
