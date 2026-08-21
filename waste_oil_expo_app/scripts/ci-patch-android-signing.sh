#!/usr/bin/env bash
# CI helper: patch android/app/build.gradle for release signing via keystore.properties.
# Must run AFTER `npx expo prebuild --platform android`.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

GRADLE_GROOVY="android/app/build.gradle"
GRADLE_KTS="android/app/build.gradle.kts"

if [ -f "$GRADLE_GROOVY" ]; then
  TARGET="$GRADLE_GROOVY"
elif [ -f "$GRADLE_KTS" ]; then
  echo "ERROR: Found $GRADLE_KTS but CI signing patch expects Groovy build.gradle." >&2
  echo "Re-run prebuild or update the patch script for Kotlin DSL." >&2
  exit 1
else
  echo "ERROR: Missing android/app/build.gradle after prebuild." >&2
  echo "android/ contents:" >&2
  find android -maxdepth 3 -type f 2>/dev/null | head -80 >&2 || true
  exit 1
fi

python3 - "$TARGET" <<'PY'
from __future__ import annotations
import re
import sys
from pathlib import Path

p = Path(sys.argv[1])
s = p.read_text(encoding="utf-8")

if "import java.util.Properties" not in s:
    s = "import java.util.Properties\nimport java.io.FileInputStream\n\n" + s

if "keystorePropertiesFile" not in s:
    # Prefer jscFlavor anchor (older RN); else insert after android { or near top of android block.
    m = re.search(r"^def jscFlavor = .*$", s, flags=re.M)
    insert_block = (
        "def keystorePropertiesFile = rootProject.file(\"keystore.properties\")\n"
        "def keystoreProperties = new Properties()\n"
        "def keystorePropertiesLoaded = false\n"
        "if (keystorePropertiesFile.exists()) {\n"
        "    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))\n"
        "    keystorePropertiesLoaded = true\n"
        '} else if ("true".equalsIgnoreCase(System.getenv("CI"))) {\n'
        '    throw new GradleException("Missing android/keystore.properties (required for CI release signing).")\n'
        "}\n"
    )
    if m:
        anchor = m.group(0)
        s = s.replace(anchor, anchor + "\n\n" + insert_block, 1)
    else:
        # Insert before `android {` block
        m2 = re.search(r"^android\s*\{", s, flags=re.M)
        if not m2:
            raise SystemExit("Could not find insertion point in android/app/build.gradle")
        idx = m2.start()
        s = s[:idx] + insert_block + "\n" + s[idx:]

if "signingConfigs.release" not in s:
    old = (
        "    signingConfigs {\n"
        "        debug {\n"
        "            storeFile file('debug.keystore')\n"
        "            storePassword 'android'\n"
        "            keyAlias 'androiddebugkey'\n"
        "            keyPassword 'android'\n"
        "        }\n"
        "    }\n"
    )
    # Expo / RN templates sometimes use double quotes
    old_alt = old.replace("'", '"')
    new = (
        "    signingConfigs {\n"
        "        debug {\n"
        "            storeFile file('debug.keystore')\n"
        "            storePassword 'android'\n"
        "            keyAlias 'androiddebugkey'\n"
        "            keyPassword 'android'\n"
        "        }\n"
        "        release {\n"
        "            if (keystorePropertiesLoaded) {\n"
        "                storeFile file(keystoreProperties['storeFile'])\n"
        "                storePassword keystoreProperties['storePassword']\n"
        "                keyAlias keystoreProperties['keyAlias']\n"
        "                keyPassword keystoreProperties['keyPassword']\n"
        "            }\n"
        "        }\n"
        "    }\n"
    )
    if old in s:
        s = s.replace(old, new, 1)
    elif old_alt in s:
        s = s.replace(old_alt, new, 1)
    else:
        # Looser match for debug signingConfigs block
        pattern = re.compile(
            r"signingConfigs\s*\{\s*debug\s*\{[\s\S]*?\}\s*\}",
            re.M,
        )
        m = pattern.search(s)
        if not m:
            raise SystemExit("Could not find signingConfigs.debug block to extend")
        s = s[: m.start()] + (
            "signingConfigs {\n"
            "        debug {\n"
            "            storeFile file('debug.keystore')\n"
            "            storePassword 'android'\n"
            "            keyAlias 'androiddebugkey'\n"
            "            keyPassword 'android'\n"
            "        }\n"
            "        release {\n"
            "            if (keystorePropertiesLoaded) {\n"
            "                storeFile file(keystoreProperties['storeFile'])\n"
            "                storePassword keystoreProperties['storePassword']\n"
            "                keyAlias keystoreProperties['keyAlias']\n"
            "                keyPassword keystoreProperties['keyPassword']\n"
            "            }\n"
            "        }\n"
            "    }"
        ) + s[m.end() :]

s2, n = re.subn(
    r"(release\s*\{[\s\S]*?\n)\s*signingConfig\s+signingConfigs\.debug(\s*\n)",
    lambda m: m.group(1)
    + "            signingConfig keystorePropertiesLoaded ? signingConfigs.release : signingConfigs.debug"
    + m.group(2),
    s,
    count=1,
)
if n:
    s = s2

p.write_text(s, encoding="utf-8")
print("Patched", p)
PY
