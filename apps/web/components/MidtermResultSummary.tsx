'use client';

// RES(mid_review) 분기 본문 — component-spec-midterm §7.
// 결과 페이지가 mid_review 일 때 등급/보상 숨기고 진척 요약으로 대체(비구속).
import { InfoBanner } from './InfoBanner';
import { Card } from './Card';
import { Avatar } from './Avatar';
import { MidtermProgressTable } from './MidtermProgressTable';
import type { KpiProgress, MidtermReview } from '@/lib/types';

export interface MidtermResultSummaryProps {
  userName: string;
  departmentName: string;
  progress: KpiProgress[];
  review?: MidtermReview | null; // 부서장 중간 피드백(있으면 읽기전용 표시).
}

export function MidtermResultSummary({
  userName,
  departmentName,
  progress,
  review,
}: MidtermResultSummaryProps) {
  return (
    <>
      <InfoBanner tone="tip" title="중간 점검 결과예요 (비구속)">
        지금은 중간 점검 단계라 등급·보상은 아직 산정되지 않아요. 아래는 상반기
        진척 요약이에요. 최종 등급은 12월 최종평가에서 확정돼요.
      </InfoBanner>

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-elev-1">
        <div className="flex flex-wrap items-center justify-between gap-6 p-6">
          <div className="flex items-center gap-4">
            <Avatar name={userName} size="lg" />
            <div>
              <p className="text-lg font-bold text-foreground">{userName}</p>
              <p className="text-sm font-medium text-muted-foreground">{departmentName}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-stretch gap-3">
            {['종합', '성과중심', '협업·성장'].map((label, i) => (
              <div
                key={label}
                className={
                  'flex min-w-[96px] flex-col items-center justify-center gap-1 rounded-md border px-4 py-3 ' +
                  (i === 0
                    ? 'border-border bg-muted text-primary'
                    : 'border-border bg-muted/40 text-foreground')
                }
                aria-label={`${label} 등급: 점검 중, 아직 산정되지 않음`}
              >
                <span
                  className={
                    'text-xs font-semibold ' +
                    (i === 0 ? 'text-primary' : 'text-muted-foreground')
                  }
                >
                  {label}
                </span>
                <span className="text-2xl font-extrabold leading-none">–</span>
                <span
                  className={
                    'text-xs font-semibold ' +
                    (i === 0 ? 'text-primary' : 'text-muted-foreground')
                  }
                >
                  점검중
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="border-t border-border bg-muted/40 px-6 py-3 text-sm text-muted-foreground">
          등급·보상은 최종평가 완료 후 공개돼요.
        </div>
      </div>

      <Card title="상반기 진척 요약">
        <MidtermProgressTable items={progress} variant="result" showTrend={false} />
      </Card>

      {review?.reviewerNote && (
        <Card title="부서장 중간 피드백">
          <div className="flex gap-3">
            <Avatar name={review.reviewerName ?? '부서장'} size="sm" />
            <div className="flex-1">
              <span className="text-[13px] font-semibold text-foreground">
                {review.reviewerName ?? '부서장'}
              </span>
              <p
                className="mt-1 whitespace-pre-wrap text-[13.5px] leading-relaxed text-foreground"
              >
                {review.reviewerNote}
              </p>
            </div>
          </div>
        </Card>
      )}
    </>
  );
}
