import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { PublicUser } from './types';
import { api } from './api';
import { getToken, setToken } from './storage';

interface AuthContextValue {
  user: PublicUser | null;
  loading: boolean;
  enterAs: (userId: string) => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUpWithPassword: (
    name: string,
    email: string,
    password: string,
  ) => Promise<void>;
  signInWithAppleToken: (idToken: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!(await getToken())) {
      setUser(null);
      return;
    }
    try {
      setUser(await api.me());
    } catch {
      await setToken(null);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    void refresh().finally(() => setLoading(false));
  }, [refresh]);

  const enterAs = useCallback(async (userId: string) => {
    const res = await api.enterAs(userId);
    await setToken(res.token);
    setUser(res.user);
  }, []);

  const signInWithPassword = useCallback(
    async (email: string, password: string) => {
      const res = await api.login(email, password);
      await setToken(res.token);
      setUser(res.user);
    },
    [],
  );

  const signUpWithPassword = useCallback(
    async (name: string, email: string, password: string) => {
      const res = await api.signup(name, email, password);
      await setToken(res.token);
      setUser(res.user);
    },
    [],
  );

  const signInWithAppleToken = useCallback(
    async (idToken: string, name?: string) => {
      const res = await api.appleSession(idToken, name);
      await setToken(res.token);
      setUser(res.user);
    },
    [],
  );

  const logout = useCallback(async () => {
    await api.logout().catch(() => undefined);
    await setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      enterAs,
      signInWithPassword,
      signUpWithPassword,
      signInWithAppleToken,
      logout,
      refresh,
    }),
    [
      user,
      loading,
      enterAs,
      signInWithPassword,
      signUpWithPassword,
      signInWithAppleToken,
      logout,
      refresh,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
