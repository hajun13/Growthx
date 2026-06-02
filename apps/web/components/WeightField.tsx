'use client';

import { useId } from 'react';
import { kpiGroupLabel } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  const qualOver = qualitativeTotal !== undefined && qualitativeTotal > 30;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>가중치</Label>
      <div className="relative w-28">
        <Input
          id={id}
          type="number"
          min={0}
          max={100}
          value={Number.isFinite(value) ? value : 0}
          readOnly={readOnly}
          aria-invalid={totalInvalid || undefined}
          aria-describedby={`${id}-cap`}
          onChange={(e) => onChange?.(Number(e.target.value))}
          className={cn(
            'pr-8 tabular-nums',
            totalInvalid && 'border-destructive focus-visible:ring-destructive',
          )}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          %
        </span>
      </div>
      <p id={`${id}-cap`} className="text-xs">
        {totalInvalid ? (
          <span className="text-destructive">
            가중치 합이 100%가 되어야 해요 (현재 {groupTotal}%)
          </span>
        ) : (
          <span className="text-success-600">합계 100% 충족</span>
        )}
        {isQualitative && qualOver && (
          <span className="ml-2 text-warning-700">
            정성 KPI 합이 30%를 넘었어요 ({qualitativeTotal}%)
          </span>
        )}
        {group && (
          <span className="ml-2 text-muted-foreground">
            {kpiGroupLabel[group]}
          </span>
        )}
      </p>
    </div>
  );
}
