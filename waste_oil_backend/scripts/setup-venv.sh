#!/usr/bin/env bash
# Create/repair Linux .venv and install requirements/dev.txt
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v python3 >/dev/null; then
  echo "python3 not found."
  exit 1
fi

if ! python3 -c "import venv" 2>/dev/null; then
  echo "python3-venv is required. Install it, then re-run:"
  echo "  sudo apt install python3-venv python3-pip"
  exit 1
fi

echo "Creating virtual environment at $ROOT/.venv ..."
rm -rf .venv
python3 -m venv .venv

if ! .venv/bin/python -m pip --version >/dev/null 2>&1; then
  echo "Bootstrapping pip into .venv ..."
  if .venv/bin/python -m ensurepip --upgrade 2>/dev/null; then
    true
  else
    tmp="$(mktemp)"
    curl -fsSL https://bootstrap.pypa.io/get-pip.py -o "$tmp"
    .venv/bin/python "$tmp"
    rm -f "$tmp"
  fi
fi

.venv/bin/python -m pip install --upgrade pip
.venv/bin/pip install -r requirements/dev.txt
.venv/bin/python manage.py check

echo ""
echo "Virtualenv ready. Activate and run:"
echo "  source .venv/bin/activate"
echo "  python manage.py runserver 0.0.0.0:8000"
echo ""
echo "Or without activating:"
echo "  bash run-server.sh"
