#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"

cd "$ROOT/backend"
# Ensure the backend virtual environment matches uv.lock before startup.
uv sync
uv run python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!

cleanup() {
  kill "$BACKEND_PID" >/dev/null 2>&1 || true
}

trap cleanup EXIT

cd "$ROOT/frontend"
bun install --frozen-lockfile
bun run dev
