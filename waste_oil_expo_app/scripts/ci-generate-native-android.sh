#!/usr/bin/env bash
# Generate a full native Android project via Expo prebuild (for CI + local release).
# Prerequisites: npm ci already run; google-services.json at project root (or GOOGLE_SERVICES_JSON env = file contents).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> Preparing google-services.json"
if [ ! -f google-services.json ]; then
  if [ -n "${GOOGLE_SERVICES_JSON:-}" ]; then
    # Secret holds file CONTENTS, not a path.
    printf '%s\n' "$GOOGLE_SERVICES_JSON" > google-services.json
  else
    echo "ERROR: google-services.json missing and GOOGLE_SERVICES_JSON unset." >&2
    exit 1
  fi
fi
# Validate JSON roughly
python - <<'PY'
import json, sys
from pathlib import Path
p = Path("google-services.json")
data = json.loads(p.read_text(encoding="utf-8"))
if not isinstance(data, dict) or "project_info" not in data and "client" not in data:
    # Still accept typical google-services shapes
    if not isinstance(data, dict):
        sys.exit("google-services.json is not a JSON object")
print("google-services.json OK (", p.stat().st_size, "bytes)")
PY

# Expo app.config must see a PATH, never raw JSON in GOOGLE_SERVICES_JSON.
export GOOGLE_SERVICES_JSON_FILE="$ROOT/google-services.json"
unset GOOGLE_SERVICES_JSON || true

echo "==> Removing any partial android/ tree"
rm -rf android

echo "==> Expo prebuild (native Android project)"
npx expo prebuild --platform android --clean --no-install

echo "==> Verifying native project"
REQUIRED=(
  android/gradlew
  android/settings.gradle
  android/app/build.gradle
  android/app/src/main/AndroidManifest.xml
)
for f in "${REQUIRED[@]}"; do
  if [ ! -f "$f" ]; then
    echo "ERROR: missing $f after prebuild" >&2
    echo "--- android tree ---" >&2
    find android -maxdepth 4 -type f 2>/dev/null | head -100 >&2 || true
    exit 1
  fi
  echo "  OK $f"
done

chmod +x android/gradlew

mkdir -p android/app
cp -f google-services.json android/app/google-services.json
echo "  OK android/app/google-services.json"

# local.properties for Gradle (ANDROID_HOME from setup-android / android-env)
if [ -n "${ANDROID_HOME:-}${ANDROID_SDK_ROOT:-}" ]; then
  SDK="${ANDROID_HOME:-$ANDROID_SDK_ROOT}"
  # Escape backslashes for Gradle on Windows; Linux is fine as-is
  printf 'sdk.dir=%s\n' "$SDK" > android/local.properties
  echo "  OK android/local.properties -> $SDK"
fi

echo "==> Native Android project ready"
