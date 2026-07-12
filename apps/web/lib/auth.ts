// 토큰 저장/조회 — sessionStorage 기반(클라이언트 전용).
// sessionStorage 는 브라우저(탭)를 닫으면 사라지므로, 크롬을 완전히 껐다 켜면
// 세션이 소멸돼 재로그인이 필요하다(localStorage 처럼 재시작 후 자동 로그인되지 않음).
// SSR에서는 토큰 미존재로 간주(보호 라우트는 클라이언트에서 가드).
//
// ⚠ 크롬 "시작 시 이전 탭 복원"(continue where you left off)을 켜두면 크롬이
//    sessionStorage 까지 복원할 수 있어 세션이 유지될 수 있다. 이는 sessionStorage
//    자체의 동작이며, 완전한 강제 재인증이 필요하면 리프레시 토큰 수명 단축을 병행한다.

import type { User } from './types';

const ACCESS_KEY = 'gx.accessToken';
const REFRESH_KEY = 'gx.refreshToken';
const USER_KEY = 'gx.user';

const isBrowser = typeof window !== 'undefined';

// 이전 버전(localStorage 저장)에서 남은 세션 키를 1회 정리.
// 재시작 후에도 남아 자동 로그인시키던 리프레시 토큰을 제거해 동작·노출면을 정리한다.
// (gx.savedEmail 등 편의 키는 localStorage 에 그대로 둔다 — 여기서 건드리지 않음.)
function purgeLegacyLocalStorage(): void {
  if (!isBrowser) return;
  try {
    window.localStorage.removeItem(ACCESS_KEY);
    window.localStorage.removeItem(REFRESH_KEY);
    window.localStorage.removeItem(USER_KEY);
  } catch {
    /* localStorage 접근 불가(프라이빗 모드 등) — 무시 */
  }
}
if (isBrowser) purgeLegacyLocalStorage();

export function getAccessToken(): string | null {
  if (!isBrowser) return null;
  return window.sessionStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  if (!isBrowser) return null;
  return window.sessionStorage.getItem(REFRESH_KEY);
}

export function getStoredUser(): User | null {
  if (!isBrowser) return null;
  const raw = window.sessionStorage.getItem(USER_KEY);
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
  window.sessionStorage.setItem(ACCESS_KEY, tokens.accessToken);
  window.sessionStorage.setItem(REFRESH_KEY, tokens.refreshToken);
  if (user) window.sessionStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function setStoredUser(user: User): void {
  if (!isBrowser) return;
  window.sessionStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  if (!isBrowser) return;
  window.sessionStorage.removeItem(ACCESS_KEY);
  window.sessionStorage.removeItem(REFRESH_KEY);
  window.sessionStorage.removeItem(USER_KEY);
}

export function authHeader(): Record<string, string> {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
