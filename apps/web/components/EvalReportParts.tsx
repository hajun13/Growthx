// EvalReport 전용 표현 조각 — 등급 박스·알약·섹션 제목·점수 막대·그룹 카드.
// 인쇄창은 별도 document 라 EvalReport 가 화면 스타일시트를 복제해 넣는다(클래스 그대로 적용).
import type { CSSProperties, ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Grade } from '@/lib/types';
import { fmtScore } from '@/lib/ui';

// 점수(0~100) → 막대 채움 %.
export const pct = (s: number | null) => (s === null ? 0 : Math.max(0, Math.min(100, s)));

// 정적 클래스 룩업(Solid 등급 색 — Badge grade-* 와 같은 토큰).
export const GRADE_BG: Record<Grade, string> = {
  S: 'bg-grade-s',
  A: 'bg-grade-a',
  B: 'bg-grade-b',
  C: 'bg-grade-c',
  D: 'bg-grade-d',
};
const GRADE_FG: Record<Grade, string> = {
  S: 'text-gradeFg-s',
  A: 'text-gradeFg-a',
  B: 'text-gradeFg-b',
  C: 'text-gradeFg-c',
  D: 'text-gradeFg-d',
};
const GRADE_VARIANT = {
  S: 'grade-s',
  A: 'grade-a',
  B: 'grade-b',
  C: 'grade-c',
  D: 'grade-d',
} as const;

// 요약 영역 큰 등급 정사각 박스(42px).
export function GradeBox({ grade }: { grade: Grade | null }) {
  return (
    <div
      className={cn(
        'flex size-10.5 items-center justify-center rounded-md text-22 font-extrabold',
        grade ? cn(GRADE_BG[grade], GRADE_FG[grade]) : 'bg-neutral-500 text-neutral-0',
      )}
    >
      {grade ?? '–'}
    </div>
  );
}

// 작은 등급 알약(표 셀용).
export function GradePill({ grade }: { grade: Grade | null }) {
  if (!grade) return <span className="text-12 text-neutral-500">–</span>;
  return <Badge variant={GRADE_VARIANT[grade]}>{grade}</Badge>;
}

// 섹션 제목.
export function SectionTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-3 flex items-baseline gap-2">
      <span className="text-13 font-bold text-foreground">{children}</span>
      {hint && <span className="text-11 text-muted-foreground">{hint}</span>}
    </div>
  );
}

// 가로 점수 막대(표 셀) — 등급이 있으면 해당 등급 색으로 채운다(참고 행은 회색 유지).
export function ScoreBar({ score, dim, grade }: { score: number | null; dim?: boolean; grade?: Grade | null }) {
  if (score === null) {
    return <span className="text-11h text-neutral-500">미집계</span>;
  }
  const fill = dim ? 'bg-neutral-500' : grade ? GRADE_BG[grade] : 'bg-primary';
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="relative h-1.5 max-w-37.5 flex-1 rounded-xs bg-neutral-100">
        <div
          style={{ '--w': `${pct(score)}%` } as CSSProperties}
          className={cn('absolute top-0 left-0 h-1.5 w-(--w) rounded-xs', fill)}
        />
      </div>
      <span
        className={cn('min-w-10 text-right text-12h font-bold tabular-nums', dim ? 'text-neutral-800' : 'text-foreground')}
      >
        {fmtScore(score)}
      </span>
    </div>
  );
}

// KPI 그룹 카드 — 점·막대 색 = 해당 그룹의 실제 등급 색(등급 미집계 시 중립 회색).
export function GroupCard({
  label,
  weight,
  score,
  grade,
}: {
  label: string;
  weight: string;
  score: number | null;
  grade: Grade | null;
}) {
  const tone = grade ? GRADE_BG[grade] : 'bg-neutral-500';
  return (
    <div className="min-w-50 flex-1 rounded-md border border-border px-4.5 py-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.75">
          <span className={cn('size-2.25 rounded-xs', tone)} />
          <span className="text-12h font-bold text-foreground">{label}</span>
          <Badge variant="muted" size="xs">
            {weight}
          </Badge>
        </div>
        <GradePill grade={grade} />
      </div>
      <div className="relative h-2 rounded-xs bg-neutral-100">
        <div
          style={{ '--w': `${pct(score)}%` } as CSSProperties}
          className={cn('absolute top-0 left-0 h-2 w-(--w) rounded-xs', tone)}
        />
      </div>
      <div className="mt-2 text-right">
        <span className="text-15 font-extrabold tabular-nums text-foreground">{fmtScore(score)}</span>
        <span className="text-11 text-muted-foreground"> / 100</span>
      </div>
    </div>
  );
}
