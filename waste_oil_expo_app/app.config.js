const appJson = require("./app.json");
const fs = require("fs");
const path = require("path");

/**
 * Expo expects googleServicesFile to be a filesystem PATH.
 * In CI we write secrets.GOOGLE_SERVICES_JSON (file contents) to ./google-services.json.
 * Never pass raw JSON contents as googleServicesFile.
 */
function resolveGoogleServicesFile() {
  const fromEnvPath = process.env.GOOGLE_SERVICES_JSON_FILE;
  if (fromEnvPath && fs.existsSync(fromEnvPath)) {
    return fromEnvPath;
  }

  const legacy = process.env.GOOGLE_SERVICES_JSON;
  // Only treat env as a path if it looks like one and exists.
  if (
    legacy &&
    !legacy.trim().startsWith("{") &&
    (legacy.includes("/") || legacy.includes("\\") || legacy.endsWith(".json")) &&
    fs.existsSync(legacy)
  ) {
    return legacy;
  }

  const local = path.join(__dirname, "google-services.json");
  if (fs.existsSync(local)) {
    return "./google-services.json";
  }

  // Fall back for local docs / optional push; prebuild in CI always writes the file first.
  return "./google-services.json";
}

module.exports = () => {
  const googleServicesFile = resolveGoogleServicesFile();
  const oneSignalAppId =
    process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID ??
    appJson.expo.extra?.oneSignalAppId ??
    "e744024a-08b5-4703-a3ed-af0ac17e907f";
  const apiBaseUrl = (
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    ""
  ).trim();
  const oneSignalMode =
    process.env.ONESIGNAL_MODE ||
    (process.env.EAS_BUILD_PROFILE === "production" || process.env.CI === "true"
      ? "production"
      : "development");

  const plugins = (appJson.expo.plugins || []).map((plugin) => {
    if (Array.isArray(plugin) && plugin[0] === "onesignal-expo-plugin") {
      return ["onesignal-expo-plugin", { ...(plugin[1] || {}), mode: oneSignalMode }];
    }
    return plugin;
  });

  return {
    ...appJson,
    expo: {
      ...appJson.expo,
      plugins,
      android: {
        ...appJson.expo.android,
        googleServicesFile,
      },
      extra: {
        ...appJson.expo.extra,
        oneSignalAppId,
        EXPO_PUBLIC_API_BASE_URL: apiBaseUrl,
      },
    },
  };
};
