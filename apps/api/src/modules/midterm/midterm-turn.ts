import { Role } from '@prisma/client';

/**
 * 중간점검 차례 판정(순수 함수 — 서비스 의존성 없이 테스트 가능).
 * 흐름: pending →(1차 코멘트) commented →(본인 수정) revised →(2차 판정) closed|returned →(본인 재수정) revised.
 * hr_admin 은 전 단계 대리 가능(이력에 대리 표시). reopen 은 closed 에서 HR 전용.
 */
export type MidtermAction = 'comment' | 'revise' | 'decide' | 'reopen';
export type MidtermTurnDenyKind = 'wrong_status' | 'not_your_turn' | 'not_in_chain' | 'hr_only';

export interface MidtermTurnInput {
  action: MidtermAction;
  status: string;
  userId: string;
  role: Role;
  evaluateeId: string;
  firstReviewerId: string | null;
  finalReviewerId: string | null;
}

export type MidtermTurnResult = { allowed: true } | { allowed: false; kind: MidtermTurnDenyKind };

/** 액션별 허용 상태. */
const ALLOWED_STATUS: Record<MidtermAction, string[]> = {
  comment: ['pending'],
  revise: ['commented', 'returned'],
  decide: ['revised'],
  reopen: ['closed'],
};

/**
 * 본인이 수정안을 다룰 수 있는 상태 — 제출(revise)과 임시저장이 공유한다.
 * 임시저장에만 별도 목록을 두면 "저장은 되는데 제출은 안 되는" 창이 생겨 두 경로가 어긋난다.
 */
export const MIDTERM_REVISABLE_STATUSES = ALLOWED_STATUS.revise;

export function evaluateMidtermTurn(input: MidtermTurnInput): MidtermTurnResult {
  const { action, status, userId, role, evaluateeId, firstReviewerId, finalReviewerId } = input;

  if (!ALLOWED_STATUS[action].includes(status)) return { allowed: false, kind: 'wrong_status' };

  if (action === 'reopen') {
    return role === Role.hr_admin ? { allowed: true } : { allowed: false, kind: 'hr_only' };
  }

  // 담당자 본인이면 허용.
  const owner =
    action === 'comment' ? firstReviewerId : action === 'revise' ? evaluateeId : finalReviewerId;
  if (owner && owner === userId) return { allowed: true };

  // HR 대리(전 단계). 이력에 onBehalfOf=true 로 남긴다.
  if (role === Role.hr_admin) return { allowed: true };

  // 관계자이긴 하나 차례가 아닌 경우와, 아예 무관한 경우를 구분해 안내한다.
  // 수정은 피평가자만 관여. 코멘트/판정은 전 체인 관여.
  const relatedList: (string | null)[] =
    action === 'revise'
      ? [evaluateeId]
      : [evaluateeId, firstReviewerId, finalReviewerId];
  const related = relatedList.filter((id): id is string => !!id);
  if (!related.includes(userId)) return { allowed: false, kind: 'not_in_chain' };
  return { allowed: false, kind: 'not_your_turn' };
}

/** 차단 사유별 사용자 안내 문구. */
export const MIDTERM_TURN_MESSAGE: Record<MidtermTurnDenyKind, string> = {
  wrong_status: '지금 단계에서는 처리할 수 없어요. 화면을 새로고침해 현재 상태를 확인해 주세요.',
  not_your_turn: '아직 차례가 아니에요. 앞 단계가 끝나면 처리할 수 있어요.',
  not_in_chain: '이 구성원의 중간점검 담당자가 아니에요.',
  hr_only: '확정된 중간점검을 되돌리는 것은 인사 담당자만 할 수 있어요.',
};
