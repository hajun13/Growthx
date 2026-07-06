// fetch 래퍼 — 봉투를 한 곳에서 unwrap.
// 성공: { data } 또는 { data, meta } 반환. 실패: ApiError throw.
// 절대 응답을 배열로 가정하지 않는다(.filter is not a function 방지).

import { authHeader, getRefreshToken, setSession, clearSession } from './auth';
import type { ApiErrorBody, Meta } from './types';
// ⚠ ApiError 는 생성 클라이언트(mutator)가 던지는 것과 **동일 클래스**여야 한다.
// 별도 클래스로 두면 `err instanceof ApiError` 검사가 codegen 경로 에러에서 전부
// 미스매치되어 status/code 가 소실된다. contracts 의 것을 단일 소스로 재수출한다.
import { ApiError } from '@growthx/contracts';

export { ApiError };

// 브라우저에선 same-origin('/api/v1' rewrite/프록시), SSR/직접 호출은 절대 URL.
const RAW_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ?? '';
const PREFIX = '/api/v1';

function buildUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${RAW_BASE}${PREFIX}${p}`;
}

/**
 * 세션 만료(refresh 불가) 처리 — 로컬 세션 정리 + 로그인으로 하드 리다이렉트.
 * 클라이언트 가드는 AuthProvider 의 user 상태로 동작하는데, 토큰만 지우면 user 상태가
 * 남아 리다이렉트가 안 되고 모든 API 가 401 로 실패하는 화면에 갇힌다. 하드 이동으로
 * 상태를 초기화한다. (로그인 페이지에서는 재이동하지 않아 루프 방지.)
 */
export function handleSessionExpired(): void {
  clearSession();
  if (
    typeof window !== 'undefined' &&
    !window.location.pathname.startsWith('/login')
  ) {
    window.location.assign('/login');
  }
}

type Query = Record<string, string | number | boolean | undefined | null>;

function withQuery(path: string, query?: Query): string {
  if (!query) return path;
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '') continue;
    sp.append(k, String(v));
  }
  const qs = sp.toString();
  return qs ? `${path}?${qs}` : path;
}

async function parseJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

let refreshing: Promise<boolean> | null = null;

// refreshToken으로 accessToken 갱신 시도. 성공 true.
// contracts mutator 에도 runtime.refresh 로 주입해 codegen 경로 401 을 동일하게 처리한다.
export async function tryRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  if (refreshing) return refreshing;

  refreshing = (async () => {
    try {
      const res = await fetch(buildUrl('/auth/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;
      const json = (await parseJson(res)) as
        | { data: { accessToken: string; refreshToken: string } }
        | undefined;
      if (!json?.data?.accessToken) return false;
      setSession(json.data);
      return true;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();

  return refreshing;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Query;
  // 인증 없이 호출(login/health/refresh)
  skipAuth?: boolean;
  // 401 시 자동 refresh 재시도 여부(기본 true)
  retryOnUnauthorized?: boolean;
}

async function request(path: string, opts: RequestOptions = {}): Promise<unknown> {
  const {
    method = 'GET',
    body,
    query,
    skipAuth = false,
    retryOnUnauthorized = true,
  } = opts;

  const url = buildUrl(withQuery(path, query));
  const headers: Record<string, string> = {
    ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(skipAuth ? {} : authHeader()),
  };

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });

  if (res.status === 401 && !skipAuth && retryOnUnauthorized) {
    const ok = await tryRefresh();
    if (ok) {
      return request(path, { ...opts, retryOnUnauthorized: false });
    }
    handleSessionExpired();
  }

  const json = await parseJson(res);

  if (!res.ok) {
    const errBody = (json as ApiErrorBody | undefined)?.error;
    throw new ApiError(res.status, errBody);
  }

  return json;
}

// 단건: { data } 봉투를 풀어 data 반환.
export async function apiGet<T>(path: string, query?: Query): Promise<T> {
  const json = (await request(path, { query })) as { data: T };
  return json.data;
}

// 목록: { data, meta } 봉투를 풀어 둘 다 반환.
export async function apiGetList<T>(
  path: string,
  query?: Query,
): Promise<{ data: T[]; meta: Meta }> {
  const json = (await request(path, { query })) as { data: T[]; meta: Meta };
  return { data: json.data ?? [], meta: json.meta };
}

export async function apiPost<T>(
  path: string,
  body?: unknown,
  opts?: { skipAuth?: boolean },
): Promise<T> {
  const json = (await request(path, {
    method: 'POST',
    body,
    skipAuth: opts?.skipAuth,
  })) as { data: T };
  return json.data;
}

// POST 인데 목록 봉투({data,meta})를 반환하는 엔드포인트(예: compensations/compute).
// meta 가 확장 필드(companyAvgRaise 등)를 포함할 수 있어 제네릭 M 으로 받는다.
export async function apiPostList<T, M = Meta>(
  path: string,
  body?: unknown,
): Promise<{ data: T[]; meta: M }> {
  const json = (await request(path, { method: 'POST', body })) as {
    data: T[];
    meta: M;
  };
  return { data: json.data ?? [], meta: json.meta };
}

export async function apiPut<T>(path: string, body?: unknown): Promise<T> {
  const json = (await request(path, { method: 'PUT', body })) as {
    data: T;
  };
  return json.data;
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  const json = (await request(path, { method: 'PATCH', body })) as {
    data: T;
  };
  return json.data;
}

export async function apiDelete<T>(path: string, query?: Query): Promise<T> {
  const json = (await request(path, { method: 'DELETE', query })) as {
    data: T;
  };
  return json.data;
}

// 멀티파트 업로드(FormData) — Content-Type 은 브라우저가 boundary 와 함께 설정하므로 직접 지정하지 않는다.
// 401 시 1회 refresh 재시도. 성공 시 { data } 봉투를 풀어 반환.
export async function apiUpload<T>(
  path: string,
  form: FormData,
  query?: Query,
): Promise<T> {
  const url = buildUrl(withQuery(path, query));
  const doFetch = () =>
    fetch(url, {
      method: 'POST',
      headers: { ...authHeader() },
      body: form,
      cache: 'no-store',
    });
  let res = await doFetch();
  if (res.status === 401) {
    const ok = await tryRefresh();
    if (ok) res = await doFetch();
    else handleSessionExpired();
  }
  const json = await parseJson(res);
  if (!res.ok) {
    throw new ApiError(res.status, (json as ApiErrorBody | undefined)?.error);
  }
  return (json as { data: T }).data;
}

// 인증 헤더를 실어 바이너리(첨부 다운로드)를 Blob 으로 가져온다(Bearer 토큰이라 <a href> 로는 불가).
export async function apiDownloadBlob(path: string, query?: Query): Promise<Blob> {
  const url = buildUrl(withQuery(path, query));
  const doFetch = () =>
    fetch(url, { headers: { ...authHeader() }, cache: 'no-store' });
  let res = await doFetch();
  if (res.status === 401) {
    const ok = await tryRefresh();
    if (ok) res = await doFetch();
    else handleSessionExpired();
  }
  if (!res.ok) {
    const json = await parseJson(res);
    throw new ApiError(res.status, (json as ApiErrorBody | undefined)?.error);
  }
  return res.blob();
}
