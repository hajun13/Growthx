'use client';

// 진행 스테퍼 — image 13: 접수→검토중→부서장 답변→HR 최종 결정, 완료 노드는 파란 체크.
import { Check } from 'lucide-react';
import type { Appeal } from '../hooks';
import { TIMELINE_STEPS, STATUS_STEP } from './appealTimeline';

// 단계별 완료일시·담당자 — 백엔드 타임스탬프(reviewStartedAt/respondedAt/decidedAt) + 실명(respondedByName/decidedByName) 실배선.
function stepMeta(appeal: Appeal, idx: number): { date: string | null; actor: string | null; done: boolean } {
  const step = STATUS_STEP[appeal.status];
  // 'YYYY.MM.DD HH:MM' — 목업과 동일한 일시 표기.
  const d = (iso: string | null | undefined) =>
    iso ? `${iso.slice(0, 10).replaceAll('-', '.')} ${iso.slice(11, 16)}` : null;
  const applicant = appeal.userName ?? null;
  const responder = appeal.respondedByName ?? (appeal.respondedById ? '부서장' : null);
  const decider = appeal.decidedByName ?? (appeal.status === 'closed' ? 'HR' : null);
  if (idx === 0) return { date: d(appeal.createdAt), actor: applicant, done: true };
  if (idx === 1) return { date: step >= 1 ? d(appeal.reviewStartedAt) ?? d(appeal.createdAt) : null, actor: step >= 1 ? responder : null, done: step >= 1 };
  if (idx === 2) return { date: step >= 2 ? d(appeal.respondedAt) ?? d(appeal.updatedAt) : null, actor: step >= 2 ? responder : null, done: step >= 2 };
  return { date: step >= 3 ? d(appeal.decidedAt) ?? d(appeal.updatedAt) : null, actor: step >= 3 ? decider : null, done: step >= 3 };
}

export function AppealStepper({ appeal }: { appeal: Appeal }) {
  const currentStep = STATUS_STEP[appeal.status];
  return (
    // 연결선 top = 컨테이너 pt-2(8px) + 원 반지름(h-9/2=18px) - 선 두께/2(1px) = 25px — 원 중심 정렬.
    <div className="relative grid grid-cols-4 gap-1 pt-2">
      <div className="absolute left-[12.5%] right-[12.5%] top-[25px] h-0.5 bg-border" aria-hidden />
      <div
        className="absolute left-[12.5%] top-[25px] h-0.5 bg-primary transition-all"
        style={{ width: `${(Math.min(currentStep, 3) / 3) * 75}%` }}
        aria-hidden
      />
      {TIMELINE_STEPS.map((step, idx) => {
        const meta = stepMeta(appeal, idx);
        const isActive = currentStep === idx && !meta.done;
        return (
          <div key={step.key} className="relative z-10 flex flex-col items-center text-center">
            <div
              className={[
                'flex h-9 w-9 items-center justify-center rounded-full border-2',
                meta.done
                  ? 'border-primary bg-primary'
                  : isActive
                    ? 'border-primary bg-card'
                    : 'border-border bg-card',
              ].join(' ')}
            >
              {meta.done ? (
                <Check size={16} className="text-primary-foreground" strokeWidth={2.5} aria-hidden />
              ) : (
                <span className={isActive ? 'text-primary' : 'text-muted-foreground'}>{idx + 1}</span>
              )}
            </div>
            <div className={`mt-1.5 text-[12px] font-semibold ${meta.done || isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
              {step.label}
            </div>
            <div className="text-[10.5px] tabular-nums text-muted-foreground">
              {meta.date ?? (idx === currentStep ? '진행중' : '-')}
            </div>
            {meta.actor && (
              <div className="text-[10.5px] text-muted-foreground">{meta.actor}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
