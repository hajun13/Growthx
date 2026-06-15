'use client';

// admin-permissions feature — 저장 커맨드 훅(생성 클라이언트 기반).
// 권한 설정 읽기/전역 캐시 동기화는 공용 컨텍스트 usePermissions(@/hooks/usePermissions)를 그대로 쓴다.
// 여기서는 PUT 저장만 feature api 로 노출한다(데이터 소스를 생성 클라이언트로 이관).
import { savePermissionsConfig, type PermissionsConfig } from './api';

export function usePermissionsCommands() {
  return { save: savePermissionsConfig };
}

export type { PermissionsConfig };
