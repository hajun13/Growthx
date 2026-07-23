'use client';

// 6월 중간점검 — 2단계 흐름(2026-07-23) 라우팅.
//   pending →(1차 코멘트) commented →(본인 수정) revised →(2차 판정) closed | returned →(재수정) revised
// 탭은 둘뿐이다:
//  - "내 중간 점검": 내가 피평가자인 건(내 차례면 수정 화면, 아니면 읽기 전용 이력)
//  - "구성원 점검": 내가 1차·2차 검토자로 배정된 건(좌측 목록 → 우측 상세, ReviewerQueue)
// 폐기: 자가점검 제출·재조정 신청/검토 화면(백엔드가 두 진입점을 모두 거부한다).
//
// ⚠ 탭 노출은 **role 이 아니라 데이터**로 판정한다. 부서장은 Department.headUserId 로 지정되므로
//    계정 role 이 employee 인 부서장이 실제로 존재한다(과거 canEvaluateDownward(role) 게이트가
//    그런 부서장에게서 검토 탭을 숨겼다 — 재도입 금지). 목록 API 가 이미 체인 스코프(본인·1차·2차)로
//    좁혀 주므로, 그 안에 내가 1차/2차인 행이 있으면 탭을 연다.
import { useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { PageContainer } from '@/components/PageContainer';
import { PageHeader } from '@/components/PageHeader';
import { Tabs } from '@/components/Tabs';
import { EmptyState, ErrorState, Skeleton } from '@/components/States';
import { StatusBadge } from '@/components/StatusBadge';
import { InfoBanner } from '@/components/InfoBanner';
import { useMidtermReviews } from '../hooks';
import { MemberRevisionPanel } from './MemberRevisionPanel';
import { ReviewerQueue } from './ReviewerQueue';
import { MidtermReadOnlyView, memberTurnLine } from './midtermFlowHelpers';
import type { MidtermReview } from '@/lib/types';

type TabKey = 'my' | 'team';

export function MidtermView() {
  const { user } = useAuth();
  // 작업 화면 — 항상 진행 주기 고정(주기 셀렉터 없음). 중간점검은 진행 주기에서만 의미가 있다.
  const { current, loading, error, reload } = useCurrentCycle();
  // 목록은 체인 스코프(본인·1차·2차) — 여기서 내 건과 내가 검토자인 건을 모두 얻는다.
  const reviews = useMidtermReviews({ cycleId: current?.id ?? null });

  const [activeTab, setActiveTab] = useState<TabKey | null>(null);
  // 액션 성공 후 패널을 리마운트해 상세(이력·코멘트)를 다시 읽게 하는 nonce.
  const [refreshKey, setRefreshKey] = useState(0);

  const rows = useMemo<MidtermReview[]>(() => reviews.data?.data ?? [], [reviews.data]);
  const myReview = useMemo(
    () => rows.find((r) => r.evaluateeId === user?.id) ?? null,
    [rows, user?.id],
  );
  // 내가 검토자인 건 — 배정 필드로만 판정(role 무관). 내 건은 '내 중간 점검' 탭 몫이라 제외.
  const reviewerRows = useMemo(
    () =>
      rows.filter(
        (r) =>
          !!user &&
          r.evaluateeId !== user.id &&
          (r.firstReviewerId === user.id || r.finalReviewerId === user.id),
      ),
    [rows, user],
  );

  // 액션 성공 후: 목록 갱신 + 상세 재조회(패널 리마운트).
  function handleDone() {
    reviews.reload();
    setRefreshKey((k) => k + 1);
  }

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

  const me = user; // 위 가드로 non-null 확정 — 아래 클로저에서 그대로 쓴다.
  const cycleId = current.id;
  // 백엔드가 코멘트·수정·판정을 모두 mid_review 단계로 제한한다 → 기간 밖에서는 읽기 전용.
  const isMidReview = current.status === 'mid_review';
  const showTeamTab = reviewerRows.length > 0;

  const tabItems = [
    { key: 'my', label: '내 중간 점검' },
    ...(showTeamTab ? [{ key: 'team', label: '구성원 점검', badge: reviewerRows.length }] : []),
  ];
  // 기본 탭 — 내 점검 건이 없는 검토자(예: 그룹대표)가 빈 탭에 착지하지 않게 한다.
  const defaultTab: TabKey = !myReview && showTeamTab ? 'team' : 'my';
  const effectiveTab: TabKey =
    activeTab && tabItems.some((t) => t.key === activeTab) ? activeTab : defaultTab;

  // ── 내 중간 점검 ── 내 차례(commented/returned)면 수정 화면, 아니면 읽기 전용.
  function myPanel() {
    if (reviews.loading && !reviews.data) return <Skeleton className="h-48 w-full" />;
    if (reviews.error) return <ErrorState onRetry={reviews.reload} />;
    if (!myReview) {
      return (
        <EmptyState
          title="이번 주기의 중간 점검이 아직 열리지 않았어요."
          description="인사 담당자가 중간 점검을 개시하면 부서장 코멘트를 확인하고 목표를 조정할 수 있어요."
        />
      );
    }
    const key = `${myReview.id}-${refreshKey}`;
    if (isMidReview && (myReview.status === 'commented' || myReview.status === 'returned')) {
      return (
        <MemberRevisionPanel
          key={key}
          reviewId={myReview.id}
          cycleId={cycleId}
          userId={me.id}
          onDone={handleDone}
        />
      );
    }
    return (
      <MidtermReadOnlyView key={key} reviewId={myReview.id} turnLine={memberTurnLine(myReview)} />
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="중간 점검"
        subtitle={
          <>
            부서장 코멘트 → 본인 목표 수정 → 그룹대표 최종 검토 순서로 진행돼요.
            <br />
            점검·코칭 단계의 입력 내용은 등급·연봉에 반영되지 않는 참고용이에요.
          </>
        }
        right={
          <div className="flex items-center gap-2">
            <span className="text-[12.5px] font-semibold text-muted-foreground">{current.name}</span>
            {/* 기간 외에는 "미평가" 오해를 주는 not_started 배지 대신 사이클 상태 파생 라벨 */}
            {isMidReview ? (
              <StatusBadge status="in_progress" />
            ) : (
              <span className="rounded-pill bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                {current.status === 'draft' || current.status === 'active' ? '시작 전' : '종료'}
              </span>
            )}
          </div>
        }
      />

      {!isMidReview && (
        <InfoBanner tone="info" title="지금은 중간점검 기간이 아니에요 — 조회만 가능해요">
          부서장 코멘트·목표 수정·최종 검토는 중간점검 기간에만 할 수 있어요.
        </InfoBanner>
      )}

      {tabItems.length > 1 && (
        <Tabs
          items={tabItems}
          activeKey={effectiveTab}
          onChange={(k) => setActiveTab(k as TabKey)}
        />
      )}

      {/* 탭 콘텐츠 — 언마운트 대신 display:none 토글(기존 패턴 유지):
          작성 중이던 목표 수정·검토 의견이 탭 전환으로 무경고 유실되지 않는다. */}
      <div className={effectiveTab === 'my' ? 'block' : 'hidden'}>{myPanel()}</div>

      {showTeamTab && (
        <div className={effectiveTab === 'team' ? 'block' : 'hidden'}>
          <ReviewerQueue
            rows={reviewerRows}
            meId={me.id}
            cycleId={cycleId}
            isMidReview={isMidReview}
            refreshKey={refreshKey}
            onDone={handleDone}
          />
        </div>
      )}
    </PageContainer>
  );
}
