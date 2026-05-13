const appJson = require("./app.json");

module.exports = () => {
  const googleServicesFile =
    process.env.GOOGLE_SERVICES_JSON ?? "./google-services.json";

  return {
    ...appJson,
    expo: {
      ...appJson.expo,
      android: {
        ...appJson.expo.android,
        googleServicesFile,
      },
    },
  };
};
