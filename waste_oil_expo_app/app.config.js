const appJson = require("./app.json");

module.exports = () => {
  const googleServicesFile =
    process.env.GOOGLE_SERVICES_JSON ?? "./google-services.json";
  const oneSignalAppId =
    process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID ??
    appJson.expo.extra?.oneSignalAppId ??
    "e744024a-08b5-4703-a3ed-af0ac17e907f";

  return {
    ...appJson,
    expo: {
      ...appJson.expo,
      android: {
        ...appJson.expo.android,
        googleServicesFile,
      },
      extra: {
        ...appJson.expo.extra,
        oneSignalAppId,
      },
    },
  };
};
