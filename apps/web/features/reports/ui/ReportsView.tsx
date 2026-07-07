'use client';

// 분포 모니터링 화면 — image 14 재현. 오케스트레이션만(탭 전환·헤더 요약), 탭 본체는 하위 컴포넌트.
import { Suspense, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useCycleParam } from '@/hooks/useCycleParam';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { ExportButton } from '@/components/ExportButton';
import { EmptyState, Forbidden, Skeleton } from '@/components/States';
import { HeaderMetrics } from '@/components/HeaderMetrics';
import { SegmentedControl } from '@/components/SegmentedControl';
import { canReview, isHrAdmin } from '@/lib/nav';
import { fmtScore } from '@/lib/ui';
import type { Grade } from '@/lib/types';
import { useResultsData } from '../hooks';
import { DistMonitorTab } from './DistMonitorTab';
import { MonthlyPerfTab } from './MonthlyPerfTab';

type Tab = 'dist' | 'monthly';

export function ReportsView() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <ReportsViewInner />
    </Suspense>
  );
}

function ReportsViewInner() {
  const { user } = useAuth();
  const { cycles, current, selectedId, setSelectedId, loading: cyclesLoading } = useCycleParam();
  const cycleId = current?.id;
  const allowed = !!user && canReview(user.role);

  const [tab, setTab] = useState<Tab>('dist');

  // 결과 공개 게이트 — closed 전이면 "집계 완료" 대신 잠정 표기(hr_admin 은 백엔드 게이트 면제 → 표기로 방어).
  const isClosed = current?.status === 'closed';

  // 분포 데이터 — 헤더 요약 + DistMonitorTab 공유(헤더에 요약을 올리기 위해 View 레벨로 끌어올림).
  const { data: results, loading: resultsLoading, error: resultsError, reload: reloadResults } =
    useResultsData(cycleId);

  const distSummary = useMemo(() => {
    const counts: Record<Grade, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 };
    for (const r of results) if (r.finalGrade) counts[r.finalGrade] += 1;
    const finalizedCount = results.filter((r) => r.finalGrade !== null).length;
    const scored = results.filter((r) => r.finalScore !== null);
    const avg = scored.length
      ? scored.reduce((acc, r) => acc + (r.finalScore ?? 0), 0) / scored.length
      : null;
    const sorted = (Object.entries(counts) as [Grade, number][]).sort((a, b) => b[1] - a[1]);
    const topGrade: Grade | '–' = sorted[0]?.[1] > 0 ? sorted[0][0] : '–';
    return { finalizedCount, avg, topGrade };
  }, [results]);

  if (!allowed) return <Forbidden message="분포 모니터링은 팀장 이상만 볼 수 있어요." />;
  if (cyclesLoading) return <Skeleton className="h-64 w-full" />;
  if (!current) return <EmptyState title="진행 중인 평가 주기가 없어요." />;

  const topGrade = distSummary.topGrade;
  const topGradeAccent =
    topGrade === '–' ? undefined
    : topGrade === 'S' || topGrade === 'A' ? 'text-primary'
    : 'text-foreground';

  // 분포 탭 요약 — 헤더(엑셀 내보내기 왼편)에 표시.
  const distHeaderMetrics =
    tab === 'dist' && !resultsLoading && !resultsError ? (
      <HeaderMetrics
        items={[
          { label: '대상자', value: `${results.length}명` },
          {
            label: isClosed ? '집계 완료' : '집계 중(잠정)',
            value: `${distSummary.finalizedCount}명`,
            accent: 'text-primary',
          },
          { label: '전사 평균', value: fmtScore(distSummary.avg), accent: 'text-primary' },
          { label: '최다 등급', value: topGrade, accent: topGradeAccent },
        ]}
      />
    ) : null;

  return (
    <PageContainer>
      <PageHeader
        title="분포 모니터링"
        subtitle="등급 분포와 월별 실적 추이를 확인합니다."
        cycles={cycles}
        selectedId={selectedId}
        onSelectCycle={setSelectedId}
        right={
          <>
            {distHeaderMetrics}
            {user?.role === 'hr_admin' && cycleId && tab === 'dist' && (
              <ExportButton
                path={`/excel/export/distribution?cycleId=${cycleId}`}
                filename={`distribution-${cycleId}.xlsx`}
              />
            )}
          </>
        }
      />

      <SegmentedControl
        ariaLabel="분포 모니터링 탭"
        options={[
          { value: 'dist', label: '분포 모니터링' },
          { value: 'monthly', label: '월별 실적' },
        ]}
        value={tab}
        onChange={(v) => setTab(v as Tab)}
      />

      {tab === 'dist' ? (
        <DistMonitorTab
          cycleId={cycleId}
          cycleStatus={current.status}
          ruleSetId={current.ruleSetId}
          results={results}
          loading={resultsLoading}
          error={resultsError}
          reload={reloadResults}
        />
      ) : (
        <MonthlyPerfTab cycleId={cycleId} editable={isHrAdmin(user!.role)} />
      )}
    </PageContainer>
  );
}
