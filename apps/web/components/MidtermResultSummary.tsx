'use client';

// RES(mid_review) 분기 본문 — component-spec-midterm §7.
// 결과 페이지가 mid_review 일 때 등급/보상 숨기고 진척 요약으로 대체(비구속).
import { InfoBanner } from './InfoBanner';
import { Card } from './Card';
import { MidtermProgressTable } from './MidtermProgressTable';
import { T } from '@/lib/toss';
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

      {/* 다크 요약 카드 — 등급 박스 자리에 "점검중" 플레이스홀더. */}
      <div className="summary-dark overflow-hidden shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-6 p-6">
          <div className="flex items-center gap-4">
            <span
              aria-hidden
              className="flex h-14 w-14 items-center justify-center bg-white/10 text-xl font-bold text-white"
            >
              {userName.slice(0, 1)}
            </span>
            <div>
              <p className="text-lg font-bold text-white">{userName}</p>
              <p className="text-sm font-medium text-white/70">{departmentName}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-stretch gap-3">
            {['종합', '성과중심', '협업·성장'].map((label, i) => (
              <div
                key={label}
                className={
                  'flex min-w-[96px] flex-col items-center justify-center gap-1 px-4 py-3 ' +
                  (i === 0
                    ? 'bg-white text-[#18181c]'
                    : 'bg-white/10 text-white ring-1 ring-white/15')
                }
                aria-label={`${label} 등급: 점검 중, 아직 산정되지 않음`}
              >
                <span
                  className={
                    'text-xs font-semibold ' +
                    (i === 0 ? 'text-[#3f3f47]' : 'text-white/70')
                  }
                >
                  {label}
                </span>
                <span className="text-2xl font-extrabold leading-none">–</span>
                <span
                  className={
                    'text-xs font-semibold ' +
                    (i === 0 ? 'text-[#3f3f47]' : 'text-white/70')
                  }
                >
                  점검중
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="border-t border-white/10 px-6 py-3 text-sm text-white/80">
          등급·보상은 최종평가 완료 후 공개돼요.
        </div>
      </div>

      <Card title="상반기 진척 요약">
        <MidtermProgressTable items={progress} variant="result" showTrend={false} />
      </Card>

      {review?.reviewerNote && (
        <Card title="부서장 중간 피드백">
          <div className="flex gap-3">
            <span
              aria-hidden
              className="flex h-8 w-8 shrink-0 items-center justify-center bg-secondary text-sm font-semibold"
              style={{ color: T.grey700 }}
            >
              {(review.reviewerName ?? '부').slice(0, 1)}
            </span>
            <div className="flex-1">
              <span style={{ fontSize: 13, fontWeight: 600, color: T.grey900 }}>
                {review.reviewerName ?? '부서장'}
              </span>
              <p
                className="mt-1 whitespace-pre-wrap"
                style={{ fontSize: 13.5, color: T.grey800, lineHeight: 1.55 }}
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
