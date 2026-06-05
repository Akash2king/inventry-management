#!/usr/bin/env bash
# Local dev: backend + Metro + Android (run from your own terminal — not Cursor sandbox).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND="$(cd "$ROOT/../waste_oil_backend" && pwd)"

echo "=== Chem-Solv Inventory — dev stack ==="
echo "LAN IP (use on phone if API Settings needed): $(hostname -I | awk '{print $1}')"
echo "API URL in .env: EXPO_PUBLIC_API_BASE_URL"
echo ""
echo "Terminal 1 — Django:"
echo "  cd \"$BACKEND\""
echo "  source .venv/bin/activate && python manage.py runserver 0.0.0.0:8000"
echo ""
echo "Terminal 2 — Metro (this script):"
echo "  cd \"$ROOT\" && bash scripts/run-dev.sh metro"
echo ""
echo "Terminal 3 — install/launch app:"
echo "  cd \"$ROOT\" && npm run android"
echo ""

if [[ "${1:-}" == "metro" ]]; then
  cd "$ROOT"
  source scripts/android-env.sh
  export CHOKIDAR_USEPOLLING=1
  export WATCHMAN_DISABLE=1
  adb reverse tcp:8081 tcp:8081 2>/dev/null || true
  exec npx expo start --dev-client --host lan --clear
fi

if [[ "${1:-}" == "backend" ]]; then
  exec bash "$BACKEND/scripts/run-backend.sh"
fi

echo "Usage: bash scripts/run-dev.sh [metro|backend]"
