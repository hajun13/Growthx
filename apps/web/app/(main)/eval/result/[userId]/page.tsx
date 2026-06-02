'use client';

import { Suspense, useMemo } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { useResultDetail } from '@/hooks/useResults';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { GradeChip } from '@/components/GradeChip';
import { ComparisonBar, type ComparisonRow } from '@/components/ComparisonBar';
import { ApiError } from '@/lib/api';
import {
  EmptyState,
  ErrorState,
  Forbidden,
  Skeleton,
} from '@/components/States';
import { fmtScore } from '@/lib/ui';
import type { EvaluationResultDetail } from '@/lib/types';

// byType(self/downward1/downward2) → ComparisonBar 행.
function toRows(detail: EvaluationResultDetail): ComparisonRow[] {
  const bt = detail.byType;
  if (!bt) return [];
  const rows: ComparisonRow[] = [];
  if (bt.self.score !== null)
    rows.push({
      type: 'self',
      label: '본인평가',
      score: bt.self.score,
      grade: bt.self.grade,
    });
  if (bt.downward1.score !== null)
    rows.push({
      type: 'downward',
      round: 1,
      label: '1차 팀장',
      score: bt.downward1.score,
      grade: bt.downward1.grade,
    });
  if (bt.downward2.score !== null)
    rows.push({
      type: 'downward',
      round: 2,
      label: '2차 본부장',
      score: bt.downward2.score,
      grade: bt.downward2.grade,
    });
  return rows;
}

export default function ResultDetailPage() {
  return (
    <Suspense fallback={<ResultSkeleton />}>
      <ResultDetailInner />
    </Suspense>
  );
}

function ResultDetailInner() {
  const params = useParams<{ userId: string }>();
  const searchParams = useSearchParams();
  const userId = params.userId;
  const { cycles, current, selectedId, setSelectedId } = useCurrentCycle();

  const cycleId = searchParams.get('cycleId') ?? current?.id ?? null;

  const { data, loading, error, reload } = useResultDetail(userId, cycleId);
  const rows = useMemo(() => (data ? toRows(data) : []), [data]);

  if (loading) return <ResultSkeleton />;
  if (error) {
    if (error instanceof ApiError && error.isForbidden) {
      return <Forbidden message="이 결과를 볼 권한이 없어요." />;
    }
    if (error instanceof ApiError && error.status === 404) {
      return (
        <EmptyState
          title="결과는 캘리브레이션 완료 후 공개돼요."
          description="아직 확정된 평가 결과가 없어요."
        />
      );
    }
    return <ErrorState onRetry={reload} />;
  }
  if (!data) return <EmptyState title="표시할 평가 결과가 없어요." />;

  const bt = data.byType;
  const comments = [
    bt?.downward1.comment
      ? { label: '팀장(1차)', content: bt.downward1.comment }
      : null,
    bt?.downward2.comment
      ? { label: '본부장(2차)', content: bt.downward2.comment }
      : null,
  ].filter((c): c is { label: string; content: string } => c !== null);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="평가 상세결과"
        cycles={cycles}
        selectedId={selectedId}
        onSelectCycle={setSelectedId}
        right={
          data.finalGrade !== null && (
            <Link href={`/appeals?resultId=${data.id}`}>
              <Button variant="secondary" size="sm">
                이의제기
              </Button>
            </Link>
          )
        }
      />

      <Card>
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3">
            <span className="text-sm text-neutral-600">종합평가</span>
            <GradeChip grade={data.finalGrade} size="md" />
            <span className="text-3xl font-bold tabular-nums text-neutral-900">
              {fmtScore(data.finalScore)}
            </span>
          </div>
          {data.finalGrade === null ? (
            <div className="text-sm text-neutral-500">
              아직 집계 전이에요. 캘리브레이션 완료 후 공개돼요.
            </div>
          ) : (
            <div className="text-sm text-neutral-600">
              {data.percentile !== null && (
                <>
                  상위{' '}
                  <span className="font-semibold text-neutral-900">
                    {data.percentile}%
                  </span>{' '}
                  ·{' '}
                </>
              )}
              전사 평균{' '}
              <span className="tabular-nums">{fmtScore(data.companyAvg)}</span>
            </div>
          )}
        </div>
      </Card>

      <Card title="유형별 비교 (본인 / 1차 팀장 / 2차 본부장)">
        {rows.length === 0 ? (
          <EmptyState title="비교할 평가 데이터가 없어요." />
        ) : (
          <ComparisonBar rows={rows} companyAvg={data.companyAvg} />
        )}
      </Card>

      <Card title="평가 코멘트">
        {comments.length === 0 ? (
          <p className="text-sm text-neutral-500">아직 코멘트가 없어요.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {comments.map((c) => (
              <li key={c.label} className="flex gap-3">
                <span
                  aria-hidden
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-50 text-sm font-semibold text-primary-700"
                >
                  {c.label.slice(0, 1)}
                </span>
                <div className="flex-1">
                  <span className="text-sm font-semibold text-neutral-900">
                    {c.label}
                  </span>
                  <p className="mt-1 whitespace-pre-wrap text-base text-neutral-700">
                    {c.content}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function ResultSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}
