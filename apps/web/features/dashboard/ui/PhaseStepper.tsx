'use client';

// 평가 진행 단계 — 시안: 완료=파란 체크, 진행중=파란 숫자+파란 라벨, 대기=회색 숫자.
import { Check } from 'lucide-react';

export type StepState = 'done' | 'active' | 'pending';

export interface PhaseStep {
  label: string;
  state: StepState;
}

const STATE_TEXT: Record<StepState, string> = { done: '완료', active: '진행중', pending: '대기' };

export function PhaseStepper({ steps }: { steps: PhaseStep[] }) {
  const lastDoneOrActive = steps.reduce((acc, s, i) => (s.state !== 'pending' ? i : acc), -1);
  return (
    <section className="rounded-lg border border-border bg-white px-6 py-5 shadow-elev-1">
      <h2 className="mb-5 text-[14px] font-semibold text-foreground">평가 진행 단계</h2>
      <div className="relative grid" style={{ gridTemplateColumns: `repeat(${steps.length}, 1fr)` }}>
        {/* 연결선 — 노드 중심(y=18px) 기준, 진행 구간은 파란색 */}
        <div
          className="absolute top-[18px] h-0.5 bg-border"
          style={{ left: `${100 / (steps.length * 2)}%`, right: `${100 / (steps.length * 2)}%` }}
          aria-hidden
        />
        {lastDoneOrActive > 0 && (
          <div
            className="absolute top-[18px] h-0.5 bg-primary"
            style={{
              left: `${100 / (steps.length * 2)}%`,
              width: `${(lastDoneOrActive / steps.length) * 100}%`,
            }}
            aria-hidden
          />
        )}
        {steps.map((s, i) => (
          <div key={s.label} className="relative z-10 flex flex-col items-center gap-2 text-center">
            <span
              className={[
                'flex h-9 w-9 items-center justify-center rounded-full border-2 text-[14px] font-bold',
                s.state === 'done'
                  ? 'border-primary bg-primary text-white'
                  : s.state === 'active'
                    ? 'border-primary bg-white text-primary'
                    : 'border-input bg-white text-neutral-500',
              ].join(' ')}
            >
              {s.state === 'done' ? <Check size={16} strokeWidth={2.5} aria-hidden /> : i + 1}
            </span>
            <div>
              <p className={`text-[13px] font-semibold ${s.state === 'active' ? 'text-primary' : s.state === 'done' ? 'text-foreground' : 'text-muted-foreground'}`}>
                {s.label}
              </p>
              <p className={`text-[11.5px] ${s.state === 'active' ? 'text-primary' : 'text-neutral-500'}`}>
                {STATE_TEXT[s.state]}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
