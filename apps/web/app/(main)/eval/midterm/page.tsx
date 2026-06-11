'use client';

// 6월 중간점검 — 탭 분리 재구성(2026-06-09).
//  - "내 점검" 탭: 본인 KPI 진척 + KPI별 자가점검 제출 (employee·부서장 모두)
//  - "구성원 점검" 탭: 팀장/본부장/HR만. 구성원 목록·검토·재조정 검토 큐·조직 진척.
//  - 탭이 1개뿐이면 탭바 없이 그 내용만 렌더.
//  - MidtermStepper 제거. 사각형(radius 0) 세그먼트 탭 사용.
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { canEvaluateDownward, isHrAdmin } from '@/lib/nav';
import { PageContainer } from '@/components/PageContainer';
import { PageHeader } from '@/components/PageHeader';
import { InfoBanner } from '@/components/InfoBanner';
import { EmptyState, ErrorState, Skeleton } from '@/components/States';
import { cycleStatusLabel } from '@/lib/ui';
import { EmployeeMidterm } from './EmployeeMidterm';
import { DeptHeadMidterm } from './DeptHeadMidterm';
import { OrgProgressCard } from './OrgProgressCard';

type TabKey = 'my' | 'team';

const K = { primary: '#3f2c80', secondary: '#0054ca', tertiary: '#0e9aa0' } as const;

export default function MidtermPage() {
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
  const showMyTab = !isHr; // HR은 본인 KPI 없어 "내 점검" 불필요
  const showTeamTab = canEvaluateDownward(user.role); // 팀장·본부장·HR만

  // 탭이 1개뿐이면 단일 탭 렌더
  const isSingleTab = (!showMyTab && showTeamTab) || (showMyTab && !showTeamTab);
  const effectiveTab: TabKey = !showMyTab ? 'team' : !showTeamTab ? 'my' : activeTab;

  // PageHeader right 슬롯 — 점검 기간 배지
  const midtermBadge = isMidReview
    ? { label: '점검 기간', bg: K.tertiary }
    : { label: cycleStatusLabel[current.status] ?? current.status, bg: '#797582' };

  return (
    <PageContainer>
      <PageHeader
        title="중간 점검"
        subtitle="상반기 진척을 점검하고 하반기 궤도를 잡아요."
        cycles={cycles}
        selectedId={selectedId}
        onSelectCycle={setSelectedId}
        right={
          <span
            style={{
              padding: '4px 12px',
              fontSize: 11,
              fontWeight: 600,
              color: '#fff',
              background: midtermBadge.bg,
              borderRadius: 999,
            }}
          >
            {midtermBadge.label}
          </span>
        }
      />

      {isMidReview ? (
        <InfoBanner tone="tip" title="중간평가는 점검·코칭 단계예요">
          등급·연봉에 반영되지 않아요. KPI 진척을 확인하고 상반기 자가점검을 제출하세요.
        </InfoBanner>
      ) : (
        <InfoBanner
          tone="info"
          title={`지금은 점검 기간이 아니에요 (${cycleStatusLabel[current.status] ?? current.status})`}
        >
          현재 단계에서는 조회만 할 수 있어요. 입력·제출·확인은 mid_review 기간에 열려요.
        </InfoBanner>
      )}

      {/* 세그먼트 탭 — 단일 탭이면 탭바 자체를 숨김 */}
      {!isSingleTab && (
        <div
          className="flex"
          style={{ borderBottom: '2px solid rgba(202,196,210,0.5)', gap: 0 }}
        >
          {showMyTab && (
            <TabButton
              active={effectiveTab === 'my'}
              onClick={() => setActiveTab('my')}
            >
              내 점검
            </TabButton>
          )}
          {showTeamTab && (
            <TabButton
              active={effectiveTab === 'team'}
              onClick={() => setActiveTab('team')}
            >
              구성원 점검
            </TabButton>
          )}
        </div>
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
        <>
          <DeptHeadMidterm
            cycleId={cycleId}
            user={user}
            readOnly={!isMidReview}
          />
          <OrgProgressCard cycleId={cycleId} userId={user.id} />
        </>
      )}
    </PageContainer>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '10px 20px',
        fontSize: 13,
        fontWeight: active ? 700 : 500,
        color: active ? '#3f2c80' : '#797582',
        borderBottom: active ? '2px solid #3f2c80' : '2px solid transparent',
        marginBottom: -2,
        background: 'transparent',
        cursor: 'pointer',
        transition: 'color 0.15s',
      }}
    >
      {children}
    </button>
  );
}
