#!/usr/bin/env bash
# USB debugging helper for Chem-Solv Inventory (OneSignal + React Native).
# Usage:
#   ./scripts/adb-debug-push.sh              # filtered logcat (default)
#   ./scripts/adb-debug-push.sh status       # device + app + notification state
#   ./scripts/adb-debug-push.sh reverse      # adb reverse tcp:8000 (Django on PC)
#   ./scripts/adb-debug-push.sh clear        # clear logcat buffer
#   ./scripts/adb-debug-push.sh install-check # is app installed?

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PKG="com.chemsolv.inventory"
ADB="${ADB:-}"

resolve_adb() {
  if [[ -n "$ADB" && -x "$ADB" ]]; then
    return 0
  fi
  if command -v adb >/dev/null 2>&1; then
    ADB="$(command -v adb)"
    return 0
  fi
  local bundled="$ROOT/scripts/platform-tools/adb"
  if [[ -x "$bundled" ]]; then
    # Bundled adb segfaults when the repo path contains spaces — run from /tmp.
    local cached="/tmp/wom-platform-tools-adb"
    if [[ ! -x "$cached" ]] || [[ "$bundled" -nt "$cached" ]]; then
      cp "$bundled" "$cached"
      chmod +x "$cached"
    fi
    ADB="$cached"
    return 0
  fi
  echo "adb not found. Install: sudo apt install adb"
  echo "Or download platform-tools into scripts/platform-tools/"
  exit 1
}

require_device() {
  local out serial state
  out="$("$ADB" devices 2>/dev/null | tail -n +2 | grep -v '^$' || true)"
  if [[ -z "$out" ]]; then
    echo "No USB device detected."
    echo ""
    echo "On the phone:"
    echo "  1. Settings → About phone → tap Build number 7× (Developer options)"
    echo "  2. Settings → Developer options → USB debugging ON"
    echo "  3. Connect USB → accept 'Allow USB debugging' prompt"
    echo "  4. Set USB mode to File transfer / MTP if needed"
    echo ""
    echo "Then run: $ADB devices"
    exit 1
  fi
  if echo "$out" | grep -q unauthorized; then
    echo "Device is UNAUTHORIZED. Unlock phone and accept the USB debugging RSA prompt."
    exit 1
  fi
  serial="$(echo "$out" | awk 'NR==1 {print $1}')"
  echo "Device: $serial"
}

cmd_status() {
  require_device
  echo ""
  echo "=== Package ==="
  "$ADB" shell pm path "$PKG" 2>/dev/null || echo "App NOT installed ($PKG)"
  echo ""
  echo "=== Notification permission (Android 13+) ==="
  "$ADB" shell dumpsys package "$PKG" 2>/dev/null | grep -E "POST_NOTIFICATIONS|android.permission" | head -20 || true
  echo ""
  echo "=== App ops (notifications) ==="
  "$ADB" shell cmd appops get "$PKG" POST_NOTIFICATIONS 2>/dev/null || true
  echo ""
  echo "=== Recent OneSignal / RN log lines ==="
  "$ADB" logcat -d -t 80 2>/dev/null | grep -iE "OneSignal|ReactNativeJS|ChemSolv|chemsolv|WOM_PUSH" || echo "(no matching lines in buffer — open app and log in)"
}

cmd_reverse() {
  require_device
  "$ADB" reverse tcp:8000 tcp:8000
  echo "adb reverse tcp:8000 tcp:8000 — phone can reach Django at http://127.0.0.1:8000"
  echo "Set app API URL to: http://127.0.0.1:8000/api/v1  (or your LAN IP if reverse fails)"
}

cmd_clear() {
  require_device
  "$ADB" logcat -c
  echo "Logcat cleared."
}

cmd_install_check() {
  require_device
  if "$ADB" shell pm path "$PKG" >/dev/null 2>&1; then
    echo "Installed: $PKG"
    "$ADB" shell dumpsys package "$PKG" | grep -E "versionName|versionCode" | head -2
  else
    echo "NOT installed. Build with: npx expo run:android"
  fi
}

cmd_logcat() {
  require_device
  echo "Streaming logs (Ctrl+C to stop). Filters: OneSignal, ReactNativeJS, WOM_PUSH"
  echo ""
  "$ADB" logcat -c 2>/dev/null || true
  "$ADB" logcat -v time \
    OneSignal:V \
    ReactNativeJS:V \
    ReactNative:V \
    *:S \
    2>/dev/null | grep -iE "OneSignal|ReactNativeJS|WOM_PUSH|chemsolv|subscription|push|notification" --line-buffered
}

resolve_adb
echo "Using adb: $ADB"
"$ADB" start-server >/dev/null 2>&1 || true

case "${1:-logcat}" in
  status) cmd_status ;;
  reverse) cmd_reverse ;;
  clear) cmd_clear ;;
  install-check) cmd_install_check ;;
  logcat|logs|"") cmd_logcat ;;
  *)
    echo "Unknown command: $1"
    echo "Commands: logcat | status | reverse | clear | install-check"
    exit 1
    ;;
esac
