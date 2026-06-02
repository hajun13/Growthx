'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import { apiPost, apiGet, ApiError } from '@/lib/api';
import {
  clearSession,
  getAccessToken,
  getStoredUser,
  setSession,
  setStoredUser,
} from '@/lib/auth';
import type { LoginResponse, User } from '@/lib/types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // 마운트 시: 저장 토큰 있으면 /auth/me 로 사용자 동기화.
  useEffect(() => {
    let cancelled = false;
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    // 우선 저장값으로 즉시 표시(깜빡임 방지) 후 검증.
    const stored = getStoredUser();
    if (stored) setUser(stored);

    apiGet<User>('/auth/me')
      .then((me) => {
        if (cancelled) return;
        setUser(me);
        setStoredUser(me);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.isUnauthorized) {
          clearSession();
          setUser(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await apiPost<LoginResponse>(
        '/auth/login',
        { email, password },
        { skipAuth: true },
      );
      setSession(
        { accessToken: res.accessToken, refreshToken: res.refreshToken },
        res.user,
      );
      setUser(res.user);
    },
    [],
  );

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
    router.replace('/login');
  }, [router]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, logout }),
    [user, loading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth는 AuthProvider 안에서만 사용해요.');
  return ctx;
}
