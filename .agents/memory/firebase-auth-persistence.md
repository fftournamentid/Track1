---
name: Firebase Auth persistence on React Native
description: Why plain getAuth(app) loses sessions on native and how the fix was typed.
---

`firebase/auth`'s `getAuth(app)` on React Native falls back to in-memory
persistence unless `initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })`
is called before any other code touches `auth`. Web is unaffected (browser
build already persists via indexedDB/localStorage), so branch on
`Platform.OS === 'web'` and only use `initializeAuth` on native, with a
try/catch fallback to `getAuth(app)` for the "already initialized" case
(e.g. Fast Refresh).

**Why:** the RN build of `@firebase/auth` (resolved via its
`"react-native"` package.json field) does export `getReactNativePersistence`
at runtime, but this project's SDK version's bundled TypeScript types for
`firebase/auth` are the shared/generic ones and do NOT declare it, so `tsc`
fails with "has no exported member" even though it works under Metro.

**How to apply:** add an ambient module augmentation file (e.g.
`types/*.d.ts`) with a leading `import 'firebase/auth';` side-effect import
followed by `declare module 'firebase/auth' { export function
getReactNativePersistence(storage: any): any; }`. The leading import is
required — a bare `declare module` block without it replaces the module's
real types entirely instead of augmenting them, breaking every other
firebase/auth import in the project.
