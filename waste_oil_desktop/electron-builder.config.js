/**
 * @type {import('electron-builder').Configuration}
 */
module.exports = {
  appId: "com.wasteoil.desktop",
  productName: "Waste Oil Desktop",
  directories: {
    output: "release",
    buildResources: "build",
  },
  files: ["dist/renderer/**/*", "electron/**/*", "package.json"],
  asar: true,
  win: {
    target: ["nsis"],
    signAndEditExecutable: false,
  },
  forceCodeSigning: false,
  mac: {
    target: ["dmg"],
    category: "public.app-category.business",
  },
  linux: {
    target: ["AppImage"],
    category: "Office",
  },
};
