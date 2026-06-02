// fetch 래퍼 — 봉투를 한 곳에서 unwrap.
// 성공: { data } 또는 { data, meta } 반환. 실패: ApiError throw.
// 절대 응답을 배열로 가정하지 않는다(.filter is not a function 방지).

import { authHeader, getRefreshToken, setSession, clearSession } from './auth';
import type { ApiErrorBody, Meta } from './types';

// 브라우저에선 same-origin('/api/v1' rewrite/프록시), SSR/직접 호출은 절대 URL.
const RAW_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ?? '';
const PREFIX = '/api/v1';

function buildUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${RAW_BASE}${PREFIX}${p}`;
}

export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown[];

  constructor(status: number, body: ApiErrorBody['error'] | undefined) {
    super(body?.message ?? '알 수 없는 오류가 발생했어요.');
    this.name = 'ApiError';
    this.status = status;
    this.code = body?.code ?? 'UNKNOWN';
    this.details = body?.details;
  }

  get isUnauthorized() {
    return this.status === 401;
  }
  get isForbidden() {
    return this.status === 403;
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
async function tryRefresh(): Promise<boolean> {
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
    clearSession();
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

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  const json = (await request(path, { method: 'PATCH', body })) as {
    data: T;
  };
  return json.data;
}

export async function apiDelete<T>(path: string): Promise<T> {
  const json = (await request(path, { method: 'DELETE' })) as { data: T };
  return json.data;
}
