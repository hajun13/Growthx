'use client';

// 6월 중간점검 — 탭 분리 재구성(2026-06-09).
//  - "내 점검" 탭: 본인 KPI 진척 + KPI별 자가점검 제출 (employee·부서장 모두)
//  - "구성원 점검" 탭: 팀장/본부장/HR만. 구성원 목록·검토·재조정 검토 큐·조직 진척.
//  - 탭이 1개뿐이면 탭바 없이 그 내용만 렌더.
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { canEvaluateDownward, isHrAdmin } from '@/lib/nav';
import { PageContainer } from '@/components/PageContainer';
import { PageHeader } from '@/components/PageHeader';
import { HeaderMetrics } from '@/components/HeaderMetrics';
import { Tabs } from '@/components/Tabs';
import { EmptyState, ErrorState, Skeleton } from '@/components/States';
import { StatusBadge } from '@/components/StatusBadge';
import { EmployeeMidterm } from './EmployeeMidterm';
import { DeptHeadMidterm } from './DeptHeadMidterm';

type TabKey = 'my' | 'team';

export function MidtermView() {
  const { user } = useAuth();
  const { current, cycles, selectedId, setSelectedId, loading, error, reload } =
    useCurrentCycle();

  const [activeTab, setActiveTab] = useState<TabKey>('my');

  if (loading) {
    return (
      <PageContainer>
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-48 w-full" />
      </PageContainer>
    );
  }
  if (error) return <ErrorState onRetry={reload} />;
  if (!current || !user) {
    return (
      <PageContainer>
        <PageHeader title="중간 점검" />
        <EmptyState
          title="진행 중인 평가 주기가 없어요."
          description="평가 주기가 시작되면 중간 점검 데이터가 표시돼요."
        />
      </PageContainer>
    );
  }

  const cycleId = current.id;
  const isMidReview = current.status === 'mid_review';
  const isHr = isHrAdmin(user.role);

  // 탭 가시성 — 사원이면 "내 점검"만, 부서장/HR이면 둘 다(HR은 "구성원" 기본)
  const showMyTab = !isHr;
  const showTeamTab = canEvaluateDownward(user.role);

  const isSingleTab = (!showMyTab && showTeamTab) || (showMyTab && !showTeamTab);
  const effectiveTab: TabKey = !showMyTab ? 'team' : !showTeamTab ? 'my' : activeTab;

  // 탭 아이템 구성
  const tabItems = [
    ...(showMyTab ? [{ key: 'my', label: '내 점검' }] : []),
    ...(showTeamTab ? [{ key: 'team', label: '구성원 점검' }] : []),
  ];

  return (
    <PageContainer>
      <PageHeader
        title="중간 점검"
        subtitle={
          <>
            상반기 KPI 진척을 점검하고 자가점검을 제출하세요.
            <br />
            점검·코칭 단계의 입력 내용은 등급·연봉에 반영되지 않는 참고용이에요.
            <br />
            자가점검을 제출하면 부서장 피드백을 받을 수 있어요.
          </>
        }
        cycles={cycles}
        selectedId={selectedId}
        onSelectCycle={setSelectedId}
        right={
          <>
            <HeaderMetrics
              items={[
                { label: '평가 주기', value: current.name },
                { label: '내 점검', value: showMyTab ? '대상' : '제외' },
                { label: '구성원 점검', value: showTeamTab ? '대상' : '제외' },
              ]}
            />
            <StatusBadge status={isMidReview ? 'in_progress' : 'not_started'} />
          </>
        }
      />

      <div className="rounded-lg border border-border bg-card px-4 py-3 shadow-elev-1">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="min-w-[220px]">
            <p className="text-[11px] font-semibold text-muted-foreground">지금 할 일</p>
            <p className="text-[13px] font-semibold text-foreground">
              {isMidReview
                ? effectiveTab === 'team'
                  ? '구성원 자가점검과 보완 조치를 확인하세요.'
                  : '상반기 KPI 진척과 자가점검 내용을 입력하세요.'
                : '중간 점검 기간이 열리면 입력할 수 있어요.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-[12px] text-muted-foreground">
            <span className="rounded-md border border-border bg-muted px-2 py-1">현재 탭 {effectiveTab === 'team' ? '구성원 점검' : '내 점검'}</span>
            <span className="rounded-md border border-border bg-muted px-2 py-1">
              상태 {isMidReview ? '진행 중' : '대기'}
            </span>
          </div>
        </div>
      </div>

      {/* 탭 바 — 단일 탭이면 숨김 */}
      {!isSingleTab && (
        <Tabs
          items={tabItems}
          activeKey={effectiveTab}
          onChange={(k) => setActiveTab(k as TabKey)}
        />
      )}

      {/* 탭 콘텐츠 */}
      {effectiveTab === 'my' && !isHr && (
        <EmployeeMidterm
          cycleId={cycleId}
          user={user}
          readOnly={!isMidReview}
        />
      )}

      {effectiveTab === 'team' && canEvaluateDownward(user.role) && (
        <DeptHeadMidterm
          cycleId={cycleId}
          user={user}
          readOnly={!isMidReview}
        />
      )}
    </PageContainer>
  );
}
