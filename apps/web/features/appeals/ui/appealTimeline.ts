// 이의제기 처리 단계 공유 정의 — 목록 필터·스테퍼가 함께 참조.
// 실제 계약 상태(AppealStatus)는 submitted/under_review/answered/closed 4가지뿐이라
// 시안(image 13)의 "부서장 답변"/"HR 최종 결정" 단계 라벨로 재해석해 매핑한다.
// (요구사항 5상태 "반려"는 계약에 없음 — API 갭, closed 안에서 decision 텍스트로만 구분)
import type { AppealStatus } from '../hooks';

export const TIMELINE_STEPS = [
  { key: 'submitted', label: '접수' },
  { key: 'under_review', label: '검토중' },
  { key: 'answered', label: '부서장 답변' },
  { key: 'closed', label: 'HR 최종 결정' },
] as const;

export const STATUS_STEP: Record<AppealStatus, number> = {
  submitted: 0,
  under_review: 1,
  answered: 2,
  closed: 3,
};

export const FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'submitted', label: '접수' },
  { value: 'under_review', label: '검토중' },
  { value: 'answered', label: '답변완료' },
  { value: 'closed', label: '최종완료' },
  { value: 'rejected', label: '반려' },
];

// 표시 상태 — closed 중 기각(reject) 결정은 '반려'로 구분(시안 5상태).
export function displayStatus(a: { status: AppealStatus; decisionType?: string | null }): string {
  return a.status === 'closed' && a.decisionType === 'reject' ? 'rejected' : a.status;
}
