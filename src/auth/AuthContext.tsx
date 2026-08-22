import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, signOut as fbSignOut, type User } from 'firebase/auth';
import { auth } from '../firebase/app';

interface AuthValue {
  user: User | null;
  loading: boolean;
  signInEmail: (email: string, password: string) => Promise<void>;
  signUpEmail: (email: string, password: string) => Promise<void>;
  signInGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthValue>({
  user: null,
  loading: true,
  signInEmail: async () => {},
  signUpEmail: async () => {},
  signInGoogle: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setUser(u);
        setLoading(false);
      }),
    [],
  );

  const signInEmail = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };
  const signUpEmail = async (email: string, password: string) => {
    await createUserWithEmailAndPassword(auth, email, password);
  };
  const signInGoogle = async () => {
    await signInWithPopup(auth, new GoogleAuthProvider());
  };
  const signOut = () => fbSignOut(auth);

  return <Ctx.Provider value={{ user, loading, signInEmail, signUpEmail, signInGoogle, signOut }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
