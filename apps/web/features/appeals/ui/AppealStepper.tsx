'use client';

// 진행 스테퍼 — 접수→부서장 답변→HR 최종 결정 3단계(도달 불가 under_review 흡수).
// 기각(closed+reject)이면 마지막 노드를 danger 스타일 + "HR 최종 결정(기각)"으로 표시.
import { Check, X } from 'lucide-react';
import type { Appeal } from '../hooks';
import { TIMELINE_STEPS, STATUS_STEP, displayStatus } from './appealTimeline';

// 단계별 완료일시·담당자 — 백엔드 타임스탬프(respondedAt/decidedAt) + 실명(respondedByName/decidedByName) 실배선.
function stepMeta(appeal: Appeal, idx: number): { date: string | null; actor: string | null; done: boolean } {
  const step = STATUS_STEP[appeal.status];
  // 'YYYY.MM.DD HH:MM' — 목업과 동일한 일시 표기.
  const d = (iso: string | null | undefined) =>
    iso ? `${iso.slice(0, 10).replaceAll('-', '.')} ${iso.slice(11, 16)}` : null;
  const applicant = appeal.userName ?? null;
  const responder = appeal.respondedByName ?? (appeal.respondedById ? '부서장' : null);
  const decider = appeal.decidedByName ?? (appeal.status === 'closed' ? 'HR' : null);
  if (idx === 0) return { date: d(appeal.createdAt), actor: applicant, done: true };
  if (idx === 1) return { date: step >= 1 ? d(appeal.respondedAt) ?? d(appeal.updatedAt) : null, actor: step >= 1 ? responder : null, done: step >= 1 };
  return { date: step >= 2 ? d(appeal.decidedAt) ?? d(appeal.updatedAt) : null, actor: step >= 2 ? decider : null, done: step >= 2 };
}

const LAST_STEP = TIMELINE_STEPS.length - 1;

export function AppealStepper({ appeal }: { appeal: Appeal }) {
  const currentStep = STATUS_STEP[appeal.status];
  const rejected = displayStatus(appeal) === 'rejected';
  return (
    // 연결선 top = 컨테이너 pt-2(8px) + 원 반지름(h-9/2=18px) - 선 두께/2(1px) = 25px — 원 중심 정렬.
    // 3열: 각 칸 33.33%, 원 중심은 좌우 16.67% 지점.
    <div className="relative grid grid-cols-3 gap-1 pt-2">
      <div className="absolute left-[16.67%] right-[16.67%] top-[25px] h-0.5 bg-border" aria-hidden />
      <div
        className="absolute left-[16.67%] top-[25px] h-0.5 bg-primary transition-all"
        style={{ width: `${(Math.min(currentStep, LAST_STEP) / LAST_STEP) * 66.66}%` }}
        aria-hidden
      />
      {TIMELINE_STEPS.map((step, idx) => {
        const meta = stepMeta(appeal, idx);
        const isActive = currentStep === idx && !meta.done;
        const isRejectedNode = rejected && idx === LAST_STEP;
        return (
          <div key={step.key} className="relative z-10 flex flex-col items-center text-center">
            <div
              className={[
                'flex h-9 w-9 items-center justify-center rounded-full border-2',
                isRejectedNode
                  ? 'border-danger-600 bg-danger-600'
                  : meta.done
                    ? 'border-primary bg-primary'
                    : isActive
                      ? 'border-primary bg-card'
                      : 'border-border bg-card',
              ].join(' ')}
            >
              {isRejectedNode ? (
                <X size={16} className="text-primary-foreground" strokeWidth={2.5} aria-hidden />
              ) : meta.done ? (
                <Check size={16} className="text-primary-foreground" strokeWidth={2.5} aria-hidden />
              ) : (
                <span className={isActive ? 'text-primary' : 'text-muted-foreground'}>{idx + 1}</span>
              )}
            </div>
            <div
              className={`mt-1.5 text-[12px] font-semibold ${
                isRejectedNode ? 'text-danger-600' : meta.done || isActive ? 'text-foreground' : 'text-muted-foreground'
              }`}
            >
              {isRejectedNode ? 'HR 최종 결정(기각)' : step.label}
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
