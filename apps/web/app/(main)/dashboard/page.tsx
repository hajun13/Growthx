'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { useDashboard, useCompanyAchievement } from '@/hooks/useDashboard';
import { PageHeader } from '@/components/PageHeader';
import { InfoBanner } from '@/components/InfoBanner';
import { Card } from '@/components/Card';
import { WidgetCard } from '@/components/WidgetCard';
import { ProgressDonut } from '@/components/ProgressDonut';
import { DistributionBarChart } from '@/components/DistributionBarChart';
import { MonthlyTrendChart } from '@/components/MonthlyTrendChart';
import { AchievementGauge } from '@/components/AchievementGauge';
import { Progress } from '@/components/ui/progress';
import { GradeChip } from '@/components/GradeChip';
import { StatusBadge } from '@/components/StatusBadge';
import { ExportButton } from '@/components/ExportButton';
import { ResultTable } from '@/components/ResultTable';
import { Button } from '@/components/Button';
import { EmptyState, ErrorState, Forbidden, Skeleton } from '@/components/States';
import { isHrAdmin } from '@/lib/nav';
import { fmtPercent, fmtAmount } from '@/lib/ui';
import type { Grade } from '@/lib/types';

const ZERO: Record<Grade, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 };

export default function DashboardPage() {
  const { user } = useAuth();
  const {
    cycles,
    current,
    selectedId,
    setSelectedId,
    loading: cyclesLoading,
  } = useCurrentCycle();

  // 대시보드: hr_admin·division_head·team_lead 접근 허용. employee 차단.
  const allowed = !!user && user.role !== 'employee';
  // cycleId 미지정 시 백엔드가 최신 active 주기 사용 — selectedId 가 있으면 그걸 사용.
  const { data, loading, error, reload } = useDashboard(selectedId, {
    enabled: allowed,
  });
  const { data: companyAchievement } = useCompanyAchievement(selectedId, {
    enabled: allowed,
  });

  const companyTotal = useMemo(() => {
    const g = data?.gradeDistribution?.company ?? ZERO;
    return (Object.values(g) as number[]).reduce((a, b) => a + b, 0);
  }, [data]);

  if (!allowed) {
    return <Forbidden message="대시보드는 관리자·직책자만 접근할 수 있어요." />;
  }
  if (cyclesLoading || loading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      </div>
    );
  }
  if (error) return <ErrorState onRetry={reload} />;

  // 활성 주기 없음 → 안내(주기 만들기로).
  if (!data || data.cycleId === null) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="대시보드"
          cycles={cycles}
          selectedId={selectedId}
          onSelectCycle={setSelectedId}
        />
        <EmptyState
          title="진행 중인 평가 주기가 없어요."
          description="설정에서 평가 주기를 먼저 만들어 주세요."
          action={
            <Link href="/admin/settings">
              <Button variant="secondary" size="sm">
                주기 만들기
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  const cycleId = data.cycleId;
  const { progress, gradeDistribution, unsubmittedCount, appeals, avgRaiseRate } =
    data;
  // M3 Item 7: 확장 필드(백엔드 단계적 추가 — 없으면 섹션 생략).
  const groupGrades = data.groupGrades ?? [];
  const teamGoal = data.teamGoal ?? null;
  const monthlyTrend = data.monthlyTrend ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="대시보드"
        subtitle="활성 주기의 진행 상황을 한눈에 확인하세요."
        cycles={cycles}
        selectedId={selectedId}
        onSelectCycle={setSelectedId}
        right={
          <ExportButton
            path={`/excel/export/results?cycleId=${cycleId}`}
            filename={`results-${cycleId}.xlsx`}
          />
        }
      />

      <InfoBanner tone="info" title="진행 현황">
        {data.cycleName ?? '평가 주기'} ·{' '}
        {data.cycleStatus ? `상태 ${data.cycleStatus}` : '상태 미정'} · 본인평가
        제출률 {fmtPercent(progress.self.rate)}
      </InfoBanner>

      {/* 전사 목표 달성률 위젯 */}
      {companyAchievement && (
        <WidgetCard
          title="전사 목표 달성률"
          tone="success"
          footnote={`목표 ${fmtAmount(companyAchievement.totalTarget)} · 달성 ${fmtAmount(companyAchievement.totalActual)}`}
        >
          <div className="flex flex-col gap-3">
            <p className="widget-number text-4xl font-extrabold tabular-nums text-foreground">
              {fmtPercent(companyAchievement.achievementRate)}
            </p>
            <Progress
              value={Math.min(companyAchievement.achievementRate, 100)}
              className="h-2"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>목표 {fmtAmount(companyAchievement.totalTarget)}</span>
              <span>달성 {fmtAmount(companyAchievement.totalActual)}</span>
            </div>
          </div>
        </WidgetCard>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* 위젯1: 단계별 진행률(본인평가 기준 도넛) */}
        <WidgetCard
          title="단계별 진행률"
          footnote={`본인평가 ${progress.self.submitted}/${progress.self.total} 제출`}
          href="/reports"
          hrefLabel="진행 현황 보기"
        >
          <div className="flex items-center gap-4">
            <ProgressDonut
              done={progress.self.submitted}
              total={progress.self.total}
            />
            <ul className="flex flex-col gap-1 text-sm">
              <li className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">본인평가</span>
                <span className="tabular-nums">
                  {fmtPercent(progress.self.rate)}
                </span>
              </li>
              <li className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">1차 팀장</span>
                <span className="tabular-nums">
                  {fmtPercent(progress.downward1.rate)}
                </span>
              </li>
              <li className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">2차 본부장</span>
                <span className="tabular-nums">
                  {fmtPercent(progress.downward2.rate)}
                </span>
              </li>
            </ul>
          </div>
        </WidgetCard>

        {/* 위젯2: 미제출자 */}
        <WidgetCard
          title="미제출자"
          tone="danger"
          footnote="아직 제출하지 않은 평가 건수예요."
          href="/reports"
          hrefLabel="명단 보기"
        >
          <p className="widget-number text-3xl font-extrabold tabular-nums">
            {unsubmittedCount}건
          </p>
        </WidgetCard>

        {/* 위젯3: 전사 평균 인상률 */}
        <WidgetCard
          title="전사 평균 인상률"
          tone="success"
          footnote="확정 보상 기준 평균이에요."
          href="/admin/compensation"
          hrefLabel="보상 시뮬"
        >
          <p className="widget-number text-3xl font-extrabold tabular-nums text-foreground">
            {avgRaiseRate === null ? '–' : `+${avgRaiseRate}%`}
          </p>
        </WidgetCard>

        {/* 위젯4: 전사 등급 분포(넓은 칸) */}
        <WidgetCard
          title="전사 등급 분포"
          span={2}
          href="/reports"
          hrefLabel="모니터링"
        >
          <DistributionBarChart
            counts={gradeDistribution.company}
            total={companyTotal}
          />
        </WidgetCard>

        {/* 위젯5: 이의제기 현황 */}
        <WidgetCard
          title="이의제기 현황"
          footnote={`총 ${appeals.total}건`}
          href="/appeals"
          hrefLabel="이의제기"
        >
          <ul className="flex flex-col gap-2 text-sm">
            <li className="flex items-center justify-between">
              <StatusBadge status="submitted" />
              <span className="tabular-nums">{appeals.submitted}건</span>
            </li>
            <li className="flex items-center justify-between">
              <StatusBadge status="under_review" />
              <span className="tabular-nums">{appeals.under_review}건</span>
            </li>
            <li className="flex items-center justify-between">
              <StatusBadge status="answered" />
              <span className="tabular-nums">{appeals.answered}건</span>
            </li>
            <li className="flex items-center justify-between">
              <StatusBadge status="closed" />
              <span className="tabular-nums">{appeals.closed}건</span>
            </li>
          </ul>
        </WidgetCard>
      </div>

      {/* M3 Item 7: 그룹 등급 카드 — 각 그룹 현재 등급 + 달성률 게이지 */}
      {groupGrades.length > 0 && (
        <Card title="그룹별 목표 달성 현황">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {groupGrades.map((g) => (
              <div
                key={g.groupId}
                className="flex flex-col gap-3 rounded-xl border border-border p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-foreground">
                    {g.groupName}
                  </span>
                  <GradeChip grade={g.currentGrade} variant="solid" size="sm" />
                </div>
                <AchievementGauge rate={g.achievementRate} />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>목표 {fmtAmount(g.targetAmount)}</span>
                  <span>달성 {fmtAmount(g.actualAmount)}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* M3 Item 7: 팀 목표 달성 카드(팀장 가시) */}
      {teamGoal && (
        <Card title="우리 팀 목표 달성">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-8">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">현재 등급</span>
              <GradeChip grade={teamGoal.currentGrade} variant="solid" />
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-1 text-sm">
              <span>
                목표{' '}
                <span className="font-bold tabular-nums">
                  {fmtAmount(teamGoal.targetAmount)}
                </span>
              </span>
              <span>
                현재 달성{' '}
                <span className="font-bold tabular-nums">
                  {fmtAmount(teamGoal.actualAmount)}
                </span>
              </span>
            </div>
            <div className="min-w-[200px] flex-1">
              <AchievementGauge rate={teamGoal.achievementRate} />
            </div>
          </div>
        </Card>
      )}

      {/* M3 Item 7: 월별 트렌드 */}
      {monthlyTrend.length > 0 && (
        <Card title="월별 달성률 트렌드">
          <MonthlyTrendChart points={monthlyTrend} />
        </Card>
      )}

      {/* 단계별 제출 현황(full-width) */}
      <Card title="단계별 제출 현황">
        <ResultTable
          columns={[
            { key: 'phase', label: '단계' },
            { key: 'total', label: '대상', align: 'right' },
            { key: 'submitted', label: '제출', align: 'right' },
            { key: 'rate', label: '진행률', align: 'right' },
            { key: 'finalized', label: '확정', align: 'right' },
          ]}
          rows={[
            {
              _key: 'self',
              phase: '본인평가',
              total: progress.self.total,
              submitted: progress.self.submitted,
              rate: fmtPercent(progress.self.rate),
              finalized: progress.self.finalized,
            },
            {
              _key: 'downward1',
              phase: '1차 팀장',
              total: progress.downward1.total,
              submitted: progress.downward1.submitted,
              rate: fmtPercent(progress.downward1.rate),
              finalized: progress.downward1.finalized,
            },
            {
              _key: 'downward2',
              phase: '2차 본부장',
              total: progress.downward2.total,
              submitted: progress.downward2.submitted,
              rate: fmtPercent(progress.downward2.rate),
              finalized: progress.downward2.finalized,
            },
          ]}
        />
      </Card>
    </div>
  );
}
