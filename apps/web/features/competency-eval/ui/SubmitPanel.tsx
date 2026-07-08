'use client';

// 역량평가 하단 고정 제출 액션 패널 — 진행률 요약 + 임시저장/최종제출.
import { Save, Send } from 'lucide-react';
import { Button } from '@/components/Button';
import { EvaluationActionPanel } from '@/components/EvaluationActionPanel';

export function SubmitPanel({
  answeredCount,
  totalCount,
  progressPct,
  allAnswered,
  saving,
  submitting,
  onSave,
  onSubmit,
}: {
  answeredCount: number;
  totalCount: number;
  progressPct: number;
  allAnswered: boolean;
  saving: boolean;
  submitting: boolean;
  onSave: () => void;
  onSubmit: () => void;
}) {
  return (
    <EvaluationActionPanel
      sticky
      message={allAnswered ? '모든 문항에 응답했어요.' : '모든 문항에 응답해야 제출할 수 있어요.'}
      summary={
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[12px] font-bold text-foreground">
            <span className={`tabular-nums ${allAnswered ? 'text-foreground' : 'text-primary'}`}>{answeredCount}</span>
            <span className="text-muted-foreground"> / {totalCount}문항</span>
          </span>
          <div className="h-1.5 w-[120px] overflow-hidden bg-muted">
            <div
              className={`h-full transition-all duration-300 ${allAnswered ? 'bg-foreground' : 'bg-primary'}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className={`text-xs font-semibold ${allAnswered ? 'text-foreground' : 'text-primary'}`}>
            {progressPct}%
          </span>
        </div>
      }
      actions={
        <>
          <Button variant="secondary" loading={saving} leftIcon={<Save size={14} />} onClick={onSave}>
            임시저장
          </Button>
          <Button
            variant="primary"
            loading={submitting}
            disabled={!allAnswered}
            leftIcon={<Send size={14} />}
            onClick={onSubmit}
          >
            최종 제출
          </Button>
        </>
      }
    />
  );
}
