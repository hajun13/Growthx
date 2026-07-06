/**
 * 생성된 API 클라이언트의 런타임 설정 — 앱이 주입한다(packages는 앱 비종속).
 * apps/web 은 시작 시 configureApi({ baseUrl, getAuthHeader, onUnauthorized }) 를 호출한다.
 * 이렇게 해야 인증·토큰 로직의 단일 소스(앱의 auth)를 유지하면서 contracts 가 프레임워크/앱에 의존하지 않는다.
 */

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown[];
}

/** 봉투 {error} → 예외. 기존 web ApiError 와 동일 형태. */
export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown[];

  constructor(status: number, body?: ApiErrorBody) {
    super(body?.message ?? '알 수 없는 오류가 발생했어요.');
    this.name = 'ApiError';
    this.status = status;
    this.code = body?.code ?? 'UNKNOWN';
    this.details = body?.details;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }
  get isForbidden(): boolean {
    return this.status === 403;
  }
}

export interface ApiRuntimeConfig {
  /** 절대 베이스(예: http://localhost:4000) 또는 ''(same-origin 프록시). openapi 경로에 /api/v1 포함. */
  baseUrl: string;
  /** 인증 헤더(Authorization 등)를 반환. 앱의 auth 에서 주입. */
  getAuthHeader: () => Record<string, string>;
  /**
   * 401 시 accessToken 갱신 시도. true 면 mutator 가 원요청을 1회 재시도한다.
   * 앱의 refresh 로직(refreshToken → 새 accessToken)을 주입. 미주입 시 재시도 없음.
   */
  refresh?: () => Promise<boolean>;
  /** 갱신 실패로 세션이 만료됐을 때 콜백(세션 정리/로그인 리다이렉트). 선택. */
  onUnauthorized?: () => void;
}

let runtime: ApiRuntimeConfig = {
  baseUrl: '',
  getAuthHeader: () => ({}),
};

export function configureApi(config: Partial<ApiRuntimeConfig>): void {
  runtime = { ...runtime, ...config };
}

export function getApiRuntime(): ApiRuntimeConfig {
  return runtime;
}
