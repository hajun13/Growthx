'use client';

import { fmtScore, fmtPercent } from '@/lib/ui';
import type { Grade, MeasureType } from '@/lib/types';
import { GradeChip } from './GradeChip';

export interface ScoreCardProps {
  score: number;
  measureType?: MeasureType;
  achievementRate?: number; // amount/rate
  count?: number; // count
  grade?: Grade;
  weight?: number;
  label?: string;
}

// 점수·달성률/건수 표시만(백엔드 산정값). 프론트 재계산 없음.
export function ScoreCard({
  score,
  measureType,
  achievementRate,
  count,
  grade,
  weight,
  label = '과제 최종점수',
}: ScoreCardProps) {
  const showCount = measureType === 'count';
  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-0 p-5">
      <div className="flex items-start justify-between">
        <p className="text-sm text-neutral-600">{label}</p>
        {grade && <GradeChip grade={grade} size="sm" showScore={score} />}
      </div>
      <p className="mt-2 text-3xl font-bold tabular-nums text-neutral-900">
        {fmtScore(score)}
      </p>
      <dl className="mt-4 flex flex-col gap-1 text-sm text-neutral-700">
        {showCount && count !== undefined && (
          <div className="flex justify-between">
            <dt className="text-neutral-500">실적 건수</dt>
            <dd className="tabular-nums">{count}건</dd>
          </div>
        )}
        {!showCount && achievementRate !== undefined && (
          <div className="flex justify-between">
            <dt className="text-neutral-500">목표 달성률</dt>
            <dd className="tabular-nums">{fmtPercent(achievementRate)}</dd>
          </div>
        )}
        {weight !== undefined && (
          <div className="flex justify-between">
            <dt className="text-neutral-500">가중치</dt>
            <dd className="tabular-nums">{weight}%</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
