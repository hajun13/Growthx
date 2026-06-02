'use client';

import { useId } from 'react';
import { cx, kpiGroupLabel } from '@/lib/ui';
import type { KpiGroup } from '@/lib/types';

export interface WeightFieldProps {
  value: number;
  onChange?: (v: number) => void;
  groupTotal: number;
  readOnly?: boolean;
  isQualitative?: boolean;
  // 정성 합계(부모 집계) — 정성 ≤30% 정책 피드백용(표시만)
  qualitativeTotal?: number;
  // KPI 그룹(성과중심/협업·성장) — 비율 표시용(선택)
  group?: KpiGroup;
}

// 가중치 입력 + 즉시 피드백(표시만). 검증·계산 최종 책임은 백엔드.
export function WeightField({
  value,
  onChange,
  groupTotal,
  readOnly,
  isQualitative,
  qualitativeTotal,
  group,
}: WeightFieldProps) {
  const id = useId();
  const totalInvalid = groupTotal !== 100;
  const qualOver =
    qualitativeTotal !== undefined && qualitativeTotal > 30;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-neutral-700">
        가중치
      </label>
      <div className="relative w-28">
        <input
          id={id}
          type="number"
          min={0}
          max={100}
          value={Number.isFinite(value) ? value : 0}
          readOnly={readOnly}
          aria-invalid={totalInvalid || undefined}
          aria-describedby={`${id}-cap`}
          onChange={(e) => onChange?.(Number(e.target.value))}
          className={cx(
            'w-full rounded-md border bg-neutral-0 px-3 py-2 pr-8 text-base tabular-nums text-neutral-900 outline-none focus:border-primary-500 focus-visible:shadow-focus',
            totalInvalid ? 'border-danger-500' : 'border-neutral-300',
            readOnly && 'bg-neutral-100 text-neutral-500',
          )}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-neutral-500">
          %
        </span>
      </div>
      <p id={`${id}-cap`} className="text-xs">
        {totalInvalid ? (
          <span className="text-danger-600">
            가중치 합이 100%가 되어야 해요 (현재 {groupTotal}%)
          </span>
        ) : (
          <span className="text-success-600">합계 100% ✓</span>
        )}
        {isQualitative && qualOver && (
          <span className="ml-2 text-warning-700">
            정성 KPI 합이 30%를 넘었어요 ({qualitativeTotal}%)
          </span>
        )}
        {group && (
          <span className="ml-2 text-neutral-500">{kpiGroupLabel[group]}</span>
        )}
      </p>
    </div>
  );
}
