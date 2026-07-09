/**
 * AuthContext.tsx — Forever-login session with SQLite cache
 * ─────────────────────────────────────────────────────────────────────────────
 * Phase 3 additions:
 *   • On every Firestore userDoc update, the document is written to SQLite
 *     (`auth:user_doc` key in user_session table).
 *   • On app boot, `onAuthStateChanged` fires quickly (Firebase AsyncStorage
 *     persistence). We immediately read the SQLite cache and populate userDoc
 *     so the app is fully interactive before the Firestore snapshot arrives.
 *   • `isLoading` is cleared as soon as we have EITHER the SQLite-cached doc
 *     OR the live Firestore doc — eliminating the cold-start loading flash.
 *   • On sign-out (Firebase fires `null`), SQLite cache is cleared automatically.
 *   • Premium status is mirrored to syncCreditsService on every userDoc update
 *     so the credit gate works offline.
 *
 * Race-condition guard:
 *   Each `onAuthStateChanged` invocation increments a monotonic epoch counter.
 *   All async continuations (SQLite reads, Firestore snapshot callbacks) compare
 *   their captured epoch to the current value before mutating state or writing
 *   to SQLite. If a newer auth event has arrived, stale callbacks are silently
 *   dropped and their Firestore subscriptions are immediately unsubscribed.
 *
 * StrictMode safety:
 *   The Firestore unsubscribe function is stored in a plain `useRef` — NOT
 *   `useState`. React's useState setter treats function arguments as state
 *   UPDATER CALLBACKS and calls them twice in StrictMode (development) with
 *   the same previous state to detect side effects. Storing an unsubscribe in
 *   useState and tearing it down via `setState(prev => { prev?.(); return null })`
 *   therefore calls the real Firestore unsubscribe TWICE, killing the listener
 *   before it can ever fire setIsLoading(false) — causing the infinite spinner.
 *   A ref is mutated directly and is never subject to React's double-invocation.
 *
 * Safety timeout:
 *   If Firestore doesn't respond within 10 seconds (network issue, permission
 *   error, cold-start delay), `isLoading` is forced to `false` so the user
 *   is never permanently blocked on the orange splash screen.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import React, {
  createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode,
} from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '@/services/firebase/config';
import {
  subscribeToUserDocument,
  updateLastLogin,
  setUserRole,
  type UserDocument,
} from '@/services/firebase/repositories/user.repository';
import {
  getSessionJSON,
  setSessionJSON,
  removeSessionValue,
} from '@/services/sqliteService';
import { cachePremiumStatus, initUserCredits } from '@/services/syncCreditsService';

const ADMIN_UID = 'kaqcXOcHHYU7VeSXdLMUR2E66vB3';

// How long to wait for Firestore before force-clearing the loading state.
const FIRESTORE_TIMEOUT_MS = 10_000;

// SQLite session keys
const SESSION_USER_DOC = 'auth:user_doc';

interface AuthContextType {
  user: User | null;
  userDoc: UserDocument | null;
  isLoading: boolean;
  /**
   * True once Firestore has fired at least one snapshot for the current session.
   * False while only the SQLite cache has been restored (which may be stale —
   * e.g. a freshly-promoted admin whose cache pre-dates the role write).
   * Route guards that depend on role (admin access) must not redirect until
   * this is true, or they will make decisions based on stale cached data.
   */
  isRoleConfirmed: boolean;
  refreshUserDoc: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userDoc, setUserDoc] = useState<UserDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Starts false; set to true only after Firestore fires its first live snapshot.
  // Role-dependent route guards must not act until this is true.
  const [isRoleConfirmed, setIsRoleConfirmed] = useState(false);

  /**
   * Monotonic counter — incremented on every `onAuthStateChanged` invocation.
   * Async callbacks capture `epoch` at the start; they bail if it no longer
   * matches `authEpochRef.current` by the time they try to write state.
   */
  const authEpochRef = useRef(0);

  /**
   * Plain ref for the active Firestore user-document unsubscribe function.
   *
   * MUST be a ref, not useState. React calls useState updater functions TWICE
   * in StrictMode (development) with the same previous value to surface side
   * effects. Storing the unsub in state and tearing it down via
   *   `setState(prev => { prev?.(); return null })`
   * would invoke the real Firestore unsubscribe twice, killing the listener
   * before it can emit the first snapshot and clear isLoading.
   */
  const docUnsubRef = useRef<(() => void) | null>(null);

  const refreshUserDoc = useCallback(() => {}, []);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      // ── Capture epoch BEFORE any await ────────────────────────────────────
      const epoch = ++authEpochRef.current;

      // Cancel the previous Firestore subscription synchronously via the ref
      // (never via a state setter — see StrictMode note above).
      docUnsubRef.current?.();
      docUnsubRef.current = null;

      // Reset role confirmation on every auth event — sign-out, sign-in, token
      // refresh. This ensures _layout's redirect gate never acts on role state
      // from a previous user's session.  It is re-set to `true` below only when
      // the Firestore snapshot for the CURRENT auth epoch fires successfully.
      setIsRoleConfirmed(false);

      setUser(firebaseUser);

      if (firebaseUser) {
        // ── Safety timeout ─────────────────────────────────────────────────
        // If Firestore never responds (network hiccup, cold start, permission
        // error) this timer ensures the orange splash screen doesn't hang
        // forever. It is cancelled as soon as Firestore fires its first event.
        const safetyTimer = setTimeout(() => {
          if (epoch !== authEpochRef.current) return;
          console.warn(
            `[AuthContext] ⚠ Firestore did not respond within ${FIRESTORE_TIMEOUT_MS / 1000}s` +
            ' — forcing isLoading=false so the app stays usable.',
          );
          setIsLoading(false);
        }, FIRESTORE_TIMEOUT_MS);

        // ── FAST PATH: restore userDoc from SQLite cache ───────────────────
        // Clears isLoading before the Firestore round-trip, so the app is
        // immediately interactive on every subsequent launch.
        try {
          const cached = await getSessionJSON<UserDocument | null>(SESSION_USER_DOC, null);

          // Bail if a newer auth event arrived while we were awaiting SQLite
          if (epoch !== authEpochRef.current) {
            clearTimeout(safetyTimer);
            return;
          }

          if (cached) {
            setUserDoc(cached);
            setIsLoading(false);
            console.log('[AuthContext] ✓ Session restored from SQLite cache');
          }
        } catch (cacheErr) {
          if (epoch !== authEpochRef.current) {
            clearTimeout(safetyTimer);
            return;
          }
          console.warn('[AuthContext] SQLite cache read failed (non-fatal):', cacheErr);
        }

        // ── LIVE PATH: Firestore subscription in the background ────────────
        const unsubDoc = subscribeToUserDocument(firebaseUser.uid, async (doc) => {
          // Firestore responded — cancel the safety timer
          clearTimeout(safetyTimer);

          // Drop this callback if a newer auth event has already superseded it
          if (epoch !== authEpochRef.current) {
            console.log('[AuthContext] Dropping stale Firestore callback (epoch mismatch)');
            return;
          }

          // Promote hardcoded admin if role is missing in Firestore.
          // IMPORTANT: also patch the in-memory doc immediately so the layout
          // does NOT see role=undefined on this first snapshot and redirect the
          // user away from the admin panel before the Firestore write settles.
          let processedDoc = doc;
          if (processedDoc && firebaseUser.uid === ADMIN_UID && processedDoc.role !== 'admin') {
            processedDoc = { ...processedDoc, role: 'admin' } as typeof processedDoc;
            setUserRole(firebaseUser.uid, 'admin').catch((err) =>
              console.warn('[AuthContext] Failed to persist admin role:', err),
            );
          }

          setUserDoc(processedDoc);
          // Signal that a live Firestore snapshot has confirmed the role.
          // Route guards that depend on role (admin access) must wait for this
          // before making redirect decisions — the SQLite cache may be stale.
          setIsRoleConfirmed(true);
          setIsLoading(false); // ensures loading clears even if SQLite cache was empty

          if (doc) {
            // Persist fresh userDoc to SQLite (forever login state)
            setSessionJSON<UserDocument>(SESSION_USER_DOC, doc).catch((err) =>
              console.warn('[AuthContext] SQLite write failed (non-fatal):', err),
            );

            // Mirror premium status offline for the credit gate
            cachePremiumStatus(firebaseUser.uid, doc.isPremium).catch(() => {});

            // Ensure credit bucket is initialised (idempotent)
            initUserCredits(firebaseUser.uid).catch(() => {});
          }
        });

        // If a newer auth event arrived between starting the subscription and
        // receiving its handle back, cancel it immediately.
        if (epoch !== authEpochRef.current) {
          clearTimeout(safetyTimer);
          unsubDoc();
          return;
        }

        // Store via ref — safe from StrictMode double-invocation
        docUnsubRef.current = unsubDoc;
        updateLastLogin(firebaseUser.uid);

      } else {
        // ── SIGN-OUT / TOKEN EXPIRY ──────────────────────────────────────────
        setUserDoc(null);
        setIsRoleConfirmed(false); // explicit reset; the top-of-callback reset covers this too
        setIsLoading(false);

        removeSessionValue(SESSION_USER_DOC).catch((err) =>
          console.warn('[AuthContext] SQLite cache clear failed (non-fatal):', err),
        );

        console.log('[AuthContext] Session cleared (sign-out / token expiry)');
      }
    });

    return () => {
      unsubAuth();
      // Tear down the Firestore listener directly via the ref — no state setter
      docUnsubRef.current?.();
      docUnsubRef.current = null;
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, userDoc, isLoading, isRoleConfirmed, refreshUserDoc }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
