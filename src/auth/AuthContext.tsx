import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut as fbSignOut, type User } from 'firebase/auth';
import { auth } from '../firebase/app';
import { roleFromClaims, type Role } from './claims';

interface AuthValue {
  user: User | null;
  role: Role | null;
  loading: boolean;
  signInAdmin: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthValue>({
  user: null,
  role: null,
  loading: true,
  signInAdmin: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(
    () =>
      onAuthStateChanged(auth, async (u) => {
        if (!u) {
          setUser(null);
          setRole(null);
          setLoading(false);
          return;
        }
        try {
          const token = await u.getIdTokenResult();
          setUser(u);
          setRole(roleFromClaims(token.claims as Record<string, unknown>));
        } catch {
          // A network blip reading claims must not wedge the app on the loading gate.
          setUser(u);
          setRole(null);
        } finally {
          setLoading(false);
        }
      }),
    [],
  );

  const signInAdmin = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };
  const signOut = () => fbSignOut(auth);

  return <Ctx.Provider value={{ user, role, loading, signInAdmin, signOut }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
