'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { useResults } from '@/hooks/useResults';
import { PageHeader } from '@/components/PageHeader';
import { InfoBanner } from '@/components/InfoBanner';
import { Card } from '@/components/Card';
import { GradeChip } from '@/components/GradeChip';
import { DistributionBarChart } from '@/components/DistributionBarChart';
import { ResultTable, type ResultTableColumn } from '@/components/ResultTable';
import { EmptyState, ErrorState, Forbidden, Skeleton } from '@/components/States';
import { canReview } from '@/lib/nav';
import { fmtScore, fmtPercent } from '@/lib/ui';
import type { Grade, EvaluationResult } from '@/lib/types';

const GRADES: Grade[] = ['S', 'A', 'B', 'C', 'D'];

const COLUMNS: ResultTableColumn[] = [
  { key: 'userId', label: '대상자' },
  { key: 'grade', label: '최종등급', align: 'center' },
  { key: 'score', label: '점수', align: 'right' },
  { key: 'percentile', label: 'percentile', align: 'right' },
];

export default function ReportsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const {
    cycles,
    current,
    selectedId,
    setSelectedId,
    loading: cyclesLoading,
  } = useCurrentCycle();
  const cycleId = current?.id;

  const allowed = !!user && canReview(user.role);

  const { data, loading, error, reload } = useResults(
    { cycleId },
    { enabled: !!cycleId && allowed },
  );
  const results: EvaluationResult[] = data?.data ?? [];

  const counts = useMemo(() => {
    const c: Record<Grade, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 };
    for (const r of results) if (r.finalGrade) c[r.finalGrade] += 1;
    return c;
  }, [results]);

  const avg = useMemo(() => {
    const scored = results.filter((r) => r.finalScore !== null);
    if (scored.length === 0) return null;
    return (
      scored.reduce((acc, r) => acc + (r.finalScore ?? 0), 0) / scored.length
    );
  }, [results]);

  const rows = useMemo(
    () =>
      results.map((r) => ({
        _key: r.id,
        userId: r.userId.slice(0, 8),
        grade: <GradeChip grade={r.finalGrade} size="sm" />,
        score: fmtScore(r.finalScore),
        percentile:
          r.percentile === null ? '—' : fmtPercent(r.percentile),
        __userId: r.userId,
      })),
    [results],
  );

  if (!allowed) {
    return <Forbidden message="분포 모니터링은 팀장 이상만 볼 수 있어요." />;
  }
  if (cyclesLoading || loading) return <Skeleton className="h-64 w-full" />;
  if (error) return <ErrorState onRetry={reload} />;
  if (!current) return <EmptyState title="진행 중인 평가 주기가 없어요." />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="등급 분포 모니터링"
        subtitle="그룹 등급 풀 기준으로 분포가 균형 잡혔는지 확인하세요."
        cycles={cycles}
        selectedId={selectedId}
        onSelectCycle={setSelectedId}
      />

      <InfoBanner tone="info" title="분포 모니터링 안내">
        등급은 그룹 단위 풀로 관리돼요. 막대를 보고 특정 등급에 쏠림이 없는지
        확인하고, 행을 클릭하면 개인 상세결과로 이동해요.
      </InfoBanner>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="대상자" value={`${results.length}명`} />
        <StatCard
          label="집계 완료"
          value={`${results.filter((r) => r.finalGrade !== null).length}명`}
          tone="success"
        />
        <StatCard
          label="전사 평균"
          value={fmtScore(avg)}
          tone="info"
        />
        <StatCard
          label="최다 등급"
          value={
            (Object.entries(counts) as [Grade, number][]).sort(
              (a, b) => b[1] - a[1],
            )[0]?.[1]
              ? (Object.entries(counts) as [Grade, number][]).sort(
                  (a, b) => b[1] - a[1],
                )[0][0]
              : '–'
          }
          tone="purple"
        />
      </div>

      <Card title="등급 분포">
        {results.length === 0 ? (
          <EmptyState title="표시할 결과가 없어요." />
        ) : (
          <DistributionBarChart
            counts={counts}
            total={results.length}
            avg={avg}
          />
        )}
      </Card>

      <Card title="결과 테이블">
        <ResultTable
          columns={COLUMNS}
          rows={rows}
          emptyLabel="표시할 결과가 없어요."
          onRowClick={(row) => {
            const uid = (row as { __userId?: string }).__userId;
            if (uid) router.push(`/eval/result/${uid}?cycleId=${cycleId}`);
          }}
        />
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'success' | 'info' | 'purple';
}) {
  const toneClass: Record<string, string> = {
    neutral: 'border-border bg-card text-foreground',
    success: 'border-[#B6E6CC] bg-[#E7F8EF] text-[#0B7544]',
    info: 'border-[#BBD6FB] bg-[#EBF3FE] text-[#1B4DCB]',
    purple: 'border-[#D3D1F4] bg-[#ECEBFB] text-[#4B43BD]',
  };
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${toneClass[tone]}`}>
      <p className="text-xs font-semibold opacity-80">{label}</p>
      <p className="mt-1 text-2xl font-extrabold tabular-nums">{value}</p>
    </div>
  );
}
