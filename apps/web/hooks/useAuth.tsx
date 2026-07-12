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
import { isSsoMode, ssoLogout } from '@/lib/oidc';
import type { ChangePasswordResponse, LoginResponse, User } from '@/lib/types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  // SSO 콜백 등 컨텍스트 밖에서 받은 세션을 저장 + 메모리 user 반영.
  // 이걸 안 쓰고 setSession 만 하면 가드가 보는 in-memory user 가 갱신 안 돼
  // 로그인 직후 /login 으로 튕긴다(재로그인 필요) — 그 경로를 막는다.
  establishSession: (session: {
    accessToken: string;
    refreshToken: string;
    user: User;
  }) => void;
  // Item1: 비밀번호 변경 — 성공 시 새 토큰 교체 + mustChangePassword=false 반영.
  changePassword: (current: string, next: string) => Promise<void>;
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

  const establishSession = useCallback(
    (session: { accessToken: string; refreshToken: string; user: User }) => {
      setSession(
        { accessToken: session.accessToken, refreshToken: session.refreshToken },
        session.user,
      );
      setUser(session.user);
    },
    [],
  );

  const changePassword = useCallback(
    async (current: string, next: string) => {
      const res = await apiPost<ChangePasswordResponse>('/auth/change-password', {
        currentPassword: current,
        newPassword: next,
      });
      // 새 토큰으로 세션 교체(mustChangePassword=false 반영된 user 포함).
      setSession(
        { accessToken: res.accessToken, refreshToken: res.refreshToken },
        res.user,
      );
      setUser(res.user);
    },
    [],
  );

  const logout = useCallback(() => {
    // 무상태 로그아웃 — 서버 호출 실패해도 로컬 세션은 정리.
    apiPost<{ ok: boolean }>('/auth/logout').catch(() => undefined);
    clearSession();
    setUser(null);
    if (isSsoMode()) {
      // Keycloak 으로 리다이렉트 → post_logout_redirect_uri(/login) 로 복귀.
      // 로컬 정리를 먼저 한 뒤 호출한다(이 아래 코드는 실행되지 않는다).
      void ssoLogout();
      return;
    }
    router.replace('/login');
  }, [router]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, establishSession, changePassword, logout }),
    [user, loading, login, establishSession, changePassword, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth는 AuthProvider 안에서만 사용해요.');
  return ctx;
}
