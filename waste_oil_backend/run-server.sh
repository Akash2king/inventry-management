#!/usr/bin/env bash
# Quick start (same as start-backend.sh). Pass a profile to skip the menu:
#   ./run-server.sh
#   ./run-server.sh local
#   ./run-server.sh cloud
#   ./run-server.sh sqlite 0.0.0.0:8000
set -eu
cd "$(dirname "$0")"

if command -v python3 >/dev/null 2>&1; then
  PY=python3
elif command -v python >/dev/null 2>&1; then
  PY=python
else
  echo "Python 3 not found."
  exit 1
fi

exec "$PY" scripts/bootstrap_backend.py "$@"
