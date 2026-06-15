'use client';

import { configureApi } from '@growthx/contracts';
import { authHeader, clearSession } from '@/lib/auth';

/**
 * @growthx/contracts 생성 클라이언트의 런타임 설정 부트.
 * baseUrl·인증 헤더를 주입해 생성 클라이언트가 앱의 auth 를 단일 소스로 사용하게 한다.
 * 메인 레이아웃 상단에 마운트(자식 데이터 호출 전에 설정되도록 렌더 시 동기 설정).
 */
let configured = false;

export function ApiClientInit() {
  if (!configured) {
    configureApi({
      baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ?? '',
      getAuthHeader: authHeader,
      onUnauthorized: () => {
        clearSession();
      },
    });
    configured = true;
  }
  return null;
}
