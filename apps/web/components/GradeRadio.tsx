'use client';

import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
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
// shadcn 의 Radix radio-group primitive 위에 버튼형 등급 셀로 구성.
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
    <RadioGroupPrimitive.Root
      aria-label={`${name} 등급 선택`}
      value={value ?? undefined}
      onValueChange={(v) => !locked && onChange?.(v as Grade)}
      className="flex gap-2"
    >
      {options.map((g) => {
        const selected = value === g;
        const poolSoldOut = disabledGrades.includes(g) && !selected;
        const itemDisabled = locked || poolSoldOut;
        const dimmed = readOnly && !selected;
        return (
          <RadioGroupPrimitive.Item
            key={g}
            value={g}
            disabled={itemDisabled}
            title={poolSoldOut ? '풀 상한이 소진됐어요' : undefined}
            className={cn(
              'flex min-h-[44px] min-w-[44px] flex-1 items-center justify-center gap-1 rounded-lg border-2 text-base font-bold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
              selected
                ? cn('border-transparent shadow-sm', gradeBg[g])
                : 'border-input bg-card text-foreground/70',
              dimmed && 'opacity-40',
              itemDisabled
                ? 'cursor-not-allowed'
                : 'hover:border-foreground/40',
              poolSoldOut && 'opacity-40',
            )}
          >
            {g}
            {poolSoldOut && <Lock className="ml-0.5 h-3 w-3" aria-hidden />}
          </RadioGroupPrimitive.Item>
        );
      })}
    </RadioGroupPrimitive.Root>
  );
}
