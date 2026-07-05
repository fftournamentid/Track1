---
name: Font loading white screen
description: RootLayout returns null while useFonts() is pending, causing a pure white flash that appears as a broken app in screenshots and cold loads.
---

## Rule
Never return `null` from `RootLayout` while fonts are loading. Show `LoadingScreen` (or any fallback) instead.

**Why:** `@expo-google-fonts/inter` can take 100–500 ms to load on web. Returning `null` renders a blank white view during that window, which is indistinguishable from a crash in screenshots, automated tests, and cold-start user experience.

**How to apply:**
Replace:
```tsx
if (!fontsLoaded && !fontError) return null;
```
With:
```tsx
if (!fontsLoaded && !fontError) {
  return <LoadingScreen />;  // or any visually branded fallback
}
```

Also: always pass an `onError` prop to `<ErrorBoundary>` so errors aren't silently swallowed:
```tsx
<ErrorBoundary onError={(err) => console.error("[ErrorBoundary]", err.message, err.stack)}>
```
Without `onError`, errors caught by the boundary produce no console output at all — impossible to debug.
