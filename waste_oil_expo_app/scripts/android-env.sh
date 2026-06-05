#!/usr/bin/env bash
# Source before `npx expo run:android` — sets ANDROID_HOME, adb, and android/local.properties
# Usage: source scripts/android-env.sh

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Prefer explicit ANDROID_HOME, then common install locations
if [[ -z "${ANDROID_HOME:-}" ]]; then
  for candidate in \
    "$HOME/Android/Sdk" \
    "/usr/lib/android-sdk" \
    "/opt/android-sdk"; do
    if [[ -d "$candidate/platform-tools" ]] || [[ -d "$candidate/cmdline-tools" ]]; then
      export ANDROID_HOME="$candidate"
      break
    fi
  done
fi

if [[ -z "${ANDROID_HOME:-}" ]]; then
  echo "ANDROID_HOME not set and no SDK found."
  echo "Run once: bash scripts/setup-android-sdk.sh"
  return 1 2>/dev/null || exit 1
fi

export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"

if [[ -z "${JAVA_HOME:-}" ]] && [[ -d /usr/lib/jvm/java-17-openjdk-amd64 ]]; then
  export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
fi
if [[ -n "${JAVA_HOME:-}" ]]; then
  export PATH="$JAVA_HOME/bin:$PATH"
fi

# Expo/Gradle read sdk.dir from local.properties
mkdir -p "$ROOT/android"
printf 'sdk.dir=%s\n' "$ANDROID_HOME" > "$ROOT/android/local.properties"

# Expo spawns $ANDROID_HOME/platform-tools/adb directly — seed from bundled copy if needed
if [[ ! -x "$ANDROID_HOME/platform-tools/adb" ]] && [[ -x "$ROOT/scripts/platform-tools/adb" ]]; then
  mkdir -p "$ANDROID_HOME/platform-tools"
  cp "$ROOT/scripts/platform-tools/adb" "$ANDROID_HOME/platform-tools/adb"
  chmod +x "$ANDROID_HOME/platform-tools/adb"
fi

# Fallback adb on PATH if platform-tools still missing
if ! command -v adb >/dev/null 2>&1 && [[ -x "$ROOT/scripts/platform-tools/adb" ]]; then
  cached="/tmp/wom-platform-tools-adb"
  if [[ ! -x "$cached" ]] || [[ "$ROOT/scripts/platform-tools/adb" -nt "$cached" ]]; then
    cp "$ROOT/scripts/platform-tools/adb" "$cached" && chmod +x "$cached"
  fi
  export PATH="/tmp:$PATH"
fi

echo "ANDROID_HOME=$ANDROID_HOME"
command -v adb >/dev/null && echo "adb=$(command -v adb)" || echo "WARN: adb still not found — run setup-android-sdk.sh"
