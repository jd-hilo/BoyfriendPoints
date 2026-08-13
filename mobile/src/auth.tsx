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
import { api, ApiError } from './api';
import { getCachedUser, getToken, setCachedUser, setToken } from './storage';

interface AuthContextValue {
  user: PublicUser | null;
  loading: boolean;
  enterAs: (userId: string) => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUpWithPassword: (
    name: string,
    email: string,
    password: string,
    role?: 'wife' | 'boyfriend',
    coupleUsername?: string,
  ) => Promise<void>;
  signInWithAppleToken: (idToken: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  applyUser: (user: PublicUser) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!(await getToken())) {
      setUser(null);
      await setCachedUser(null);
      return;
    }
    try {
      const me = await api.me();
      setUser(me);
      await setCachedUser(me);
    } catch (err) {
      // Stay signed in on network blips so incomplete onboarding can resume.
      // Only clear the session on a real auth rejection.
      const status = err instanceof ApiError ? err.status : undefined;
      const unreachable = err instanceof ApiError && err.unreachable;
      if (unreachable) {
        const cached = await getCachedUser();
        if (cached) setUser(cached);
        return;
      }
      if (status === 401 || status === 403) {
        await setToken(null);
        await setCachedUser(null);
        setUser(null);
      }
    }
  }, []);

  const applyUser = useCallback(async (next: PublicUser) => {
    await setCachedUser(next);
    setUser(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const token = await getToken();
      if (token) {
        const cached = await getCachedUser();
        if (!cancelled && cached) {
          setUser(cached);
          setLoading(false);
        }
      }
      await refresh();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const enterAs = useCallback(async (userId: string) => {
    const res = await api.enterAs(userId);
    await setToken(res.token);
    await setCachedUser(res.user);
    setUser(res.user);
  }, []);

  const signInWithPassword = useCallback(
    async (email: string, password: string) => {
      const res = await api.login(email, password);
      await setToken(res.token);
      await setCachedUser(res.user);
      setUser(res.user);
    },
    [],
  );

  const signUpWithPassword = useCallback(
    async (
      name: string,
      email: string,
      password: string,
      role: 'wife' | 'boyfriend' = 'wife',
      coupleUsername?: string,
    ) => {
      const res = await api.signup(
        name,
        email,
        password,
        role,
        coupleUsername,
      );
      if (!res.token) throw new Error('Signup succeeded but no session token');
      // Token must be stored before any follow-up authenticated call.
      await setToken(res.token);
      await setCachedUser(res.user);
      setUser(res.user);
    },
    [],
  );

  const signInWithAppleToken = useCallback(
    async (idToken: string, name?: string) => {
      const res = await api.appleSession(idToken, name);
      await setToken(res.token);
      await setCachedUser(res.user);
      setUser(res.user);
    },
    [],
  );

  const logout = useCallback(async () => {
    await api.logout().catch(() => undefined);
    await setToken(null);
    await setCachedUser(null);
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
      applyUser,
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
      applyUser,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
