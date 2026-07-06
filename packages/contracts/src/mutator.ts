import { ApiError, getApiRuntime, type ApiErrorBody } from './runtime';

/**
 * orval(client: fetch) 커스텀 mutator — 인증·에러를 한 곳에서.
 * 생성된 함수의 url 은 openapi 경로(/api/v1/...)를 그대로 포함하므로 baseUrl 만 앞에 붙인다.
 *
 * ⚠ orval fetch 클라이언트는 mutator 가 `{ data, status, headers }` 래퍼를 반환하길 기대한다.
 * 여기서 data = HTTP 본문(= 응답 봉투 {data,meta}). 따라서 호출측은 `res.data.data` 로 실제 값을 꺼낸다
 * — feature 의 api 계층이 이 unwrap 을 한 번 처리해 컴포넌트엔 깔끔한 값만 넘긴다.
 */
export const customFetch = async <T>(
  url: string,
  options: RequestInit = {},
): Promise<T> => {
  const { baseUrl, getAuthHeader, onUnauthorized, refresh } = getApiRuntime();

  // getAuthHeader() 를 호출 시점마다 읽어 refresh 후 새 토큰을 반영한다.
  const doFetch = () =>
    fetch(`${baseUrl}${url}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
        ...(options.headers ?? {}),
      },
    });

  let res = await doFetch();

  // 401: accessToken 만료일 수 있으므로 refresh 후 1회 재시도(lib/api 경로와 대칭).
  // refresh 성공 시에만 재시도하고, 그래도 401 이면 아래에서 onUnauthorized.
  if (res.status === 401 && refresh) {
    const ok = await refresh();
    if (ok) res = await doFetch();
  }

  const text = await res.text();
  // 비-JSON 응답(프록시 502 HTML 등)에서 JSON.parse 가 throw 하면 ApiError 분기를
  // 통째로 우회하므로 방어적으로 파싱한다(lib/api.parseJson 과 동일 정책).
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    body = undefined;
  }

  if (!res.ok) {
    if (res.status === 401) onUnauthorized?.();
    throw new ApiError(res.status, (body as { error?: ApiErrorBody })?.error);
  }

  return { data: body, status: res.status, headers: res.headers } as T;
};
