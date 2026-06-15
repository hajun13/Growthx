'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { fetchMe, type MeUser } from './api';

/**
 * 개인 설정 화면 데이터 훅.
 * - 표시용 사용자 정보는 생성 클라이언트(authControllerMe)로 조회.
 *   (깜빡임 방지로 useAuth 의 캐시된 user 를 초기값으로 사용)
 * - 비밀번호 변경은 useAuth().changePassword 에 위임 — 성공 시 토큰 회전·user 갱신은
 *   AuthProvider 가 소유하는 불가침 세션 경계라 그대로 둔다.
 */
export function useSettingsData() {
  const { user, changePassword } = useAuth();
  // 표시값은 생성 클라이언트(authControllerMe) 결과. 초기엔 null → 캐시 user 로 폴백(깜빡임 방지).
  const [me, setMe] = useState<MeUser | null>(null);

  const reload = useCallback(async () => {
    try {
      setMe(await fetchMe());
    } catch {
      /* /auth/me 실패 시 캐시된 user 유지 — 표시만 영향, 동작 보존 */
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    // 표시용: 생성 클라이언트 조회값(없으면 캐시 user 폴백)
    user: me ?? user,
    changePassword,
    reload,
  };
}
