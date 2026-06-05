#!/usr/bin/env bash
# Install Android SDK command-line tools to ~/Android/Sdk (no Android Studio required).
# Run once, then: source scripts/android-env.sh && npx expo run:android

set -euo pipefail

if ! command -v java >/dev/null 2>&1; then
  echo "Java JDK is required. Install it first:"
  echo "  sudo apt install openjdk-17-jdk"
  echo "Then re-run: npm run android:setup-sdk"
  exit 1
fi

SDK_ROOT="${ANDROID_HOME:-$HOME/Android/Sdk}"
CMDLINE_ZIP="/tmp/commandlinetools-linux.zip"
CMDLINE_URL="https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"

echo "Android SDK will be installed under: $SDK_ROOT"
mkdir -p "$SDK_ROOT/cmdline-tools"

if [[ ! -x "$SDK_ROOT/cmdline-tools/latest/bin/sdkmanager" ]]; then
  echo "Downloading Android command-line tools..."
  curl -fsSL -o "$CMDLINE_ZIP" "$CMDLINE_URL"
  rm -rf /tmp/cmdline-tools
  unzip -q -o "$CMDLINE_ZIP" -d /tmp
  rm -rf "$SDK_ROOT/cmdline-tools/latest"
  mv /tmp/cmdline-tools "$SDK_ROOT/cmdline-tools/latest"
  echo "Command-line tools installed."
fi

export ANDROID_HOME="$SDK_ROOT"
export PATH="$SDK_ROOT/cmdline-tools/latest/bin:$SDK_ROOT/platform-tools:$PATH"

echo "Installing SDK packages (platform 35, build-tools, platform-tools)..."
yes | sdkmanager --licenses >/dev/null 2>&1 || yes | sdkmanager --licenses
sdkmanager "platform-tools" "platforms;android-35" "build-tools;35.0.0"

echo ""
echo "Done. Add to your ~/.bashrc:"
echo "  source \"$(cd "$(dirname "$0")/.." && pwd)/scripts/android-env.sh\""
echo ""
echo "Then build:"
echo "  cd waste_oil_expo_app"
echo "  source scripts/android-env.sh"
echo "  npx expo run:android"
