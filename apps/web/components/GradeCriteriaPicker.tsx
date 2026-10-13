'use client';

import { Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Kpi, Grade } from '@/lib/types';

const GRADE_ORDER: Grade[] = ['S', 'A', 'B', 'C', 'D'];

const GRADE_VARIANT = {
  S: 'grade-s',
  A: 'grade-a',
  B: 'grade-b',
  C: 'grade-c',
  D: 'grade-d',
} as const;

// 선택 행 톤 — 등급색 테두리 + 연한 틴트(readOnly 는 조금 더 진하게). 정적 클래스 룩업.
const SELECTED_TONE = {
  S: { edit: 'border-grade-s bg-grade-s/6', view: 'border-grade-s bg-grade-s/10', check: 'text-grade-s' },
  A: { edit: 'border-grade-a bg-grade-a/6', view: 'border-grade-a bg-grade-a/10', check: 'text-grade-a' },
  B: { edit: 'border-grade-b bg-grade-b/6', view: 'border-grade-b bg-grade-b/10', check: 'text-grade-b' },
  C: { edit: 'border-grade-c bg-grade-c/6', view: 'border-grade-c bg-grade-c/10', check: 'text-grade-c' },
  D: { edit: 'border-grade-d bg-grade-d/6', view: 'border-grade-d bg-grade-d/10', check: 'text-grade-d' },
} as const;

/**
 * 정성(qualitative) KPI 자기평가용 등급 선택 피커.
 * 본인이 KPI 작성 시 세운 등급 기준(gradingCriteria S~D)을 행으로 펼치고,
 * 해당하는 등급 행을 직접 클릭해 선택한다. 선택값은 directGrade 로 전송된다.
 */
export function GradeCriteriaPicker({
  kpi,
  value,
  onSelect,
  readOnly,
}: {
  kpi: Kpi;
  value?: Grade;
  onSelect: (g: Grade) => void;
  readOnly?: boolean;
}) {
  const gc = kpi.gradingCriteria;
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5">
        <span className="text-12 font-semibold text-neutral-800">등급 부여 기준</span>
        <span className="text-11 text-neutral-500">
          {readOnly ? '· 선택한 등급' : '· 달성한 등급의 기준을 눌러 선택하세요'}
        </span>
      </div>
      <div className="overflow-x-auto">
        <div className="grid min-w-190 grid-cols-5 gap-2">
          {GRADE_ORDER.map((g) => {
            const text = (gc?.[g] ?? '').trim();
            const selected = value === g;
            const tone = SELECTED_TONE[g];
            return (
              <div
                key={g}
                className={cn(
                  'min-w-0 rounded-md border',
                  selected ? (readOnly ? tone.view : tone.edit) : 'border-input',
                )}
              >
                <Button
                  variant="ghost"
                  size="choice"
                  disabled={readOnly}
                  onClick={() => onSelect(g)}
                  aria-pressed={selected}
                >
                  <Badge variant={selected ? GRADE_VARIANT[g] : 'muted'} size="grade-sm" className="shrink-0">
                    {g}
                  </Badge>
                  <span
                    className={cn(
                      'min-w-0 flex-1 text-12 leading-relaxed',
                      !text && 'text-neutral-400',
                      text && selected && 'font-semibold text-neutral-950',
                      text && !selected && 'text-neutral-700',
                    )}
                  >
                    {text || '기준 미작성'}
                  </span>
                  {selected && <Check className={cn('size-3.5 shrink-0', tone.check)} />}
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
