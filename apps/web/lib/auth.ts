// 토큰 저장/조회 — localStorage 기반(클라이언트 전용).
// SSR에서는 토큰 미존재로 간주(보호 라우트는 클라이언트에서 가드).

import type { User } from './types';

const ACCESS_KEY = 'gx.accessToken';
const REFRESH_KEY = 'gx.refreshToken';
const USER_KEY = 'gx.user';

const isBrowser = typeof window !== 'undefined';

export function getAccessToken(): string | null {
  if (!isBrowser) return null;
  return window.localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  if (!isBrowser) return null;
  return window.localStorage.getItem(REFRESH_KEY);
}

export function getStoredUser(): User | null {
  if (!isBrowser) return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function setSession(
  tokens: { accessToken: string; refreshToken: string },
  user?: User,
): void {
  if (!isBrowser) return;
  window.localStorage.setItem(ACCESS_KEY, tokens.accessToken);
  window.localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
  if (user) window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function setStoredUser(user: User): void {
  if (!isBrowser) return;
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  if (!isBrowser) return;
  window.localStorage.removeItem(ACCESS_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
  window.localStorage.removeItem(USER_KEY);
}

export function authHeader(): Record<string, string> {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
