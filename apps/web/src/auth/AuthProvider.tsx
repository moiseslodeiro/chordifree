import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  getAuthConfig,
  getAuthMe,
  setAuthToken,
  type AuthConfig,
  type AuthUser,
} from '../lib/api';

type AuthStatus = 'loading' | 'signed-out' | 'denied' | 'authenticated' | 'error';

interface AuthValue {
  mode: 'none' | 'google';
  status: AuthStatus;
  user: AuthUser | null;
  admin: boolean;
  config: AuthConfig | null;
  signIn: (credential: string) => Promise<void>;
  signOut: () => void;
  retry: () => void;
}

const SESSION_KEY = 'chordifree:id-token';

const LOCAL_AUTH: AuthValue = {
  mode: 'none',
  status: 'authenticated',
  user: null,
  admin: false,
  config: null,
  signIn: async () => undefined,
  signOut: () => undefined,
  retry: () => undefined,
};

const AuthContext = createContext<AuthValue>(LOCAL_AUTH);

export function useAuth(): AuthValue {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<'none' | 'google'>('none');
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [admin, setAdmin] = useState(false);
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [attempt, setAttempt] = useState(0);

  const clearSession = useCallback(() => {
    try {
      window.sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // Session storage can be unavailable in private modes.
    }
    setAuthToken(null);
    setUser(null);
    setAdmin(false);
  }, []);

  const verify = useCallback(
    async (token: string) => {
      setAuthToken(token);
      try {
        const me = await getAuthMe();
        setUser(me.user);
        setAdmin(me.admin);
        setStatus(me.allowed ? 'authenticated' : 'denied');
      } catch {
        clearSession();
        setStatus('signed-out');
      }
    },
    [clearSession],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setStatus('loading');
      let nextConfig: AuthConfig | null = null;
      try {
        nextConfig = await getAuthConfig();
      } catch {
        nextConfig = null;
      }
      if (cancelled) return;
      setConfig(nextConfig);
      if (!nextConfig || nextConfig.mode !== 'google' || !nextConfig.clientId) {
        setMode('none');
        setStatus('authenticated');
        setAuthToken(null);
        return;
      }
      setMode('google');
      let token: string | null = null;
      try {
        token = window.sessionStorage.getItem(SESSION_KEY);
      } catch {
        token = null;
      }
      if (token) {
        await verify(token);
      } else {
        setStatus('signed-out');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt, verify]);

  useEffect(() => {
    const onUnauthorized = () => {
      clearSession();
      setStatus('signed-out');
    };
    window.addEventListener('chordifree:unauthorized', onUnauthorized);
    return () => window.removeEventListener('chordifree:unauthorized', onUnauthorized);
  }, [clearSession]);

  const signIn = useCallback(
    async (credential: string) => {
      try {
        window.sessionStorage.setItem(SESSION_KEY, credential);
      } catch {
        // The token still works until the page is reloaded.
      }
      setStatus('loading');
      await verify(credential);
    },
    [verify],
  );

  const signOut = useCallback(() => {
    clearSession();
    setStatus('signed-out');
  }, [clearSession]);

  const value = useMemo<AuthValue>(
    () => ({
      mode,
      status,
      user,
      admin,
      config,
      signIn,
      signOut,
      retry: () => setAttempt((current) => current + 1),
    }),
    [admin, config, mode, signIn, signOut, status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
