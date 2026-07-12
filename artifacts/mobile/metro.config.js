const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// ─── Firebase JS SDK + Metro package-exports crash (release-only) ───────────
// Metro (Expo SDK 53+) resolves npm "exports" maps by default. firebase/auth's
// exports map has no "react-native" condition, so with package-exports
// resolution ON, Metro picks the "browser"/"default" ESM build
// (dist/esm/index.esm.js) instead of the CJS build. That ESM build assumes
// DOM globals (window/indexedDB) that don't exist under Hermes on a real
// device, and blows up at Auth-module-eval time — it doesn't show up in the
// Expo web preview (real browser, so the browser build is actually correct
// there) or always in Metro's dev server, but it hard-crashes a standalone
// release APK on boot. Disabling package-exports resolution forces Metro
// back to the legacy main/browser/module fields, which firebase publishes a
// React-Native-safe CJS build for.
// See: https://github.com/firebase/firebase-js-sdk/issues/8262
config.resolver.unstable_enablePackageExports = false;

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
