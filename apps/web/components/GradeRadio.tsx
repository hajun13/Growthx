'use client';

import { cx } from '@/lib/ui';
import type { Grade } from '@/lib/types';

const DEFAULT_OPTIONS: Grade[] = ['S', 'A', 'B', 'C', 'D'];

const gradeBg: Record<Grade, string> = {
  S: 'bg-gradeBg-s text-gradeFg-s',
  A: 'bg-gradeBg-a text-gradeFg-a',
  B: 'bg-gradeBg-b text-gradeFg-b',
  C: 'bg-gradeBg-c text-gradeFg-c',
  D: 'bg-gradeBg-d text-gradeFg-d',
};

export interface GradeRadioProps {
  name: string;
  value?: Grade | null;
  onChange?: (g: Grade) => void;
  readOnly?: boolean;
  disabled?: boolean;
  // 그룹 풀 상한이 소진된 등급(선택 차단) — 부서장 평가(S6).
  disabledGrades?: Grade[];
  options?: Grade[];
}

// 부서장 평가(S6)에서 평가자가 종합 등급을 부여할 때만 사용.
export function GradeRadio({
  name,
  value = null,
  onChange,
  readOnly,
  disabled,
  disabledGrades = [],
  options = DEFAULT_OPTIONS,
}: GradeRadioProps) {
  const locked = readOnly || disabled;

  return (
    <div role="radiogroup" aria-label={`${name} 등급 선택`} className="flex gap-2">
      {options.map((g) => {
        const selected = value === g;
        const poolSoldOut = disabledGrades.includes(g) && !selected;
        const itemDisabled = locked || poolSoldOut;
        // readOnly: 선택값만 강조, 나머지 흐림.
        const dimmed = readOnly && !selected;
        return (
          <button
            key={g}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-disabled={itemDisabled || undefined}
            disabled={itemDisabled}
            title={poolSoldOut ? '풀 상한이 소진됐어요' : undefined}
            onClick={() => !itemDisabled && onChange?.(g)}
            className={cx(
              'flex min-h-[44px] min-w-[44px] flex-1 items-center justify-center rounded-sm border text-base font-semibold outline-none transition-colors duration-fast focus-visible:shadow-focus',
              selected
                ? readOnly
                  ? cx('border-transparent', gradeBg[g])
                  : 'border-primary-500 bg-primary-50 text-primary-700'
                : 'border-neutral-300 bg-neutral-0 text-neutral-600',
              dimmed && 'opacity-40',
              itemDisabled ? 'cursor-not-allowed' : 'hover:border-primary-300',
              poolSoldOut && 'opacity-40',
              disabled && 'opacity-50',
            )}
          >
            {g}
            {poolSoldOut && (
              <span aria-hidden className="ml-1 text-xs">
                🔒
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
