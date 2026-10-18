// Expo's default Metro config plus inline requires on native: a module's named
// imports are required on first use instead of all at app start (the React Native
// template's default; Expo ships it off). Not on web: react-native-worklets'
// JS-worklets init depends on eager module order there (e2e smoke breaks).
// Cold-start numbers in docs/log/cold-start.md.
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.transformer.getTransformOptions = async (_entryPoints, options) => ({
  transform: {
    experimentalImportSupport: true,
    inlineRequires: options.platform !== "web",
  },
});

module.exports = config;
