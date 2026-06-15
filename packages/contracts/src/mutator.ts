import { ApiError, getApiRuntime, type ApiErrorBody } from './runtime';

/**
 * orval(client: fetch) 커스텀 mutator — 봉투 처리·인증을 한 곳에서.
 * 생성된 함수의 url 은 openapi 경로(/api/v1/...)를 그대로 포함하므로 baseUrl 만 앞에 붙인다.
 * 응답 봉투({data}/{data,meta})는 unwrap 하지 않고 그대로 반환한다 — 타입(스키마)이 봉투를
 * 그대로 표현하므로 호출측(feature 훅)이 res.data 로 꺼낸다(타입 정직성 유지).
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
  const json: unknown = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    if (res.status === 401) onUnauthorized?.();
    throw new ApiError(res.status, (json as { error?: ApiErrorBody })?.error);
  }

  return json as T;
};
