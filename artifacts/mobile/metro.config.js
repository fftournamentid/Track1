const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Block Metro's FallbackWatcher from watching _tmp_ directories that some
// native packages (e.g. @react-native-community/netinfo) create during
// installation. These temp directories don't exist by the time Metro starts,
// which causes an ENOENT crash in the FallbackWatcher.
// See: https://github.com/facebook/metro/issues/1 (known watcher issue)
const { blockList: existingBlockList } = config.resolver ?? {};
const extraBlockPatterns = [/_tmp_/];

config.resolver = {
  ...config.resolver,
  blockList: Array.isArray(existingBlockList)
    ? [...existingBlockList, ...extraBlockPatterns]
    : existingBlockList instanceof RegExp
    ? [existingBlockList, ...extraBlockPatterns]
    : extraBlockPatterns,
};

module.exports = config;
