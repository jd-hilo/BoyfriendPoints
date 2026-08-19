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
import { identifyPerson, resetPerson } from './analytics';
import { api, ApiError } from './api';
import { configurePushHandler, refreshPushTokenIfEnabled } from './push';
import {
  getCachedUser,
  getToken,
  setCachedUser,
  setSession,
  setToken,
} from './storage';

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
    const keepCached = async () => {
      const cached = await getCachedUser();
      if (cached) setUser(cached);
    };
    if (!(await getToken())) {
      // Missing token is a storage blip, not a logout. Keep whoever we have.
      await keepCached();
      return;
    }
    try {
      const me = await api.me();
      identifyPerson(me);
      setUser(me);
      await setCachedUser(me);
    } catch (err) {
      const status = err instanceof ApiError ? err.status : undefined;
      const unreachable = err instanceof ApiError && err.unreachable;
      if (unreachable || status === 404 || (status && status >= 500)) {
        await keepCached();
        return;
      }
      if (status === 401 || status === 403) {
        // Railway restarts drop in-memory tokens for a beat. Retry, then
        // stay on the cached session — never wipe the device token here.
        await new Promise((r) => setTimeout(r, 800));
        try {
          const me = await api.me();
          identifyPerson(me);
          setUser(me);
          await setCachedUser(me);
        } catch {
          await keepCached();
        }
        return;
      }
      await keepCached();
    }
  }, []);

  const applyUser = useCallback(async (next: PublicUser) => {
    identifyPerson(next);
    await setCachedUser(next);
    setUser(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // Do not mount authenticated screens from cache until `/me` has had a
      // chance to validate the persisted token. Mounting early makes every
      // screen fire protected requests during a Railway restart/token write.
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
    void configurePushHandler();
  }, []);

  useEffect(() => {
    if (!user) return;
    void refreshPushTokenIfEnabled(user.id);
  }, [user?.id]);

  const enterAs = useCallback(async (userId: string) => {
    const res = await api.enterAs(userId);
    await setSession(res.token, res.user);
    identifyPerson(res.user);
    setUser(res.user);
  }, []);

  const signInWithPassword = useCallback(
    async (email: string, password: string) => {
      const res = await api.login(email, password);
      await setSession(res.token, res.user);
      identifyPerson(res.user);
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
      await setSession(res.token, res.user);
      identifyPerson(res.user);
      setUser(res.user);
    },
    [],
  );

  const signInWithAppleToken = useCallback(
    async (idToken: string, name?: string) => {
      const res = await api.appleSession(idToken, name);
      await setSession(res.token, res.user);
      identifyPerson(res.user);
      setUser(res.user);
    },
    [],
  );

  const logout = useCallback(async () => {
    await api.logout().catch(() => undefined);
    resetPerson();
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
