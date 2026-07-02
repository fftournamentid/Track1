import React, {
  createContext, useContext, useState, useEffect, useCallback, ReactNode,
} from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '@/services/firebase/config';
import {
  subscribeToUserDocument,
  updateLastLogin,
  setUserRole,
  type UserDocument,
} from '@/services/firebase/repositories/user.repository';

const ADMIN_UID = 'kaqcXOcHHYU7VeSXdLMUR2E66vB3';

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

  const refreshUserDoc = useCallback(() => {}, []);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);

      setDocUnsub((prev) => {
        prev?.();
        return null;
      });

      if (firebaseUser) {
        const unsubDoc = subscribeToUserDocument(firebaseUser.uid, (doc) => {
          if (doc && firebaseUser.uid === ADMIN_UID && doc.role !== 'admin') {
            setUserRole(firebaseUser.uid, 'admin');
          }
          setUserDoc(doc);
          setIsLoading(false);
        });
        setDocUnsub(() => unsubDoc);
        updateLastLogin(firebaseUser.uid);
      } else {
        setUserDoc(null);
        setIsLoading(false);
      }
    });

    return () => {
      unsubAuth();
      setDocUnsub((prev) => {
        prev?.();
        return null;
      });
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
