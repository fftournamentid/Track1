import { getApps, getApp, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

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

// Note: this firebase SDK version (12.x) does not ship getReactNativePersistence
// for the plain "firebase" package on React Native, so getAuth(app) (in-memory
// persistence on native, browser persistence on web) is the correct call on
// every platform here. Do not "fix" this to initializeAuth() — that export
// doesn't exist in this build and importing it throws at module load.
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
