// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// react-native-maps has no web support and its native files import
// react-native internals (codegenNativeCommands) that Metro cannot bundle
// for web. Stub it out on web so expo-router's require.context (which
// includes .native.tsx files for route discovery) doesn't fail bundling.
const { resolveRequest } = config.resolver;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web" && moduleName.startsWith("react-native-maps")) {
    return { type: "empty" };
  }
  return resolveRequest
    ? resolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
