import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { PublicUser } from '../shared/types.ts';
import { identifyPerson, resetPerson } from './analytics.ts';
import { api, getCachedUser, getToken, setCachedUser, setToken } from './api.ts';
import { neonIdToken, neonSignOut } from './neonAuth.ts';

interface AuthContextValue {
  user: PublicUser | null;
  loading: boolean;
  enterAs: (userId: string) => Promise<void>;
  signInWithNeonToken: () => Promise<void>;
  signInWithAppleToken: (idToken: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  applyUser: (user: PublicUser) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      const cached = getCachedUser();
      if (cached) setUser(cached);
      return;
    }
    try {
      const me = await api.me();
      identifyPerson(me);
      setUser(me);
      setCachedUser(me);
    } catch {
      const cached = getCachedUser();
      if (cached) setUser(cached);
    }
  }, []);

  useEffect(() => {
    const cached = getCachedUser();
    if (cached && getToken()) {
      identifyPerson(cached);
      setUser(cached);
    }
    void refresh().finally(() => setLoading(false));
  }, [refresh]);

  const applyUser = useCallback((next: PublicUser) => {
    identifyPerson(next);
    setCachedUser(next);
    setUser(next);
  }, []);

  const enterAs = useCallback(async (userId: string) => {
    const res = await api.enterAs(userId);
    setToken(res.token);
    identifyPerson(res.user);
    setCachedUser(res.user);
    setUser(res.user);
  }, []);

  const signInWithNeonToken = useCallback(async () => {
    const idToken = await neonIdToken();
    const res = await api.neonSession(idToken);
    setToken(res.token);
    identifyPerson(res.user);
    setCachedUser(res.user);
    setUser(res.user);
  }, []);

  const signInWithAppleToken = useCallback(
    async (idToken: string, name?: string) => {
      const res = await api.appleSession(idToken, name);
      setToken(res.token);
      identifyPerson(res.user);
      setCachedUser(res.user);
      setUser(res.user);
    },
    [],
  );

  const logout = useCallback(async () => {
    await api.logout().catch(() => undefined);
    await neonSignOut();
    resetPerson();
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      enterAs,
      signInWithNeonToken,
      signInWithAppleToken,
      logout,
      refresh,
      applyUser,
    }),
    [
      user,
      loading,
      enterAs,
      signInWithNeonToken,
      signInWithAppleToken,
      logout,
      refresh,
      applyUser,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
