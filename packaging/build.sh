#!/usr/bin/env bash
# Build a self-contained Bonner Dashboard desktop binary for the current OS.
#
#   ./packaging/build.sh
#
# Output: backend/dist/BonnerDashboard/ (and BonnerDashboard.app on macOS).
# No Python or Node is needed on the machine that runs the resulting app.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> Building frontend"
cd "$ROOT/frontend"
bun install --frozen-lockfile
bun run build

echo "==> Syncing backend deps (incl. desktop extras: pywebview, pyinstaller)"
cd "$ROOT/backend"
uv sync --extra desktop

echo "==> Packaging with PyInstaller"
uv run pyinstaller "$ROOT/packaging/bonner.spec" --noconfirm --distpath "$ROOT/backend/dist" --workpath "$ROOT/backend/build"

echo "==> Done. Artifacts in $ROOT/backend/dist/"
ls -1 "$ROOT/backend/dist"
