'use client';

// 6월 중간점검 — 사용자 친화 재구성(2026-07-02 사용자 피드백).
// 중첩 탭(상위 2 + 하위 3)을 페이지 레벨 탭 하나로 평탄화:
//  - "내 중간 점검": 본인 KPI 진척 + 자가점검 제출 + 내 재조정 신청 (employee·부서장 공통)
//  - "구성원 점검·평가": 팀장/본부장/HR — 구성원 목록 → 좌(자기점검)/우(상급자 의견·승인/반려)
//  - "재조정 검토": 팀장/본부장/HR — 대기 건수 배지로 할 일을 바로 노출
// 조직 진척 요약 탭은 제거(사용자 피드백 — 분포 모니터링과 중복).
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { canEvaluateDownward } from '@/lib/nav';
import { PageContainer } from '@/components/PageContainer';
import { PageHeader } from '@/components/PageHeader';
import { Tabs } from '@/components/Tabs';
import { EmptyState, ErrorState, Skeleton } from '@/components/States';
import { StatusBadge } from '@/components/StatusBadge';
import { useRebaselineRequests } from '@/hooks/useMidterm';
import { EmployeeMidterm } from './EmployeeMidterm';
import { DeptHeadMidterm } from './DeptHeadMidterm';
import { RebaselineReviewQueue } from './RebaselineReviewQueue';

type TabKey = 'my' | 'team' | 'rebaseline';

export function MidtermView() {
  const { user } = useAuth();
  // 작업 화면 — 항상 진행 주기 고정(주기 셀렉터 없음). 중간점검은 진행 주기에서만 의미가 있다.
  const { current, loading, error, reload } = useCurrentCycle();

  const [activeTab, setActiveTab] = useState<TabKey | null>(null);

  // 내 중간 점검은 역할과 무관하게 항상 노출 — HR/부서장도 본인 KPI 자가점검 대상일 수 있다
  // (본인 KPI가 없으면 탭 안에서 빈 상태 안내). 2026-07-02 사용자 피드백.
  const showMyTab = !!user;
  const showTeamTab = !!user && canEvaluateDownward(user.role);

  // 재조정 검토 대기 건수 — 탭 배지로 할 일을 바로 보여준다(검토자만 조회).
  const { data: rebaselineData } = useRebaselineRequests(
    { cycleId: current?.id, forReview: true },
    { enabled: !!current?.id && showTeamTab },
  );
  const rebaselinePending = rebaselineData?.data?.length ?? 0;

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

  const tabItems = [
    ...(showMyTab ? [{ key: 'my', label: '내 중간 점검' }] : []),
    ...(showTeamTab
      ? [
          { key: 'team', label: '구성원 점검·평가' },
          {
            key: 'rebaseline',
            label: '재조정 검토',
            badge: rebaselinePending > 0 ? rebaselinePending : undefined,
          },
        ]
      : []),
  ];
  const defaultTab: TabKey = showMyTab ? 'my' : 'team';
  const effectiveTab: TabKey =
    activeTab && tabItems.some((t) => t.key === activeTab) ? activeTab : defaultTab;

  return (
    <PageContainer>
      <PageHeader
        title="중간 점검"
        subtitle={
          showTeamTab ? (
            <>
              내 자가점검 제출 → 구성원 점검·승인 → 재조정 검토 순서로 진행하세요.
              <br />
              점검·코칭 단계의 입력 내용은 등급·연봉에 반영되지 않는 참고용이에요.
            </>
          ) : (
            <>
              상반기 KPI 진척을 점검하고 자가점검을 제출하세요. 목표 조정이 필요하면 재조정을 신청할 수 있어요.
              <br />
              점검·코칭 단계의 입력 내용은 등급·연봉에 반영되지 않는 참고용이에요.
            </>
          )
        }
        right={
          <div className="flex items-center gap-2">
            <span className="text-[12.5px] font-semibold text-muted-foreground">{current.name}</span>
            <StatusBadge status={isMidReview ? 'in_progress' : 'not_started'} />
          </div>
        }
      />

      {/* 페이지 레벨 단일 탭 바 — 단일 탭이면 숨김 */}
      {tabItems.length > 1 && (
        <Tabs
          items={tabItems}
          activeKey={effectiveTab}
          onChange={(k) => setActiveTab(k as TabKey)}
        />
      )}

      {effectiveTab === 'my' && showMyTab && (
        <EmployeeMidterm cycleId={cycleId} user={user} readOnly={!isMidReview} />
      )}

      {effectiveTab === 'team' && showTeamTab && (
        <DeptHeadMidterm cycleId={cycleId} user={user} readOnly={!isMidReview} />
      )}

      {/* 재조정 검토 — RebaselineReviewQueue 자체가 카드 프레임을 가지므로 래퍼 없이 렌더(카드 중첩 방지) */}
      {effectiveTab === 'rebaseline' && showTeamTab && (
        <RebaselineReviewQueue cycleId={cycleId} readOnly={!isMidReview} />
      )}
    </PageContainer>
  );
}
