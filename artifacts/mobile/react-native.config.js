/**
 * react-native.config.js
 *
 * Excludes `react-native-google-mobile-ads` from Android native autolinking.
 *
 * WHY: react-native-google-mobile-ads@16.4.0 (the latest release) fails to
 * compile its Kotlin source when New Architecture is enabled — the same flag
 * that react-native-reanimated v4 requires. Disabling autolinking for Android
 * stops Gradle from trying to compile the broken Kotlin, while leaving the JS
 * import intact. initAdMob() is already wrapped in try/catch with an 8-second
 * timeout, so the runtime gracefully degrades to "ads disabled" with a console
 * warning rather than crashing.
 *
 * Remove this exclusion once a version of react-native-google-mobile-ads is
 * released that compiles cleanly under New Architecture + RN 0.81.
 */
module.exports = {
  dependencies: {
    'react-native-google-mobile-ads': {
      platforms: {
        android: null, // skip native autolinking on Android only
      },
    },
  },
};
