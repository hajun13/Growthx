'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { FileText, Lock, ListChecks, ClipboardCheck, ChevronRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { useCurrentPhase } from '@/hooks/useCurrentPhase';
import { useResultDetail } from '@/hooks/useResults';
import { useKpis } from '@/hooks/useKpis';
import { useEvaluations } from '@/hooks/useEvaluations';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { Breadcrumb } from '@/components/Breadcrumb';
import { ResultExportButton } from '@/components/ResultExportButton';
import { EvalReport } from '@/components/EvalReport';
import { EmptyState, ErrorState, Forbidden, Skeleton } from '@/components/States';
import { ApiError } from '@/lib/api';
import { fmtScore, positionLabel } from '@/lib/ui';
import type { Grade, ByTypeEntry, KpiStatus, EvalStatus } from '@/lib/types';

// 등급 색(tailwind grade 토큰 hex).
const GRADE_HEX: Record<Grade, string> = {
  S: '#1B4DCB',
  A: '#3182F6',
  B: '#15B66E',
  C: '#F5A623',
  D: '#F04452',
};

// 평가 단계(phase) → 한글 라벨.
const PHASE_LABEL: Record<string, string> = {
  prep: '기준 설정',
  kpi: 'KPI 작성',
  self: '본인평가',
  downward1: '부서장 평가',
  downward2: '부서장 평가',
  calibration: '캘리브레이션',
  done: '완료',
};

function GradeTile({ grade, size = 60, font = 32 }: { grade: Grade | null; size?: number; font?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        background: grade ? GRADE_HEX[grade] : '#b0b8c1',
        color: '#fff',
        fontSize: font,
        fontWeight: 800,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 10px',
      }}
    >
      {grade ?? '–'}
    </div>
  );
}

export default function MyEvaluationPage() {
  const { user, loading: authLoading } = useAuth();
  const {
    cycles,
    current,
    selectedId,
    setSelectedId,
    loading: cycleLoading,
  } = useCurrentCycle();
  const cycleId = current?.id ?? null;
  const [showReport, setShowReport] = useState(false);

  // 결과 상세(캘리브레이션 완료 후 공개) — 404/403 가능, 진행률 카드는 항상 노출.
  const { data, loading: resultLoading, error } = useResultDetail(user?.id ?? null, cycleId);

  // 현재 단계 표시.
  const { data: phase } = useCurrentPhase(cycleId, { enabled: !!cycleId });

  // 내 KPI 요약(상태별 집계 + 작성 링크).
  const { data: kpiRes, loading: kpiLoading } = useKpis(
    { cycleId: cycleId ?? undefined, userId: user?.id },
    { enabled: !!cycleId && !!user },
  );
  const myKpis = kpiRes?.data ?? [];

  // 내 평가 진행률(본인평가/부서장평가 상태) — evaluateeId = me.
  const { data: evalRes, loading: evalLoading } = useEvaluations(
    { cycleId: cycleId ?? undefined, evaluateeId: user?.id },
    { enabled: !!cycleId && !!user },
  );
  const myEvals = evalRes?.data ?? [];

  const displayName = data?.userName ?? user?.name ?? '내 평가표';
  const displayDept = data?.departmentName ?? '';
  const displayTitle = user ? positionLabel[user.position] : '';

  // KPI 상태 집계.
  const kpiSummary = useMemo(() => {
    const total = myKpis.length;
    const count = (s: KpiStatus) => myKpis.filter((k) => k.status === s).length;
    const confirmed = count('confirmed');
    const submitted = count('submitted') + count('approved');
    const draft = count('draft');
    const rejected = count('rejected') + count('revision_requested');
    const weightTotal = myKpis.reduce((acc, k) => acc + (k.weight ?? 0), 0);
    return { total, confirmed, submitted, draft, rejected, weightTotal };
  }, [myKpis]);

  // 평가 진행 단계(본인/부서장) — 단일 캐스케이드: 부서장 평가는 직속 1명만(round 구분 폐기).
  // 결과 상세(byType)가 있으면 점수 기준, 없으면 evaluations 상태 기준.
  const steps = useMemo(() => {
    const bt = data?.byType;
    const evalDone = (status: EvalStatus | undefined) =>
      status === 'submitted' || status === 'finalized';

    // 본인평가.
    const selfEv = myEvals.find((e) => e.type === 'self');
    const selfDone = (bt?.self?.score != null) || evalDone(selfEv?.status);
    const selfInProgress = selfEv?.status === 'in_progress';

    // 부서장 평가(단일) — downward 데이터 키(downward1/2)가 비어 있어도 어느 한쪽이 채워지면 완료로 본다.
    const downwardEntries: (ByTypeEntry | undefined)[] = [bt?.downward1, bt?.downward2];
    const downwardEvals = myEvals.filter((e) => e.type === 'downward');
    const downwardDone =
      downwardEntries.some((entry) => !!entry && entry.score !== null) ||
      downwardEvals.some((e) => evalDone(e.status));
    const downwardInProgress =
      !downwardDone && downwardEvals.some((e) => e.status === 'in_progress');

    return [
      { label: '본인평가', sub: '본인', done: selfDone, inProgress: selfInProgress },
      { label: '부서장 평가', sub: '직속 부서장', done: downwardDone, inProgress: downwardInProgress },
    ];
  }, [data, myEvals]);

  const loading =
    authLoading || cycleLoading || resultLoading || kpiLoading || evalLoading;
  if (loading) return <MySkeleton />;

  // 403(권한 없음)은 차단. 그 외 결과 에러(404 미공개 포함)는 진행률 카드로 graceful degrade.
  if (error instanceof ApiError && error.isForbidden) {
    return <Forbidden message="평가표를 볼 권한이 없어요." />;
  }
  // 결과 외 다른 4xx/5xx(403·404 제외)는 에러 상태.
  const resultUnavailable =
    error instanceof ApiError && error.status === 404 ? true : false;
  if (error && !(error instanceof ApiError && error.status === 404)) {
    return <ErrorState />;
  }
  if (!cycleId) {
    return <EmptyState title="진행 중인 평가 주기가 없어요." />;
  }

  const bg = data?.byGroup;
  const summaryCards = data
    ? [
        { label: '종합평가', grade: data.finalGrade, score: data.finalScore },
        { label: '성과중심 (KPI)', grade: bg?.performance_core.grade ?? null, score: bg?.performance_core.score ?? null },
        { label: '협업·성장', grade: bg?.collaboration_growth.grade ?? null, score: bg?.collaboration_growth.score ?? null },
      ]
    : [];

  return (
    <PageContainer>
      <Breadcrumb backHref="/eval" items={[{ label: '내 평가표' }]} />

      <PageHeader
        title="내 평가표"
        subtitle={current?.name}
        cycles={cycles}
        selectedId={selectedId}
        onSelectCycle={setSelectedId}
        right={data ? <ResultExportButton userId={user!.id} cycleId={cycleId} /> : undefined}
      />

      {/* 현재 단계 안내 */}
      {phase?.phase && (
        <div
          className="flex items-center justify-between"
          style={{ background: '#f2f6ff', border: '1px solid #d6e4ff', padding: '12px 20px' }}
        >
          <div className="flex items-center gap-2" style={{ fontSize: 12.5, color: '#1b4dcb' }}>
            <span style={{ fontWeight: 600 }}>현재 단계</span>
            <span style={{ fontWeight: 700 }}>
              {PHASE_LABEL[phase.phase] ?? phase.phase}
            </span>
            {phase.dueDate && (
              <span style={{ color: '#4e5968' }}>
                · 마감 {new Date(phase.dueDate).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
              </span>
            )}
          </div>
          {(() => {
            // 백엔드 shape에 daysRemaining 없음 → dueDate-now 로 프론트 산출(contract §7 주석).
            if (!phase.dueDate) return null;
            const diff = Math.ceil(
              (new Date(phase.dueDate).getTime() - Date.now()) / 86_400_000,
            );
            if (diff < 0) return null;
            return (
              <span style={{ fontSize: 11.5, fontWeight: 600, color: '#3182f6' }}>
                {diff === 0 ? 'D-day' : `D-${diff}`}
              </span>
            );
          })()}
        </div>
      )}

      {/* 내 KPI 요약 */}
      <div className="bg-card" style={{ border: '1px solid #EEF2F7' }}>
        <div
          className="flex items-center justify-between"
          style={{ padding: '18px 24px', borderBottom: '1px solid #e5e8eb' }}
        >
          <div className="flex items-center gap-2">
            <ListChecks size={16} color="#3182f6" />
            <span style={{ fontSize: 14, fontWeight: 700, color: '#191f28' }}>내 KPI</span>
            <span style={{ fontSize: 12, color: '#8b95a1' }}>
              {kpiSummary.total}개 · 가중치 합 {kpiSummary.weightTotal}%
            </span>
          </div>
          <Link
            href="/kpi"
            className="flex items-center gap-1 transition-colors hover:opacity-80"
            style={{ fontSize: 12.5, fontWeight: 600, color: '#3182f6' }}
          >
            KPI 작성 <ChevronRight size={14} />
          </Link>
        </div>
        <div style={{ padding: '20px 24px' }}>
          {kpiSummary.total === 0 ? (
            <div style={{ fontSize: 13, color: '#6b7684' }}>
              아직 작성한 KPI가 없어요.{' '}
              <Link href="/kpi" style={{ color: '#3182f6', fontWeight: 600 }}>
                KPI 작성하러 가기
              </Link>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {[
                { label: '확정', value: kpiSummary.confirmed, color: '#1B4DCB' },
                { label: '제출·승인', value: kpiSummary.submitted, color: '#3182f6' },
                { label: '작성 중', value: kpiSummary.draft, color: '#6b7684' },
                { label: '반려·수정요청', value: kpiSummary.rejected, color: '#f04452' },
              ].map((s) => (
                <div
                  key={s.label}
                  style={{ background: '#f9fafb', border: '1px solid #e5e8eb', padding: '14px 16px', textAlign: 'center' }}
                >
                  <div className="tabular-nums" style={{ fontSize: 22, fontWeight: 800, color: s.color }}>
                    {s.value}
                  </div>
                  <div style={{ fontSize: 11.5, color: '#8b95a1', marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 결과 미공개 안내(캘리브레이션 전) */}
      {resultUnavailable && (
        <div className="bg-card" style={{ border: '1px solid #EEF2F7' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e8eb' }}>
            <div className="flex items-center gap-2">
              <ClipboardCheck size={16} color="#3182f6" />
              <span style={{ fontSize: 14, fontWeight: 700, color: '#191f28' }}>평가 진행 현황</span>
            </div>
          </div>
          <ProcessSteps steps={steps} />
          <div style={{ padding: '0 24px 22px' }}>
            <div
              style={{ background: '#f9fafb', border: '1px dashed #c6d3e3', padding: '14px 16px', fontSize: 12.5, color: '#4e5968' }}
            >
              확정된 평가 결과는 캘리브레이션이 끝나면 이 화면에서 공개돼요.
            </div>
          </div>
        </div>
      )}

      {/* 결과 공개 후 — 기존 평가표 카드 */}
      {data && (
        <>
          {/* 열람 제한 안내 */}
          <div style={{ background: '#191f28', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Lock size={14} color="#fe9800" />
            <span style={{ fontSize: 12, color: '#b0b8c1' }}>
              이 평가표는 <strong style={{ color: '#fff' }}>본인 · 그룹대표 · 본부장 · 관리자</strong>만 열람할 수 있습니다.
            </span>
          </div>

          <div className="bg-card" style={{ border: '1px solid #EEF2F7' }}>
            {/* 헤더 */}
            <div style={{ padding: '24px 28px', borderBottom: '1px solid #e5e8eb' }}>
              <div className="flex items-center gap-14">
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: '50%',
                      background: '#3182f6',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 20,
                      fontWeight: 700,
                      color: '#fff',
                    }}
                  >
                    {displayName.slice(0, 1)}
                  </div>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#191f28' }}>
                      {displayName}{' '}
                      <span style={{ fontSize: 14, fontWeight: 400, color: '#6b7684' }}>{displayTitle}</span>
                    </div>
                    {displayDept && (
                      <div style={{ fontSize: 13, color: '#8b95a1', marginTop: 2 }}>{displayDept}</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 평가 결과 요약 */}
            <div style={{ padding: '28px', background: '#f9fafb', borderBottom: '1px solid #e5e8eb' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#191f28', marginBottom: 20 }}>평가 결과 요약</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                {summaryCards.map((item) => (
                  <div key={item.label} className="bg-card" style={{ border: '1px solid #e5e8eb', padding: '20px', textAlign: 'center' }}>
                    <div style={{ fontSize: 12, color: '#8b95a1', marginBottom: 12 }}>{item.label}</div>
                    <GradeTile grade={item.grade} />
                    <div style={{ fontSize: 13, color: '#6b7684' }}>
                      ({fmtScore(item.score)}점 / 100점)
                    </div>
                  </div>
                ))}
              </div>
              {(data.percentile !== null || data.companyAvg !== null) && (
                <div style={{ display: 'flex', gap: 20, marginTop: 16, fontSize: 12.5, color: '#4e5968' }}>
                  {data.percentile !== null && (
                    <span>
                      전사 상위 <strong style={{ color: '#191f28' }}>{data.percentile}%</strong>
                    </span>
                  )}
                  {data.companyAvg !== null && (
                    <span>
                      전사 평균 <strong style={{ color: '#191f28' }}>{fmtScore(data.companyAvg)}</strong>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* 평가 프로세스 */}
            <ProcessSteps steps={steps} />

            {/* 상세 평가표 보기 + 결과 페이지 링크 */}
            <div style={{ padding: '0 28px 28px', display: 'flex', gap: 10 }}>
              <button
                onClick={() => setShowReport(true)}
                className="flex flex-1 items-center justify-center gap-2 py-3 transition-colors hover:opacity-90"
                style={{ fontSize: 13, fontWeight: 600, color: '#fff', background: '#3182f6', border: '1px solid #3182f6' }}
              >
                <FileText size={14} /> 상세 평가표 보기
              </button>
              <Link
                href={`/eval/result/${user!.id}`}
                className="flex items-center justify-center gap-2 px-5 py-3 transition-colors hover:bg-[#f2f4f6]"
                style={{ fontSize: 13, fontWeight: 600, color: '#4e5968', background: '#fff', border: '1px solid #e5e8eb' }}
              >
                평가결과 상세
              </Link>
            </div>
          </div>
        </>
      )}

      {/* EvalReport 모달 */}
      {showReport && data && (
        <EvalReport
          data={{
            name: displayName,
            dept: displayDept,
            title: displayTitle,
            finalGrade: data.finalGrade,
            finalScore: data.finalScore,
            percentile: data.percentile,
            companyAvg: data.companyAvg,
            byType: data.byType,
            byGroup: data.byGroup,
            cycleName: current?.name,
          }}
          onClose={() => setShowReport(false)}
        />
      )}
    </PageContainer>
  );
}

function ProcessSteps({
  steps,
}: {
  steps: { label: string; sub: string; done: boolean; inProgress: boolean }[];
}) {
  return (
    <div style={{ padding: '28px' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#191f28', marginBottom: 16 }}>평가 프로세스</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {steps.map((item, idx) => {
          const state = item.done ? 'done' : item.inProgress ? 'progress' : 'wait';
          const badge =
            state === 'done'
              ? { text: '완료', color: '#059669', bg: '#E8F5F1' }
              : state === 'progress'
                ? { text: '진행중', color: '#3182f6', bg: '#EAF2FF' }
                : { text: '대기', color: '#8b95a1', bg: '#f2f4f6' };
          return (
            <div
              key={item.label}
              className="flex items-center justify-between"
              style={{ padding: '12px 16px', background: '#f9fafb', border: '1px solid #e5e8eb' }}
            >
              <div className="flex items-center gap-3">
                <div
                  style={{
                    width: 28,
                    height: 28,
                    background: '#3182f6',
                    color: '#fff',
                    fontSize: 11,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {idx + 1}
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#191f28' }}>{item.label}</span>
                <span style={{ fontSize: 11.5, color: '#8b95a1' }}>{item.sub}</span>
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: badge.color,
                  background: badge.bg,
                  padding: '3px 10px',
                }}
              >
                {badge.text}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MySkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
