'use client';

import { cx } from '@/lib/ui';
import type { Grade } from '@/lib/types';

const gradeSolid: Record<Grade, string> = {
  S: 'bg-grade-s',
  A: 'bg-grade-a',
  B: 'bg-grade-b',
  C: 'bg-grade-c',
  D: 'bg-grade-d',
};

export interface PoolGaugeProps {
  grade: Grade;
  used: number;
  cap: number;
}

// 등급별 풀 잔여(상한 − 배정). 부서장 평가에서 등급 부여 가능 여부 안내.
export function PoolGauge({ grade, used, cap }: PoolGaugeProps) {
  const remaining = cap - used;
  const pct = cap > 0 ? Math.min(100, (used / cap) * 100) : 100;
  const soldOut = remaining <= 0;
  const low = remaining <= 1 && !soldOut;

  return (
    <div
      className="flex items-center gap-2"
      aria-label={`${grade}등급 풀 ${used}/${cap} 사용, 잔여 ${Math.max(0, remaining)}`}
    >
      <span className="w-5 text-sm font-semibold text-neutral-700">{grade}</span>
      <div className="h-2.5 w-20 overflow-hidden rounded-full bg-neutral-100">
        <div
          className={cx(
            'h-2.5 rounded-full',
            soldOut ? 'bg-danger-500' : gradeSolid[grade],
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span
        className={cx(
          'text-xs tabular-nums',
          soldOut
            ? 'text-danger-600'
            : low
              ? 'text-warning-700'
              : 'text-neutral-600',
        )}
      >
        {soldOut ? '소진' : `잔여 ${remaining}`}
      </span>
    </div>
  );
}
