#!/usr/bin/env bash
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PY="$ROOT/.venv/bin/python"
if [ ! -x "$PY" ]; then
  echo "Missing $PY — run: bash scripts/setup-venv.sh"
  exit 1
fi
if ! "$PY" -c "import django" 2>/dev/null; then
  echo "Django not installed in .venv — run: bash scripts/setup-venv.sh"
  exit 1
fi

exec "$PY" manage.py runserver 0.0.0.0:8000 "$@"
