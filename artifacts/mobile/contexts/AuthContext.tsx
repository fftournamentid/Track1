/**
 * AuthContext.tsx — Forever-login session with SQLite cache
 */
import React, {
  createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode,
} from 'react';
import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '@/services/firebase/config';
import { signOut } from '@/services/firebase/auth.service';
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
  deleteLocalInvoicesForUser,
} from '@/services/sqliteService';
import { initUserCredits } from '@/services/syncCreditsService';
import { setDraftUid } from '@/services/draftService';
import { getPendingSync } from '@/services/syncQueue';
import { log } from '@/utils/logger';

const ADMIN_UID = 'kaqcXOcHHYU7VeSXdLMUR2E66vB3';

// How long to wait for Firestore before force-clearing the loading state.
const FIRESTORE_TIMEOUT_MS = 10_000;

// SQLite session keys
const SESSION_USER_DOC = 'auth:user_doc';

interface AuthContextType {
  user: User | null;
  userDoc: UserDocument | null;
  isLoading: boolean;
  isRoleConfirmed: boolean;
  refreshUserDoc: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userDoc, setUserDoc] = useState<UserDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRoleConfirmed, setIsRoleConfirmed] = useState(false);

  const authEpochRef = useRef(0);
  const docUnsubRef = useRef<(() => void) | null>(null);

  const refreshUserDoc = useCallback(() => {}, []);

  const logout = useCallback(async () => {
    if (!user) {
      await signOut();
      return;
    }

    const uid = user.uid;
    const pending = await getPendingSync(uid).catch(() => []);

    const performLogout = async () => {
      try {
        await AsyncStorage.multiRemove([
          `@FleetInvoice:cft_records:${uid}`,
          `@FleetInvoice:freight_records:${uid}`,
        ]);
        await deleteLocalInvoicesForUser(uid);
      } catch (err) {
        log.warn('Cleanup during logout failed (non-fatal)');
      }
      await signOut();
    };

    if (pending.length > 0) {
      const msg = `You have ${pending.length} invoice${pending.length === 1 ? '' : 's'} not synced. Logging out will remove ${pending.length === 1 ? 'it' : 'them'} from this phone.`;
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.confirm(msg)) {
          await performLogout();
        }
      } else {
        Alert.alert('Unsynced Invoices', msg, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Logout Anyway', style: 'destructive', onPress: performLogout },
        ]);
      }
    } else {
      await performLogout();
    }
  }, [user]);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      const epoch = ++authEpochRef.current;

      docUnsubRef.current?.();
      docUnsubRef.current = null;

      setIsRoleConfirmed(false);
      setUser(firebaseUser);

      if (firebaseUser) {
        setDraftUid(firebaseUser.uid);
        const safetyTimer = setTimeout(() => {
          if (epoch !== authEpochRef.current) return;
          log.warn('Firestore did not respond within timeout — forcing isLoading=false');
          setIsLoading(false);
          setIsRoleConfirmed(true);
        }, FIRESTORE_TIMEOUT_MS);

        try {
          const cached = await getSessionJSON<UserDocument | null>(SESSION_USER_DOC, null);

          if (epoch !== authEpochRef.current) {
            clearTimeout(safetyTimer);
            return;
          }

          if (cached) {
            let processedCache = cached;
            if (firebaseUser.uid === ADMIN_UID && processedCache.role !== 'admin') {
              processedCache = { ...processedCache, role: 'admin' } as typeof processedCache;
            }
            setUserDoc(processedCache);
            if (firebaseUser.uid === ADMIN_UID) {
              setIsRoleConfirmed(true);
            }
            log.debug('Session restored from SQLite cache');
          }
        } catch (cacheErr) {
          if (epoch !== authEpochRef.current) {
            clearTimeout(safetyTimer);
            return;
          }
          log.warn('SQLite cache read failed (non-fatal)');
        }

        setIsLoading(false);

        let roleConfirmTimerId: ReturnType<typeof setTimeout> | null = null;
        let firestoreResponded = false;

        const unsubDoc = subscribeToUserDocument(firebaseUser.uid, async (doc) => {
          firestoreResponded = true;
          clearTimeout(safetyTimer);
          if (roleConfirmTimerId !== null) clearTimeout(roleConfirmTimerId);

          if (epoch !== authEpochRef.current) {
            log.debug('Dropping stale Firestore callback (epoch mismatch)');
            return;
          }

          let processedDoc = doc;
          if (processedDoc && firebaseUser.uid === ADMIN_UID && processedDoc.role !== 'admin') {
            processedDoc = { ...processedDoc, role: 'admin' } as typeof processedDoc;
            setUserRole(firebaseUser.uid, 'admin').catch(() =>
              log.warn('Failed to persist admin role')
            );
          }

          setUserDoc(processedDoc);
          setIsRoleConfirmed(true);
          setIsLoading(false);

          if (doc) {
            setSessionJSON<UserDocument>(SESSION_USER_DOC, doc).catch(() =>
              log.warn('SQLite write failed (non-fatal)')
            );

            // Ensure credit bucket is initialised (idempotent)
            initUserCredits(firebaseUser.uid).catch(() => {});
          }
        });

        roleConfirmTimerId = setTimeout(() => {
          if (epoch !== authEpochRef.current) return;
          if (firestoreResponded) return;
          log.warn('Firestore role not confirmed within 4.5 s — unblocking with cached data.');
          setIsRoleConfirmed(true);
        }, 4_500);

        if (epoch !== authEpochRef.current) {
          clearTimeout(safetyTimer);
          if (roleConfirmTimerId !== null) clearTimeout(roleConfirmTimerId);
          unsubDoc();
          return;
        }

        docUnsubRef.current = unsubDoc;
        updateLastLogin(firebaseUser.uid);

      } else {
        setDraftUid(undefined);
        setUserDoc(null);
        setIsRoleConfirmed(false);
        setIsLoading(false);

        removeSessionValue(SESSION_USER_DOC).catch(() =>
          log.warn('SQLite cache clear failed (non-fatal)')
        );

        log.debug('Session cleared (sign-out / token expiry)');
      }
    });

    return () => {
      unsubAuth();
      docUnsubRef.current?.();
      docUnsubRef.current = null;
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, userDoc, isLoading, isRoleConfirmed, refreshUserDoc, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
