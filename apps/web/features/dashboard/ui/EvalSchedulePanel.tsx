'use client';

// 평가 일정 — 시안: 세로 타임라인(체크 도트) + 날짜 + 완료/진행중/대기 배지, 진행중 행 강조.
import { Check } from 'lucide-react';
import type { StepState } from './PhaseStepper';

export interface ScheduleItem {
  label: string;
  date: string;
  state: StepState;
}

const BADGE: Record<StepState, { label: string; cls: string }> = {
  done: { label: '완료', cls: 'bg-success-50 text-success-600' },
  active: { label: '진행중', cls: 'bg-info-50 text-primary' },
  pending: { label: '대기', cls: 'bg-muted text-muted-foreground' },
};

export function EvalSchedulePanel({ items }: { items: ScheduleItem[] }) {
  return (
    <section className="flex h-full flex-col rounded-lg border border-border bg-card p-5 shadow-elev-1">
      <h2 className="mb-3 text-[14px] font-semibold text-foreground">평가 일정</h2>
      {items.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-neutral-500">등록된 일정이 없어요.</p>
      ) : (
        <ul className="relative flex flex-1 flex-col justify-evenly">
          {/* 세로 연결선 — 원(size-5, px-1.5 패딩) 중심 x=16px 에 맞춤 */}
          <div className="absolute bottom-5 top-5 left-[15.5px] w-px bg-border" aria-hidden />
          {items.map((item) => (
            <li
              key={`${item.label}-${item.date}`}
              className={[
                'relative flex items-center gap-3 rounded-md px-1.5 py-2.5',
                item.state === 'active' ? 'bg-info-50/60' : '',
              ].join(' ')}
            >
              {/* 상태별 원 색 — 완료=민트 체크 / 진행중=블루 / 대기=회색 테두리 */}
              <span
                className={[
                  'z-10 flex size-5 shrink-0 items-center justify-center rounded-full border-2',
                  item.state === 'done'
                    ? 'border-brand-teal bg-brand-teal text-white'
                    : item.state === 'active'
                      ? 'border-primary bg-primary'
                      : 'border-input bg-card',
                ].join(' ')}
              >
                {item.state === 'done' && <Check size={11} strokeWidth={3} aria-hidden />}
                {item.state === 'active' && <span className="size-1.5 rounded-full bg-white" aria-hidden />}
              </span>
              <span className={`min-w-0 flex-1 truncate text-[13px] font-medium ${item.state === 'active' ? 'text-primary font-semibold' : 'text-neutral-800'}`}>
                {item.label}
              </span>
              <span className={`shrink-0 text-[12.5px] font-medium tabular-nums ${item.state === 'active' ? 'text-primary' : 'text-muted-foreground'}`}>
                {item.date}
              </span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${BADGE[item.state].cls}`}>
                {BADGE[item.state].label}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
