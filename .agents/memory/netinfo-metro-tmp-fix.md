---
name: netinfo Metro _tmp_ fix
description: @react-native-community/netinfo crashes Metro FallbackWatcher via _tmp_ dirs; fix via metro.config.js blockList + web platform shim
---

# @react-native-community/netinfo Metro FallbackWatcher crash

## Rule
When adding `@react-native-community/netinfo` to the mobile artifact, always:
1. Add `/_tmp_/` to Metro's `resolver.blockList` in `metro.config.js`
2. Create a `.web.ts` platform shim (using `navigator.onLine` + window events) alongside the `.ts` native file — Metro auto-selects `.web.ts` for web bundles, avoiding the "cannot resolve" error

## Why
The package creates `_tmp_` directories during pnpm install (e.g. `netinfo_tmp_1754/android/gradle`). These directories don't exist when Metro's FallbackWatcher starts, causing an `ENOENT: no such file or directory, watch ...` crash that kills the Expo dev server. The same pattern affects `@supabase/supabase-js` (documented in supabase-expo-storage.md).

## How to apply
In `metro.config.js`:
```js
config.resolver.blockList = [/_tmp_/];
```
The web shim (`useNetworkGate.web.ts`) must export the same `ConnectivityState` type and `useNetworkGate` function signature — callers need zero platform-specific code.

## Version pinning
Expo 54 expects: `@react-native-community/netinfo@11.4.1`, `expo-sqlite@~16.0.10`
Installing newer versions (12.x / 57.x) triggers Expo version mismatch warnings.
