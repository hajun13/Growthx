'use client';

import { useId } from 'react';
import { fmtPercent } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import type { Grade, MeasureType } from '@/lib/types';
import { GradeChip } from './GradeChip';

export interface AchievementFieldProps {
  measureType: MeasureType;
  targetValue?: number;
  unit?: string;
  actualValue?: number; // amount/rate 실적
  achievementRate?: number; // % (백엔드 산정)
  count?: number; // count 방식 실적 건수
  autoGrade?: Grade | null; // 자동 산출 등급(백엔드)
  qualitativeNote?: string; // qualitative 서술
  onChange?: (v: {
    actualValue?: number;
    count?: number;
    qualitativeNote?: string;
  }) => void;
  readOnly?: boolean;
}

// 실적 입력 → 달성률/건수 → 등급 자동 표시. 계산은 백엔드, 프론트는 표시만.
export function AchievementField({
  measureType,
  targetValue,
  unit,
  actualValue,
  achievementRate,
  count,
  autoGrade,
  qualitativeNote,
  onChange,
  readOnly,
}: AchievementFieldProps) {
  const id = useId();

  if (measureType === 'qualitative') {
    return (
      <div className="flex flex-col gap-2 rounded-md border bg-muted/40 p-4">
        <Label htmlFor={id}>정성 평가 서술</Label>
        <Textarea
          id={id}
          rows={3}
          readOnly={readOnly}
          value={qualitativeNote ?? ''}
          onChange={(e) => onChange?.({ qualitativeNote: e.target.value })}
          placeholder="정성 평가 내용을 작성해 주세요."
          className="resize-y bg-background"
        />
        <p className="text-xs text-muted-foreground">
          정성 평가는 부서장이 등급을 부여해요.
        </p>
      </div>
    );
  }

  const isCount = measureType === 'count';
  const inputValue = isCount ? count : actualValue;
  const inputLabel = isCount ? '실적 건수' : '실적값';
  const fieldUnit = isCount ? '건' : (unit ?? '');

  return (
    <div className="flex flex-col gap-3 rounded-md border bg-muted/40 p-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">목표</span>
          <span className="text-base font-medium tabular-nums text-foreground">
            {targetValue ?? '—'}
            {fieldUnit}
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id}>{inputLabel}</Label>
          <div className="relative w-32">
            <Input
              id={id}
              type="number"
              readOnly={readOnly}
              value={inputValue ?? ''}
              onChange={(e) => {
                const v =
                  e.target.value === '' ? undefined : Number(e.target.value);
                onChange?.(isCount ? { count: v } : { actualValue: v });
              }}
              className={cn('bg-background tabular-nums', fieldUnit && 'pr-8')}
            />
            {fieldUnit && (
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                {fieldUnit}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 자동 산출 등급 (백엔드 표시만) */}
      <div aria-live="polite" className="flex items-center gap-2 text-sm">
        {isCount ? (
          inputValue !== undefined ? (
            <>
              <span className="text-muted-foreground">{inputValue}건 →</span>
              <GradeChip grade={autoGrade ?? null} size="sm" variant="soft" />
            </>
          ) : (
            <span className="text-muted-foreground">
              실적을 입력하면 등급이 표시돼요.
            </span>
          )
        ) : achievementRate !== undefined ? (
          <>
            <span className="text-muted-foreground">
              달성률 {fmtPercent(achievementRate)} →
            </span>
            <GradeChip grade={autoGrade ?? null} size="sm" variant="soft" />
          </>
        ) : (
          <span className="text-muted-foreground">
            실적을 입력하면 달성률·등급이 표시돼요.
          </span>
        )}
      </div>
    </div>
  );
}
