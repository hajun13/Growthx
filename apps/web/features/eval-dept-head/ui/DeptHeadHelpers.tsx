'use client';

/**
 * DeptHeadEvalView.tsx에서 분리 (파일 200줄 상한).
 * SelfStatusBanner / GradePicker — 부서장 평가 화면의 소형 보조 컴포넌트.
 */
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { InfoBanner } from '@/components/InfoBanner';
import { HelpHint } from './HelpHint';
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
      <div className="inline-flex w-fit items-center gap-2 rounded-md border border-success-100 bg-muted px-3 py-2 text-13 font-semibold text-foreground">
        <span>본인평가 제출됨</span>
        <HelpHint
          label="본인평가 연동 설명 보기"
          content="구성원이 본인평가를 제출했어요. 실적이 아래에 연동돼요."
        />
      </div>
    );
  }
  return (
    <InfoBanner tone="warning">
      {selfEval
        ? '구성원이 본인평가를 아직 제출하지 않았어요(작성 중). 제출되면 실적이 연동되고 부서장 평가를 제출할 수 있어요.'
        : '구성원이 아직 본인평가를 시작하지 않았어요. 제출 후 부서장 평가를 진행할 수 있어요.'}
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
    <div className="flex flex-1 gap-2">
      {GRADES.map((g) => (
        <Button
          key={g}
          variant="grade-pick"
          size="grade-pick"
          data-grade={g.toLowerCase()}
          data-selected={value === g}
          disabled={readOnly}
          onClick={() => onChange(g)}
        >
          {g}
        </Button>
      ))}
    </div>
  );
}
