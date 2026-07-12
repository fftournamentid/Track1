import { getApps, getApp, initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence, type Auth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Fail LOUD and EARLY with a readable message instead of letting Firebase
// throw a cryptic "auth/invalid-api-key" deep inside a native release build
// where nobody can see console output. This is the #1 cause of "works in the
// Replit preview, crashes in the standalone APK" — EAS's cloud build servers
// don't inherit Replit's [userenv.shared] vars, so unless the same
// EXPO_PUBLIC_* values are also set in eas.json's per-profile "env" block (or
// as EAS project environment variables), they bundle as undefined.
const missingKeys = Object.entries(firebaseConfig)
  .filter(([, v]) => !v)
  .map(([k]) => k);
if (missingKeys.length > 0) {
  throw new Error(
    `[Firebase] Missing config values at build time: ${missingKeys.join(', ')}. ` +
    'These EXPO_PUBLIC_FIREBASE_* vars must be set wherever the JS bundle is built ' +
    '(eas.json build-profile "env", or EAS project env vars) — not just in the local dev environment.'
  );
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// ── Auth persistence ────────────────────────────────────────────────────────
// On native, Metro resolves `firebase/auth`'s internal `require('@firebase/auth')`
// to the React-Native-aware build (`@firebase/auth/dist/rn/index.js`) thanks to
// this project's Metro config — that build DOES export `getReactNativePersistence`.
// Calling plain `getAuth(app)` without first calling `initializeAuth()` with an
// explicit persistence logs a NO_PERSISTENCE_WARNING and silently falls back to
// in-memory auth, meaning the session is lost on every app restart. We must call
// `initializeAuth()` with AsyncStorage persistence before anything else touches
// `auth` for the session to actually survive restarts.
function createAuth(): Auth {
  if (Platform.OS === 'web') {
    // Web uses the browser build, which already defaults to durable
    // (indexedDB/localStorage) persistence via plain getAuth().
    return getAuth(app);
  }
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (e) {
    // initializeAuth() throws if an Auth instance already exists for this
    // app (e.g. Fast Refresh re-running this module) — reuse it instead of
    // crashing. This does not affect production cold-start behavior.
    console.warn('[Firebase] initializeAuth() fallback to getAuth():', e);
    return getAuth(app);
  }
}

export const auth = createAuth();
export const db = getFirestore(app);
export default app;
