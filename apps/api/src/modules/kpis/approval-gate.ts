import { Role } from '@prisma/client';

/**
 * 순차 결재 승인 게이트 판정(순수 함수 — 서비스 의존성 없이 테스트 가능).
 *
 * 규칙(2026-07-23 개정 — 위치 인덱스(stage) → 결재 이력(trail) 기준, B-1 "권한과 평가 분리" 정합):
 *  - 체인은 매 호출마다 현 조직(Department.headUserId)에서 재해석된다. 결재 도중 부서장이
 *    바뀌면 위치 인덱스(chain[stage])가 엉뚱한 사람을 가리켜 단계가 조용히 건너뛰어지거나
 *    같은 사람이 두 번 승인될 수 있었다. 그래서 "이미 승인한 사람 집합(approvedIds —
 *    approvalTrail 유래)"을 기준으로, **아직 승인하지 않은 가장 앞 체인 구성원**만
 *    현재 차례로 판정한다(이력에 있는 사람은 다시 승인 불가).
 *  - 현재 차례의 배정 결재자 본인이면 승인 가능(역할 무관).
 *  - hr_admin 은 **대기 결재자가 없는 경우**(빈 체인·계층 공백·체인 축소로 전원 승인 완료)만
 *    대리 승인. 대기 결재자가 있으면 hr_admin 이라도 대리 불가(그 결재자만). → hr_admin
 *    권한이 타 팀의 정상 결재선을 가로채 전 팀 1차 승인이 열리던 문제 차단.
 *  - 그 외 비 HR 사용자는 결재선 위치에 따라 not_in_chain / already / not_yet.
 */
export type ApprovalGateResult =
  | { allowed: true }
  | { allowed: false; kind: 'hr_blocked' | 'not_in_chain' | 'already' | 'not_yet' };

export function evaluateApprovalGate(
  role: Role,
  userId: string,
  chain: string[],
  approvedIds: ReadonlySet<string>,
): ApprovalGateResult {
  // 현재 차례 = 승인 이력이 없는 가장 앞 체인 구성원(위치 인덱스가 아닌 이력 기준).
  const expected = chain.find((id) => !approvedIds.has(id));
  if (expected && expected === userId) return { allowed: true };

  if (role === Role.hr_admin) {
    // 대기 결재자가 없는 경우만 HR 폴백(빈 체인·계층 공백·체인 축소).
    if (!expected) return { allowed: true };
    return { allowed: false, kind: 'hr_blocked' };
  }

  if (!chain.includes(userId)) return { allowed: false, kind: 'not_in_chain' };
  if (approvedIds.has(userId)) return { allowed: false, kind: 'already' };
  return { allowed: false, kind: 'not_yet' };
}

/**
 * approvalTrail/reviewTrail(Json)에서 승인자 id 집합 추출.
 * 레거시 브리지: 이력이 비었는데 완료 단계 수(legacyStage)>0 인 행(2026-07-07 순차 결재 도입
 * 시 stage 만 백필되고 trail 이 없는 기존 승인 건)은 현 체인의 앞 legacyStage 명을 승인
 * 완료로 간주해 종전(위치 기준) 동작을 보존한다 — 이력이 있는 행은 항상 이력이 권위.
 */
export function approvedIdsFromTrail(
  trail: unknown,
  legacyStage: number,
  chain: string[],
): Set<string> {
  const ids = new Set<string>();
  if (Array.isArray(trail)) {
    for (const entry of trail) {
      const approverId =
        entry && typeof entry === 'object'
          ? (entry as Record<string, unknown>).approverId
          : undefined;
      if (typeof approverId === 'string' && approverId) ids.add(approverId);
    }
  }
  if (ids.size === 0 && legacyStage > 0) {
    for (const uid of chain.slice(0, legacyStage)) ids.add(uid);
  }
  return ids;
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
