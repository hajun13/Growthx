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
  // 탭마다 별개로 둔다 — 하나로 공유하면 한쪽 탭(예: 구성원 점검)의 액션이 다른 쪽
  // 탭(내 중간 점검)의 패널까지 key 변경으로 리마운트시켜, display:none 으로 마운트만
  // 유지해 둔 그 탭의 작성 중 입력을 무경고로 지워버린다(둘 다 항상 마운트돼 있음).
  const [myRefreshKey, setMyRefreshKey] = useState(0);
  const [teamRefreshKey, setTeamRefreshKey] = useState(0);

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

  // 액션 성공 후: 목록 갱신 + 상세 재조회(패널 리마운트) — 각자 자기 탭의 nonce만 올린다.
  function handleMyDone() {
    reviews.reload();
    setMyRefreshKey((k) => k + 1);
  }
  function handleTeamDone() {
    reviews.reload();
    setTeamRefreshKey((k) => k + 1);
  }

  // useAsync 는 enabled=false 로 마운트되면 loading 초기값이 false 로 굳는다 — 이 훅은
  // cycleId 가 아직 null 일 때 먼저 마운트되므로, 주기가 막 resolve 된 첫 커밋에서
  // "loading=false, data=null" 상태가 한 번 렌더된다(effect 가 loading=true 로 바꾸기 전).
  // reviews.loading 만 보면 이 창을 놓친다 — "데이터도 에러도 아직 없음"을 로딩으로 취급해
  // 아래 두 곳(내 점검 가드·구성원 점검 탭 노출)이 그 창에서 거짓 빈 상태/탭 깜빡임을 내지
  // 않게 한다. data 가 한 번이라도 채워지면(빈 배열이라도) 이후 재조회(reload)에서는 data 가
  // null 로 되돌아가지 않으므로, 이 플래그는 액션 후 재조회 때 다시 켜지지 않는다
  // (탭이 계속 마운트 상태를 유지해야 하는 요구와 충돌하지 않음).
  const reviewsPending = !reviews.data && !reviews.error;

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
    if (reviewsPending) return <Skeleton className="h-48 w-full" />;
    if (reviews.error) return <ErrorState onRetry={reviews.reload} />;
    if (!myReview) {
      return (
        <EmptyState
          title="이번 주기의 중간 점검이 아직 열리지 않았어요."
          description="인사 담당자가 중간 점검을 개시하면 부서장 코멘트를 확인하고 목표를 조정할 수 있어요."
        />
      );
    }
    const key = `${myReview.id}-${myRefreshKey}`;
    if (isMidReview && (myReview.status === 'commented' || myReview.status === 'returned')) {
      return (
        <MemberRevisionPanel
          key={key}
          reviewId={myReview.id}
          cycleId={cycleId}
          userId={me.id}
          onDone={handleMyDone}
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

      {/* reviewsPending 인 동안은 탭 목록 자체를 아직 결정하지 않는다 — showTeamTab 이
          reviewerRows(=reviews.data 파생)에서 나오므로, 데이터가 채워지기 전엔 항상 false 라
          바로 탭·콘텐츠를 그려버리면 실제 데이터 도착 시 탭이 갑자기 나타나는(pop-in) 깜빡임이
          생긴다. 이 창은 최초 정착 때만 참이라(한 번 채워지면 다시 null 로 안 돌아감) 이후
          액션→재조회에서는 아래 분기로 다시 빠지지 않고, 마운트 유지(display:none) 요구와도
          충돌하지 않는다. */}
      {reviewsPending ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <>
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
                refreshKey={teamRefreshKey}
                onDone={handleTeamDone}
              />
            </div>
          )}
        </>
      )}
    </PageContainer>
  );
}
