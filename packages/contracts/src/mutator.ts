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
  const { baseUrl, getAuthHeader, onUnauthorized } = getApiRuntime();

  const res = await fetch(`${baseUrl}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
      ...(options.headers ?? {}),
    },
  });

  const text = await res.text();
  const body: unknown = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    if (res.status === 401) onUnauthorized?.();
    throw new ApiError(res.status, (body as { error?: ApiErrorBody })?.error);
  }

  return { data: body, status: res.status, headers: res.headers } as T;
};
