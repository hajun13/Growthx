// 평가 기간(운영 일정 창) 판정 — 백엔드 evaluations.service.assertEvalWindowOpen 과 동일 규칙.
// 본인평가(self)·부서장평가(downward)는 해당 단계 일정 기간 안에서만 작성·제출 가능하다.
// 전용 단계(self/downward)가 없으면 최종평가(final_review) 창을 적용, 그것도 없으면 개방.
import type { PhaseScheduleLite } from './types';

export type EvalWindow = {
  /** 현재 시각이 창 안(작성·제출 가능)인지. 미설정이면 true(개방). */
  open: boolean;
  start: Date | null;
  due: Date | null;
  /** 해당 단계 일정이 설정돼 있는지(false 면 게이트 없음 = 항상 open). */
  configured: boolean;
};

const PHASE_ORDER: Record<'self' | 'downward', string[]> = {
  self: ['self', 'final_review'],
  downward: ['downward', 'final_review'],
};

export function evalWindow(
  schedules: PhaseScheduleLite[] | undefined | null,
  type: 'self' | 'downward',
  now: Date = new Date(),
): EvalWindow {
  const list = schedules ?? [];
  const sched =
    PHASE_ORDER[type].map((p) => list.find((s) => s.phase === p)).find((s) => s != null) ?? null;
  if (!sched) return { open: true, start: null, due: null, configured: false };
  const start = sched.startDate ? new Date(sched.startDate) : null;
  const due = sched.dueDate ? new Date(sched.dueDate) : null;
  const afterStart = !start || start <= now;
  const beforeDue = !due || now <= due;
  return { open: afterStart && beforeDue, start, due, configured: true };
}

/** "2026년 12월 1일 ~ 2026년 12월 31일" 형태 기간 문구. */
export function formatEvalWindow(w: EvalWindow): string {
  const f = (d: Date | null) =>
    d ? d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }) : '미설정';
  return `${f(w.start)} ~ ${f(w.due)}`;
}
