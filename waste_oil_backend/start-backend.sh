#!/usr/bin/env bash
# Install venv + deps, pick DB (menu), ask seed y/n, migrate, run Django.
# Usage:
#   ./start-backend.sh
#   ./start-backend.sh local
#   ./start-backend.sh cloud 0.0.0.0:8000
#   ./start-backend.sh --seed
#   ./start-backend.sh --no-seed
#   ./start-backend.sh --install-only
#
# Interactive prompts (no profile / no --yes): DB profile → bind address → seed y/n.
set -eu
cd "$(dirname "$0")"

if command -v python3 >/dev/null 2>&1; then
  PY=python3
elif command -v python >/dev/null 2>&1; then
  PY=python
else
  echo "Python 3 not found. Install python3 (and python3-venv on Debian/Ubuntu)."
  exit 1
fi

exec "$PY" scripts/bootstrap_backend.py "$@"
