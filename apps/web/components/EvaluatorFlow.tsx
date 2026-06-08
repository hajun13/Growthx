'use client';

import { ArrowRight, User, Users, Building2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fmtScore } from '@/lib/ui';
import type { Grade } from '@/lib/types';

// 평가자 플로우: 본인평가 → 부서장 평가(단일 캐스케이드 — 직속 부서장 1명).
// 수평/상향 단계 없음(우리 도메인). 각 단계 점수/등급 표시.
// key 'downward2' 는 데이터 shape 호환을 위해 보존(과거 결과 렌더 폴백).
export interface EvaluatorStep {
  key: 'self' | 'downward1' | 'downward2';
  label: string;
  sublabel: string;
  score: number | null;
  grade: Grade | null;
}

const ICONS: Record<EvaluatorStep['key'], LucideIcon> = {
  self: User,
  downward1: Users,
  downward2: Building2,
};

const TONE: Record<EvaluatorStep['key'], string> = {
  self: 'bg-[#EBF3FE] text-[#1B64DA] ring-[#BBD6FB]',
  downward1: 'bg-[#ECEBFB] text-[#4B43BD] ring-[#D3D1F4]',
  downward2: 'bg-[#E7F8EF] text-[#0F9457] ring-[#B6E6CC]',
};

export interface EvaluatorFlowProps {
  steps: EvaluatorStep[];
}

export function EvaluatorFlow({ steps }: EvaluatorFlowProps) {
  return (
    <ol className="flex flex-col items-stretch gap-3 md:flex-row md:items-center">
      {steps.map((step, i) => {
        const Icon = ICONS[step.key];
        const done = step.score !== null;
        return (
          <li key={step.key} className="contents">
            <div
              className={cn(
                'flex flex-1 items-center gap-3 border p-4',
                done ? 'border-border bg-card' : 'border-dashed border-border bg-muted/40',
              )}
            >
              <span
                className={cn(
                  'flex h-11 w-11 shrink-0 items-center justify-center ring-2',
                  done ? TONE[step.key] : 'bg-muted text-muted-foreground ring-border',
                )}
                aria-hidden
              >
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-foreground">{step.label}</p>
                <p className="text-xs font-medium text-muted-foreground">
                  {step.sublabel}
                </p>
              </div>
              <div className="text-right">
                {done ? (
                  <>
                    <p className="text-lg font-extrabold tabular-nums text-foreground">
                      {fmtScore(step.score)}
                    </p>
                    {step.grade && (
                      <p className="text-xs font-bold text-muted-foreground">
                        {step.grade} 등급
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm font-semibold text-muted-foreground">
                    미진행
                  </p>
                )}
              </div>
            </div>
            {i < steps.length - 1 && (
              <ArrowRight
                className="mx-auto hidden h-5 w-5 shrink-0 text-muted-foreground/50 md:block"
                aria-hidden
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
