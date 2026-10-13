'use client';

// 평가 진행 단계 — 시안: 완료=파란 체크, 진행중=파란 숫자+파란 라벨, 대기=회색 숫자.
import { Check } from 'lucide-react';
import { Card } from '@/components/ui/card';

export type StepState = 'done' | 'active' | 'pending';

export interface PhaseStep {
  label: string;
  state: StepState;
}

const STATE_TEXT: Record<StepState, string> = { done: '완료', active: '진행중', pending: '대기' };

export function PhaseStepper({ steps }: { steps: PhaseStep[] }) {
  const lastDoneOrActive = steps.reduce((acc, s, i) => (s.state !== 'pending' ? i : acc), -1);
  return (
    <Card className="px-6 py-5">
      <h2 className="mb-5 text-14 font-semibold text-foreground">평가 진행 단계</h2>
      <div
        className="relative grid grid-cols-(--cols)"
        style={
          {
            '--cols': `repeat(${steps.length}, 1fr)`,
            '--inset': `${100 / (steps.length * 2)}%`,
            '--done-w': `${(lastDoneOrActive / steps.length) * 100}%`,
          } as React.CSSProperties
        }
      >
        {/* 연결선 — 노드 중심(y=18px) 기준, 진행 구간은 파란색 */}
        <div className="absolute top-4.5 right-(--inset) left-(--inset) h-0.5 bg-border" aria-hidden />
        {lastDoneOrActive > 0 && (
          <div className="absolute top-4.5 left-(--inset) h-0.5 w-(--done-w) bg-primary" aria-hidden />
        )}
        {steps.map((s, i) => (
          <div key={s.label} className="relative z-10 flex flex-col items-center gap-2 text-center">
            <span
              className={[
                'flex h-9 w-9 items-center justify-center rounded-full border-2 text-14 font-bold',
                s.state === 'done'
                  ? 'border-primary bg-primary text-white'
                  : s.state === 'active'
                    ? 'border-primary bg-card text-primary'
                    : 'border-input bg-card text-neutral-500',
              ].join(' ')}
            >
              {s.state === 'done' ? <Check size={16} strokeWidth={2.5} aria-hidden /> : i + 1}
            </span>
            <div>
              <p className={`text-13 font-semibold ${s.state === 'active' ? 'text-primary' : s.state === 'done' ? 'text-foreground' : 'text-muted-foreground'}`}>
                {s.label}
              </p>
              <p className={`text-11h ${s.state === 'active' ? 'text-primary' : 'text-neutral-500'}`}>
                {STATE_TEXT[s.state]}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
