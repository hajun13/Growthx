import { Role } from '@prisma/client';

/**
 * 순차 결재 승인 게이트 판정(순수 함수 — 서비스 의존성 없이 테스트 가능).
 *
 * 규칙(2026-07-09, B-1 "권한과 평가 분리" 정합):
 *  - 현재 단계에 **배정된 결재자 본인**(chain[stage] === userId)이면 승인 가능(역할 무관).
 *  - hr_admin 은 **배정 결재자가 없는 단계**(빈 체인·계층 공백 — chain[stage] 미존재)만 대리 승인.
 *    배정 결재자가 있으면 hr_admin 이라도 대리 불가(그 결재자만). → hr_admin 권한이
 *    타 팀의 정상 결재선을 가로채 전 팀 1차 승인이 열리던 문제 차단.
 *  - 그 외 비 HR 사용자는 결재선 위치에 따라 not_in_chain / already / not_yet.
 */
export type ApprovalGateResult =
  | { allowed: true }
  | { allowed: false; kind: 'hr_blocked' | 'not_in_chain' | 'already' | 'not_yet' };

export function evaluateApprovalGate(
  role: Role,
  userId: string,
  chain: string[],
  stage: number,
): ApprovalGateResult {
  const expected = chain[stage];
  if (expected && expected === userId) return { allowed: true };

  if (role === Role.hr_admin) {
    // 배정 결재자가 없는 단계만 HR 폴백(빈 체인·계층 공백).
    if (!expected) return { allowed: true };
    return { allowed: false, kind: 'hr_blocked' };
  }

  const idx = chain.indexOf(userId);
  if (idx < 0) return { allowed: false, kind: 'not_in_chain' };
  if (idx < stage) return { allowed: false, kind: 'already' };
  return { allowed: false, kind: 'not_yet' };
}

/** 게이트 차단 사유별 사용자 안내 문구. */
export const APPROVAL_GATE_MESSAGE: Record<
  Exclude<ApprovalGateResult, { allowed: true }>['kind'],
  string
> = {
  hr_blocked:
    '이 단계는 배정된 결재자가 있어 HR도 대리 승인할 수 없어요. 해당 결재자가 승인하거나, 반려로 되돌린 뒤 진행하세요.',
  not_in_chain: '이 구성원의 결재선(팀장→본부장→그룹대표)에 포함되어 있지 않아요.',
  already: '이미 승인한 단계예요. 다음 단계 결재자의 승인 차례예요.',
  not_yet: '앞 단계 승인 후 처리할 수 있어요.',
};
