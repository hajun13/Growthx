'use client';

/**
 * DeptHeadEvalView.tsx에서 분리 (파일 200줄 상한).
 * SelfStatusBanner / GradePicker — 부서장 평가 화면의 소형 보조 컴포넌트.
 */
import { Skeleton } from '@/components/States';
import { HelpTooltip } from '@/components/HelpTooltip';
import { InfoBanner } from '@/components/InfoBanner';
import { gradeColor } from '@/lib/grade';
import { cn } from '@/lib/utils';
import type { Evaluation, Grade } from '@/lib/types';

const GRADES: Grade[] = ['S', 'A', 'B', 'C', 'D'];

export function SelfStatusBanner({
  loading,
  selfEval,
  submitted,
}: {
  loading: boolean;
  selfEval: Evaluation | null;
  submitted: boolean;
}) {
  if (loading) return <Skeleton className="h-12 w-full" />;
  if (submitted) {
    return (
      <div className="inline-flex w-fit items-center gap-2 rounded-none border border-success-100 bg-muted px-3 py-2 text-[13px] font-semibold text-foreground">
        <span>본인평가 제출됨</span>
        <HelpTooltip
          label="본인평가 연동 설명 보기"
          content="팀원이 본인평가를 제출했어요. 실적이 아래에 연동돼요."
          className="text-foreground hover:text-success-900"
        />
      </div>
    );
  }
  return (
    <InfoBanner tone="warning">
      {selfEval
        ? '팀원이 본인평가를 아직 제출하지 않았어요(작성 중). 제출되면 실적이 연동되고 부서장 평가를 제출할 수 있어요.'
        : '팀원이 아직 본인평가를 시작하지 않았어요. 제출 후 부서장 평가를 진행할 수 있어요.'}
    </InfoBanner>
  );
}

export function GradePicker({
  value,
  onChange,
  readOnly,
}: {
  value: Grade | null;
  onChange: (g: Grade) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="flex gap-2 flex-1">
      {GRADES.map((g) => {
        const selected = value === g;
        return (
          <button
            key={g}
            type="button"
            disabled={readOnly}
            onClick={() => onChange(g)}
            className={cn(
              'flex-1 min-h-[40px] text-[14px] font-bold rounded-md border-2 transition-all',
              'disabled:opacity-40 disabled:cursor-not-allowed',
              selected
                ? 'border-current'
                : 'border-border bg-card text-muted-foreground hover:border-border/80',
            )}
            style={
              selected
                ? { background: gradeColor(g).fg, color: gradeColor(g).text, borderColor: gradeColor(g).fg }
                : undefined
            }
          >
            {g}
          </button>
        );
      })}
    </div>
  );
}
