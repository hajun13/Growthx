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
import { InfoBanner } from '@/components/InfoBanner';
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
          !isMidReview ? (
            // 기간 외 — 제출·승인 없이 조회만 가능한 화면임을 부제부터 안내.
            <>
              지금은 중간점검 기간이 아니에요 — 제출된 자가점검·확인 내용을 조회할 수 있어요.
              <br />
              점검·코칭 단계의 입력 내용은 등급·연봉에 반영되지 않는 참고용이에요.
            </>
          ) : showTeamTab ? (
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
            {/* 기간 외에는 "미평가" 오해를 주는 not_started 배지 대신 사이클 상태 파생 라벨 */}
            {isMidReview ? (
              <StatusBadge status="in_progress" />
            ) : (
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                style={{ background: '#F4F5FA', color: '#6B6980' }}
              >
                {current.status === 'draft' || current.status === 'active' ? '시작 전' : '종료'}
              </span>
            )}
          </div>
        }
      />

      {/* 기간 외 읽기 전용 사유 안내 */}
      {!isMidReview && (
        <InfoBanner tone="info" title="지금은 중간점검 기간이 아니에요 — 조회만 가능해요">
          자가점검 제출·확인 결재·목표 재조정 신청은 중간점검 기간에만 할 수 있어요.
        </InfoBanner>
      )}

      {/* 페이지 레벨 단일 탭 바 — 단일 탭이면 숨김 */}
      {tabItems.length > 1 && (
        <Tabs
          items={tabItems}
          activeKey={effectiveTab}
          onChange={(k) => setActiveTab(k as TabKey)}
        />
      )}

      {/* 탭 콘텐츠 — 언마운트 대신 display:none 토글(DeptHeadMidterm 내부와 동일 패턴):
          작성 중이던 검토 의견·자가점검 입력이 탭 전환으로 무경고 유실되지 않는다. */}
      {showMyTab && (
        <div className={effectiveTab === 'my' ? 'block' : 'hidden'}>
          <EmployeeMidterm cycleId={cycleId} user={user} readOnly={!isMidReview} />
        </div>
      )}

      {showTeamTab && (
        <div className={effectiveTab === 'team' ? 'block' : 'hidden'}>
          <DeptHeadMidterm cycleId={cycleId} user={user} readOnly={!isMidReview} />
        </div>
      )}

      {/* 재조정 검토 — RebaselineReviewQueue 자체가 카드 프레임을 가지므로 래퍼 없이 렌더(카드 중첩 방지) */}
      {showTeamTab && (
        <div className={effectiveTab === 'rebaseline' ? 'block' : 'hidden'}>
          <RebaselineReviewQueue cycleId={cycleId} readOnly={!isMidReview} />
        </div>
      )}
    </PageContainer>
  );
}
