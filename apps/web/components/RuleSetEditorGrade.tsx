'use client';

// ① 등급 척도 — 0~100 수평 구간 바 + 경계 stepper.
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Grade } from '@/lib/types';
import { GRADES, type RuleSetDraft } from './RuleSetEditorModel';
import {
  AxisTicks,
  ContentHeader,
  GRADE_BG,
  GradeBadge,
  HintBox,
  RuleError,
} from './RuleSetEditorParts';
import { Stepper } from './RuleSetEditorStepper';

export const clampPct = (n: number) => `${Math.max(0, Math.min(100, n))}%`;
export const BAR_MOTION = 'transition-all duration-150 ease-out';

export function GradeScaleSection({
  value,
  onSet,
  error,
}: {
  value: RuleSetDraft;
  onSet: (g: Grade, f: 'min' | 'max', n: number) => void;
  error?: string;
}) {
  const rows = GRADES.map((g) => value.gradeScale.find((e) => e.grade === g)!);
  // 세그먼트별 겹침/역전 판정(빨강 경고).
  const segBad = (i: number) => {
    const e = rows[i];
    if (!e) return false;
    if (e.min > e.max) return true;
    const next = rows[i + 1];
    if (next && e.min <= next.max) return true;
    return false;
  };

  return (
    <>
      <ContentHeader
        title="등급 척도 (점수 → 등급)"
        desc="최종 총점이 어느 구간에 들어가면 어떤 등급이 되는지 정해요."
      />
      <div className="space-y-4 p-6">
        <HintBox>
          아래 <b>0~100점 띠</b>에서 각 등급이 차지하는 구간을 한눈에 볼 수 있어요.
          예) S를 <b>90~100점</b>으로 정하면 총점 90점 이상은 S 등급이에요. 위
          등급의 최소점은 아래 등급의 최대점보다 커야 해요(구간이 겹치면 안 돼요).
        </HintBox>

        {/* 수평 구간 바(0~100) — 등급색 세그먼트 */}
        <div className="space-y-1">
          <div className="relative h-14 overflow-hidden rounded-md border border-border bg-muted">
            {rows.map((e, i) => {
              if (!e) return null;
              const left = Math.max(0, Math.min(100, e.min));
              const right = Math.max(0, Math.min(100, e.max));
              const w = Math.max(0, right - left);
              return (
                <div
                  key={e.grade}
                  title={`${e.grade} 등급 · ${e.min}~${e.max}점`}
                  style={
                    { '--l': clampPct(left), '--w': clampPct(w) } as React.CSSProperties
                  }
                  className={cn(
                    'absolute inset-y-0 left-(--l) flex w-(--w) items-center justify-center border-r border-neutral-0/45 text-12h font-bold text-neutral-0',
                    BAR_MOTION,
                    segBad(i) ? 'bg-danger-600 opacity-85' : GRADE_BG[e.grade],
                  )}
                >
                  {w >= 8 ? e.grade : ''}
                </div>
              );
            })}
          </div>
          {/* 눈금(0/25/50/75/100) */}
          <AxisTicks labels={['0', '25', '50', '75', '100']} />
        </div>

        {/* 경계 편집 행(stepper) */}
        <div className="space-y-2.5">
          {GRADES.map((g, i) => {
            const e = value.gradeScale.find((x) => x.grade === g)!;
            const bad = segBad(i);
            return (
              <div
                key={g}
                className={cn(
                  'flex items-center gap-3 rounded-md border px-3.5 py-2.5',
                  bad ? 'border-danger-600 bg-danger-50' : 'border-border bg-card',
                )}
              >
                <div className={cn('h-7 w-2 shrink-0', GRADE_BG[g])} />
                <GradeBadge grade={g} />
                <Stepper
                  ariaLabel={`${g} 등급 최소점`}
                  value={e?.min ?? 0}
                  onChange={(n) => onSet(g, 'min', n ?? 0)}
                  min={0}
                  max={100}
                  suffix="점"
                  className="w-33"
                />
                <span className="text-13 text-neutral-400">~</span>
                <Stepper
                  ariaLabel={`${g} 등급 최대점`}
                  value={e?.max ?? 0}
                  onChange={(n) => onSet(g, 'max', n ?? 0)}
                  min={0}
                  max={100}
                  suffix="점"
                  className="w-33"
                />
                {bad && (
                  <span className="ml-auto flex items-center gap-1 text-11 font-semibold text-danger-600">
                    <AlertTriangle size={12} /> 구간 확인
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <RuleError msg={error} />
      </div>
    </>
  );
}
