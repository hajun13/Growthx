'use client';

// 6월 중간평가 — 진척 점검(②) + 자가점검/부서장 확인 + 보완 조치(③). 역할 인지(role-aware).
// 단계 판정은 cycle.status 기준(계약 Model B). mid_review 가 아니면 읽기전용 안내.
// 등급/보상 수치는 mid_review 에서 fetch 자체를 하지 않는다(게이팅 회피).
// 재설계 2026-06-08: MidtermStepper(역할별 단계 시각화) + 디자인 정렬.
import { useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import {
  useMidtermReviews,
  useActionItems,
  useRebaselineRequests,
} from '@/hooks/useMidterm';
import { useEvaluations } from '@/hooks/useEvaluations';
import { canEvaluateDownward, isHrAdmin } from '@/lib/nav';
import { PageContainer } from '@/components/PageContainer';
import { PageHeader } from '@/components/PageHeader';
import { InfoBanner } from '@/components/InfoBanner';
import { EmptyState, ErrorState, Skeleton } from '@/components/States';
import { MidtermStepper, type StepDef } from '@/components/MidtermStepper';
import { cycleStatusLabel } from '@/lib/ui';
import { T } from '@/lib/toss';
import { EmployeeMidterm } from './EmployeeMidterm';
import { DeptHeadMidterm } from './DeptHeadMidterm';
import { OrgProgressCard } from './OrgProgressCard';

export default function MidtermPage() {
  const { user } = useAuth();
  const { current, cycles, selectedId, setSelectedId, loading, error, reload } =
    useCurrentCycle();

  const cycleId = current?.id ?? null;
  const isMidReview = current?.status === 'mid_review';
  const isDeptHead = !!user && canEvaluateDownward(user.role) && !isHrAdmin(user.role);
  const isHr = !!user && isHrAdmin(user.role);

  // ── Stepper 데이터 — employee 관점 ──
  // 이미 페이지에 로드할 데이터를 Stepper 상태 도출에 재사용.
  const { data: myReviewsData } = useMidtermReviews(
    { cycleId: cycleId ?? '', evaluateeId: user?.id ?? '' },
    { enabled: !!cycleId && !!user && !isHr },
  );
  const { data: myActionData } = useActionItems(
    { cycleId: cycleId ?? '', assigneeId: user?.id ?? '' },
    { enabled: !!cycleId && !!user && !isHr },
  );
  const { data: myRebaselineData } = useRebaselineRequests(
    { cycleId: cycleId ?? '', evaluateeId: user?.id ?? '' },
    { enabled: !!cycleId && !!user && !isHr },
  );

  // ── Stepper 데이터 — 부서장 관점 ──
  const { data: deptEvalsData } = useEvaluations(
    { cycleId: cycleId ?? '', evaluatorId: user?.id ?? '', type: 'downward' },
    { enabled: !!cycleId && isDeptHead },
  );
  const { data: deptReviewsData } = useMidtermReviews(
    { cycleId: cycleId ?? '' },
    { enabled: !!cycleId && isDeptHead },
  );
  const { data: deptActionData } = useActionItems(
    { cycleId: cycleId ?? '' },
    { enabled: !!cycleId && isDeptHead },
  );
  const { data: deptRebaselineData } = useRebaselineRequests(
    { cycleId: cycleId ?? '', forReview: true },
    { enabled: !!cycleId && isDeptHead },
  );

  // ── employee 5단계 상태 계산 ──
  const employeeSteps = useMemo((): StepDef[] => {
    const myReview = myReviewsData?.data?.find((r) => r.evaluateeId === user?.id) ?? null;
    const myItems = myActionData?.data ?? [];
    const myRebaselineReqs = myRebaselineData?.data ?? [];
    const latestReq = myRebaselineReqs[0] ?? null;

    // 현재 활성 단계 결정
    let activeStep: number;
    if (!myReview || myReview.status === 'pending') {
      activeStep = 2; // 자가 점검 미제출
    } else if (myReview.status === 'self_done') {
      activeStep = 3; // 부서장 피드백 대기
    } else {
      // confirmed 이후
      const actionsDone =
        myItems.length === 0 ||
        myItems.every((i) => i.status === 'done' || i.status === 'canceled');
      if (!actionsDone) {
        activeStep = 4; // 보완 조치 수행 중
      } else if (latestReq?.status === 'submitted') {
        activeStep = 5; // 재조정 검토 대기
      } else {
        activeStep = 5; // 모두 완료
      }
    }

    const stepOf = (n: number): 'done' | 'active' | 'pending' => {
      if (n < activeStep) return 'done';
      if (n === activeStep) return 'active';
      return 'pending';
    };

    // 단계 1은 항상 완료(진입 = 확인)
    const step1: StepDef = { label: 'KPI 진척 확인', status: 'done', subLabel: '완료' };

    const step2Status = stepOf(2);
    const step2: StepDef = {
      label: '자가 점검 제출',
      status: step2Status,
      subLabel:
        step2Status === 'done'
          ? '완료'
          : step2Status === 'active'
            ? '작성 후 제출하세요'
            : undefined,
    };

    const step3Status = stepOf(3);
    const step3: StepDef = {
      label: '부서장 피드백 확인',
      status: step3Status,
      subLabel:
        step3Status === 'done'
          ? '완료'
          : step3Status === 'active'
            ? '부서장 피드백 대기 중'
            : undefined,
    };

    const step4Status = stepOf(4);
    const pendingItemCount = myItems.filter(
      (i) => i.status !== 'done' && i.status !== 'canceled',
    ).length;
    const step4: StepDef = {
      label: '보완 조치 수행',
      status: step4Status,
      subLabel:
        step4Status === 'done'
          ? '완료'
          : step4Status === 'active' && pendingItemCount > 0
            ? `${pendingItemCount}건 진행 상태를 갱신하세요`
            : step4Status === 'active'
              ? '진행 상태를 갱신하세요'
              : undefined,
    };

    const step5Status = stepOf(5);
    const step5: StepDef = {
      label: '목표 재조정 요청',
      status: step5Status,
      subLabel:
        step5Status === 'done'
          ? latestReq?.status === 'approved'
            ? '승인 완료'
            : '완료'
          : step5Status === 'active'
            ? latestReq?.status === 'submitted'
              ? '검토 대기 중'
              : '필요 시 요청하세요'
            : undefined,
    };

    return [step1, step2, step3, step4, step5];
  }, [myReviewsData, myActionData, myRebaselineData, user?.id]);

  // ── 부서장 4단계 상태 계산 ──
  const deptHeadSteps = useMemo((): StepDef[] => {
    const targets = deptEvalsData?.data ?? [];
    const totalTargets = targets.length;

    const reviewMap = new Map<string, { status: string }>();
    for (const r of deptReviewsData?.data ?? []) {
      reviewMap.set(r.evaluateeId, r);
    }
    const confirmedCount = targets.filter(
      (t) => reviewMap.get(t.evaluateeId)?.status === 'confirmed',
    ).length;

    const allItems = deptActionData?.data ?? [];
    const itemCount = allItems.length;

    const pendingRbl = (deptRebaselineData?.data ?? []).filter(
      (r) => r.status === 'submitted',
    ).length;

    // 현재 활성 단계 결정
    let activeStep: number;
    if (confirmedCount < totalTargets) {
      activeStep = 2;
    } else if (itemCount === 0) {
      activeStep = 3;
    } else {
      activeStep = 4;
    }

    const stepOf = (n: number): 'done' | 'active' | 'pending' => {
      if (n < activeStep) return 'done';
      if (n === activeStep) return 'active';
      return 'pending';
    };

    const step1: StepDef = { label: '구성원 진척 검토', status: 'done', subLabel: '완료' };

    const step2Status = stepOf(2);
    const notConfirmedCount = totalTargets - confirmedCount;
    const step2: StepDef = {
      label: '자가점검 확인·피드백',
      status: step2Status,
      subLabel:
        step2Status === 'done'
          ? '완료'
          : step2Status === 'active' && notConfirmedCount > 0
            ? `${notConfirmedCount}명 미확인`
            : undefined,
    };

    const step3Status = stepOf(3);
    const step3: StepDef = {
      label: '보완 조치 등록',
      status: step3Status,
      subLabel:
        step3Status === 'done'
          ? '완료'
          : step3Status === 'active'
            ? '조치를 등록하세요'
            : undefined,
    };

    const step4Status = stepOf(4);
    const step4: StepDef = {
      label: '재조정 요청 검토',
      status: step4Status,
      subLabel:
        step4Status === 'done'
          ? pendingRbl === 0 && itemCount > 0
            ? '완료'
            : '완료'
          : step4Status === 'active' && pendingRbl > 0
            ? `${pendingRbl}건 검토 대기`
            : step4Status === 'active'
              ? '요청 대기 없음'
              : undefined,
    };

    return [step1, step2, step3, step4];
  }, [deptEvalsData, deptReviewsData, deptActionData, deptRebaselineData]);

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

  // PageHeader right 슬롯 — 점검 기간 배지
  const midtermBadge = isMidReview
    ? { label: '점검 기간', bg: T.blue500 }
    : { label: cycleStatusLabel[current.status] ?? current.status, bg: T.grey500 };

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
              padding: '6px 12px',
              fontSize: 11,
              fontWeight: 600,
              color: '#fff',
              background: midtermBadge.bg,
            }}
          >
            {midtermBadge.label}
          </span>
        }
      />

      {isMidReview ? (
        <InfoBanner tone="tip" title="중간평가는 점검·코칭 단계예요">
          등급·연봉에 반영되지 않아요. 아래 단계를 따라 진척을 점검하고 하반기 방향을 잡아요.
        </InfoBanner>
      ) : (
        <InfoBanner
          tone="info"
          title={`지금은 점검 기간이 아니에요 (${cycleStatusLabel[current.status] ?? current.status})`}
        >
          현재 단계에서는 조회만 할 수 있어요. 입력·제출·확인은 mid_review 기간에 열려요.
        </InfoBanner>
      )}

      {/* Stepper — employee/부서장에게만 표시, HR은 조직 모니터링만 */}
      {!isHr && (
        <MidtermStepper
          steps={isDeptHead ? deptHeadSteps : employeeSteps}
        />
      )}

      {/* 부서장: 구성원 점검 + 보완 조치 관리 */}
      {isDeptHead && (
        <DeptHeadMidterm
          cycleId={cycleId!}
          user={user}
          readOnly={!isMidReview}
        />
      )}

      {/* employee/부서장(본인 KPI 보유 시): 내 KPI 진척 + 자가점검 + 내 보완조치 */}
      {!isHr && (
        <EmployeeMidterm
          cycleId={cycleId!}
          user={user}
          readOnly={!isMidReview}
        />
      )}

      {/* hr_admin·부서장: 조직 진척 요약 */}
      {(isHr || isDeptHead) && <OrgProgressCard cycleId={cycleId!} userId={user.id} />}
    </PageContainer>
  );
}
