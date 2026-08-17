import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';
import type { PublicUser } from './types';
import { api, ApiError } from './api';
import { registerPushToken } from './push';
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
      return;
    }
    const keepCached = async () => {
      const cached = await getCachedUser();
      if (cached) setUser(cached);
    };
    const transient = (err: unknown) => {
      const status = err instanceof ApiError ? err.status : undefined;
      const unreachable = err instanceof ApiError && err.unreachable;
      return Boolean(unreachable || status === 404 || (status && status >= 500));
    };
    try {
      const me = await api.me();
      setUser(me);
      await setCachedUser(me);
    } catch (err) {
      if (transient(err)) {
        await keepCached();
        return;
      }
      const status = err instanceof ApiError ? err.status : undefined;
      if (status !== 401 && status !== 403) return;
      // Railway deploys restart the in-memory API; the first /me can 401
      // before tokens are loaded. Retry before treating it as a sign-out.
      await new Promise((r) => setTimeout(r, 800));
      try {
        const me = await api.me();
        setUser(me);
        await setCachedUser(me);
      } catch (retryErr) {
        if (transient(retryErr)) {
          await keepCached();
          return;
        }
        await keepCached();
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

  // Points move on the other partner's phone, so re-read the session whenever
  // this one comes back to the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  useEffect(() => {
    if (!user) return;
    void registerPushToken();
  }, [user?.id]);

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
