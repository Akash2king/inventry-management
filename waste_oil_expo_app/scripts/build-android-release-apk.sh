#!/usr/bin/env bash
# Build a release APK locally (bundled JS, no EAS).
# Output: android/app/build/outputs/apk/release/app-release.apk
set -eu

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# shellcheck source=/dev/null
source "$ROOT/scripts/android-env.sh"

if [ -f "$ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$ROOT/.env"
  set +a
fi

echo "==> Expo prebuild (android) if needed..."
if [ ! -f "$ROOT/android/gradlew" ] || [ ! -f "$ROOT/android/app/build.gradle" ]; then
  bash "$ROOT/scripts/ci-generate-native-android.sh"
fi

echo "==> Building release APK (Gradle assembleRelease)..."
cd "$ROOT/android"
chmod +x ./gradlew
./gradlew :app:assembleRelease -x lint --no-daemon

APK="$ROOT/android/app/build/outputs/apk/release/app-release.apk"
if [ ! -f "$APK" ]; then
  echo "ERROR: APK not found at $APK" >&2
  exit 1
fi

VERSION="$(node -p "require('../app.json').expo.version" 2>/dev/null || echo "1.0.0")"
DEST="$ROOT/android/app/build/outputs/apk/release/Chem-Solv-Inventory-${VERSION}.apk"
cp -f "$APK" "$DEST"

echo ""
echo "Release APK ready:"
echo "  $DEST"
echo ""
echo "Install on a connected device:"
echo "  adb install -r \"$DEST\""
