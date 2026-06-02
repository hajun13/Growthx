import {
  AppealStatus,
  CycleStatus,
  EvaluationStatus,
  KpiStatus,
} from '@prisma/client';
import { ConflictException } from '@nestjs/common';

/**
 * 상태 전이 명시 맵 (domain-model §5). 허용 외 전이는 거부.
 * 죽은 전이/무단 전이 금지.
 */

export const CYCLE_TRANSITIONS: Record<CycleStatus, CycleStatus[]> = {
  draft: [CycleStatus.active],
  active: [CycleStatus.mid_review],
  mid_review: [CycleStatus.calibration],
  calibration: [CycleStatus.closed],
  closed: [],
};

export const KPI_TRANSITIONS: Record<KpiStatus, KpiStatus[]> = {
  draft: [KpiStatus.submitted],
  submitted: [KpiStatus.approved, KpiStatus.draft], // approve | reject(→draft)
  approved: [KpiStatus.confirmed],
  confirmed: [],
};

export const EVALUATION_TRANSITIONS: Record<EvaluationStatus, EvaluationStatus[]> = {
  not_started: [EvaluationStatus.in_progress],
  in_progress: [EvaluationStatus.submitted],
  submitted: [EvaluationStatus.finalized],
  finalized: [],
};

export const APPEAL_TRANSITIONS: Record<AppealStatus, AppealStatus[]> = {
  submitted: [AppealStatus.under_review],
  under_review: [AppealStatus.answered],
  answered: [AppealStatus.closed],
  closed: [],
};

export function assertTransition<T extends string>(
  map: Record<string, T[]>,
  from: T,
  to: T,
): void {
  const allowed = map[from] ?? [];
  if (!allowed.includes(to)) {
    throw new ConflictException({
      code: 'INVALID_STATE_TRANSITION',
      message: `'${from}' → '${to}' 전이는 허용되지 않아요.`,
    });
  }
}
