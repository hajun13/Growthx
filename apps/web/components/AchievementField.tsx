'use client';

import { useId } from 'react';
import { cx, fmtPercent } from '@/lib/ui';
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
      <div className="flex flex-col gap-2 rounded-md border border-neutral-200 bg-neutral-50 p-4">
        <label htmlFor={id} className="text-sm font-medium text-neutral-700">
          정성 평가 서술
        </label>
        <textarea
          id={id}
          rows={3}
          readOnly={readOnly}
          value={qualitativeNote ?? ''}
          onChange={(e) => onChange?.({ qualitativeNote: e.target.value })}
          placeholder="정성 평가 내용을 작성해 주세요."
          className={cx(
            'w-full resize-y rounded-md border border-neutral-300 bg-neutral-0 px-3 py-2 text-base text-neutral-900 outline-none focus:border-primary-500 focus-visible:shadow-focus',
            readOnly && 'bg-neutral-100 text-neutral-500',
          )}
        />
        <p className="text-xs text-neutral-500">
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
    <div className="flex flex-col gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-neutral-500">목표</span>
          <span className="text-base font-medium tabular-nums text-neutral-900">
            {targetValue ?? '—'}
            {fieldUnit}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={id} className="text-sm font-medium text-neutral-700">
            {inputLabel}
          </label>
          <div className="relative w-32">
            <input
              id={id}
              type="number"
              readOnly={readOnly}
              value={inputValue ?? ''}
              onChange={(e) => {
                const v =
                  e.target.value === '' ? undefined : Number(e.target.value);
                onChange?.(isCount ? { count: v } : { actualValue: v });
              }}
              className={cx(
                'w-full rounded-md border border-neutral-300 bg-neutral-0 px-3 py-2 pr-8 text-base tabular-nums text-neutral-900 outline-none focus:border-primary-500 focus-visible:shadow-focus',
                readOnly && 'bg-neutral-100 text-neutral-500',
              )}
            />
            {fieldUnit && (
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-neutral-500">
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
              <span className="text-neutral-600">
                {inputValue}건 →
              </span>
              <GradeChip grade={autoGrade ?? null} size="sm" variant="soft" />
            </>
          ) : (
            <span className="text-neutral-400">실적을 입력하면 등급이 표시돼요.</span>
          )
        ) : achievementRate !== undefined ? (
          <>
            <span className="text-neutral-600">
              달성률 {fmtPercent(achievementRate)} →
            </span>
            <GradeChip grade={autoGrade ?? null} size="sm" variant="soft" />
          </>
        ) : (
          <span className="text-neutral-400">
            실적을 입력하면 달성률·등급이 표시돼요.
          </span>
        )}
      </div>
    </div>
  );
}
