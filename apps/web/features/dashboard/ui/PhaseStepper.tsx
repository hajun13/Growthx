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
    <section className="rounded-[10px] border border-[#E7E9F3] bg-white px-6 py-5 shadow-[0_1px_3px_rgba(22,19,38,0.06),0_1px_2px_rgba(22,19,38,0.04)]">
      <h2 className="mb-5 text-[14px] font-semibold text-[#161326]">평가 진행 단계</h2>
      <div className="relative grid" style={{ gridTemplateColumns: `repeat(${steps.length}, 1fr)` }}>
        {/* 연결선 — 노드 중심(y=18px) 기준, 진행 구간은 파란색 */}
        <div
          className="absolute top-[18px] h-0.5 bg-[#E7E9F3]"
          style={{ left: `${100 / (steps.length * 2)}%`, right: `${100 / (steps.length * 2)}%` }}
          aria-hidden
        />
        {lastDoneOrActive > 0 && (
          <div
            className="absolute top-[18px] h-0.5 bg-[#0257CE]"
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
                  ? 'border-[#0257CE] bg-[#0257CE] text-white'
                  : s.state === 'active'
                    ? 'border-[#0257CE] bg-white text-[#0257CE]'
                    : 'border-[#D8DCEB] bg-white text-[#9B98AC]',
              ].join(' ')}
            >
              {s.state === 'done' ? <Check size={16} strokeWidth={2.5} aria-hidden /> : i + 1}
            </span>
            <div>
              <p className={`text-[13px] font-semibold ${s.state === 'active' ? 'text-[#0257CE]' : s.state === 'done' ? 'text-[#161326]' : 'text-[#6B6980]'}`}>
                {s.label}
              </p>
              <p className={`text-[11.5px] ${s.state === 'active' ? 'text-[#0257CE]' : 'text-[#9B98AC]'}`}>
                {STATE_TEXT[s.state]}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
