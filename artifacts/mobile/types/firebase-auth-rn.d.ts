/**
 * Ambient augmentation for `firebase/auth`.
 *
 * The bundled TypeScript declarations for `firebase/auth` are shared across
 * all platforms and do NOT declare `getReactNativePersistence`, even though
 * it exists at runtime in the React-Native-specific build that Metro
 * resolves via `@firebase/auth`'s `"react-native"` package.json field (see
 * `@firebase/auth/dist/rn/index.js`). Without this augmentation, importing
 * `getReactNativePersistence` from `firebase/auth` fails `tsc` with
 * "has no exported member" even though it works correctly under Metro.
 */
// The leading side-effect import (rather than a bare ambient block) is
// required so TypeScript treats this file as a *module augmentation* of the
// existing `firebase/auth` types instead of a full replacement that would
// wipe out all of its real exports (getAuth, onAuthStateChanged, User, etc.).
import 'firebase/auth';

declare module 'firebase/auth' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function getReactNativePersistence(storage: any): any;
}
