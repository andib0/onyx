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

// @ide/backoff (via expo-notifications) imports Node's `assert` for five argument
// checks, which drags in the npm `assert` + `util` polyfills and their es-shim chain
// (~50 KB of Hermes bytecode). Point it at a tiny equivalent instead.
const path = require("node:path");
const assertShim = path.resolve(__dirname, "shims/assert.js");
const defaultResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === "assert" &&
    /[\\/]node_modules[\\/]@ide[\\/]backoff[\\/]/.test(context.originModulePath)
  ) {
    return { type: "sourceFile", filePath: assertShim };
  }
  return (defaultResolve ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
