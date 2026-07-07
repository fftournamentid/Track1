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

// SQLite session keys
const SESSION_USER_DOC = 'auth:user_doc';

interface AuthContextType {
  user: User | null;
  userDoc: UserDocument | null;
  isLoading: boolean;
  refreshUserDoc: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userDoc, setUserDoc] = useState<UserDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [docUnsub, setDocUnsub] = useState<(() => void) | null>(null);

  /**
   * Monotonic counter — incremented on every `onAuthStateChanged` invocation.
   * Async callbacks capture `epoch` at the start; they bail if it no longer
   * matches `authEpochRef.current` by the time they try to write state.
   */
  const authEpochRef = useRef(0);

  const refreshUserDoc = useCallback(() => {}, []);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      // Capture this event's epoch BEFORE any await
      const epoch = ++authEpochRef.current;

      setUser(firebaseUser);

      // Tear down the previous Firestore subscription synchronously
      setDocUnsub((prev) => { prev?.(); return null; });

      if (firebaseUser) {
        // ── FAST PATH: restore userDoc from SQLite cache ─────────────────────
        // Clears isLoading before the Firestore round-trip, so the app is
        // immediately interactive on every subsequent launch.
        try {
          const cached = await getSessionJSON<UserDocument | null>(SESSION_USER_DOC, null);
          // Bail if a newer auth event arrived while we were awaiting SQLite
          if (epoch !== authEpochRef.current) return;

          if (cached) {
            setUserDoc(cached);
            setIsLoading(false);
            console.log('[AuthContext] ✓ Session restored from SQLite cache');
          }
        } catch (cacheErr) {
          if (epoch !== authEpochRef.current) return;
          console.warn('[AuthContext] SQLite cache read failed (non-fatal):', cacheErr);
        }

        // ── LIVE PATH: Firestore subscription in the background ──────────────
        const unsubDoc = subscribeToUserDocument(firebaseUser.uid, async (doc) => {
          // Drop this callback if a newer auth event has already superseded it
          if (epoch !== authEpochRef.current) {
            console.log('[AuthContext] Dropping stale Firestore callback (epoch mismatch)');
            return;
          }

          // Promote hardcoded admin if role is missing
          if (doc && firebaseUser.uid === ADMIN_UID && doc.role !== 'admin') {
            setUserRole(firebaseUser.uid, 'admin');
          }

          setUserDoc(doc);
          setIsLoading(false); // ensures loading clears even if no SQLite cache

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
        // registering the unsubscribe, cancel it immediately.
        if (epoch !== authEpochRef.current) {
          unsubDoc();
          return;
        }

        setDocUnsub(() => unsubDoc);
        updateLastLogin(firebaseUser.uid);

      } else {
        // ── SIGN-OUT / TOKEN EXPIRY ──────────────────────────────────────────
        setUserDoc(null);
        setIsLoading(false);

        removeSessionValue(SESSION_USER_DOC).catch((err) =>
          console.warn('[AuthContext] SQLite cache clear failed (non-fatal):', err),
        );

        console.log('[AuthContext] Session cleared (sign-out / token expiry)');
      }
    });

    return () => {
      unsubAuth();
      setDocUnsub((prev) => { prev?.(); return null; });
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, userDoc, isLoading, refreshUserDoc }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
