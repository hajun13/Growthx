// 이의제기 처리 단계 공유 정의 — 목록 필터·스테퍼가 함께 참조.
// 실제 계약 상태(AppealStatus)는 submitted/under_review/answered/closed 4가지지만,
// 백엔드 전이가 respond() 한 번에 submitted→under_review→answered 를 통과해
// under_review 는 저장 상태로 도달 불가(transitions.ts) — 표시 계층에서는 '접수'에 흡수해
// 3단계(접수 → 부서장 답변 → HR 최종 결정)로 정리한다.
// (요구사항 5상태 "반려"는 계약에 없음 — API 갭, closed 안에서 decision 텍스트로만 구분)
import type { AppealStatus } from '../hooks';

export const TIMELINE_STEPS = [
  { key: 'submitted', label: '접수' },
  { key: 'answered', label: '부서장 답변' },
  { key: 'closed', label: 'HR 최종 결정' },
] as const;

export const STATUS_STEP: Record<AppealStatus, number> = {
  submitted: 0,
  under_review: 0, // 도달 불가 상태 — 접수에 흡수
  answered: 1,
  closed: 2,
};

export const FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'submitted', label: '접수' },
  { value: 'answered', label: '답변완료' },
  { value: 'closed', label: '최종완료' },
  { value: 'rejected', label: '반려' },
];

// 표시 상태 — closed 중 기각(reject) 결정은 '반려'로 구분(시안 5상태),
// under_review(도달 불가)는 '접수'로 흡수.
export function displayStatus(a: { status: AppealStatus; decisionType?: string | null }): string {
  if (a.status === 'closed' && a.decisionType === 'reject') return 'rejected';
  if (a.status === 'under_review') return 'submitted';
  return a.status;
}
