'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  FileText,
  ListChecks,
  ClipboardCheck,
  ChevronRight,
  Info,
} from 'lucide-react';
import { HeaderMetrics } from '@/components/HeaderMetrics';
import { ApiError } from '@growthx/contracts';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { useCurrentPhase } from '@/hooks/useCurrentPhase';
import { useKpis } from '@/hooks/useKpis';
import { useEvaluations } from '@/hooks/useEvaluations';
import { EvalReport } from '@/components/EvalReport';
import { EmptyState, ErrorState, Forbidden, Skeleton } from '@/components/States';
import { GradeChip } from '@/components/GradeChip';
import { PageContainer } from '@/components/PageContainer';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/Button';
import { HelpTooltip } from '@/components/HelpTooltip';
import { fmtScore, positionLabel } from '@/lib/ui';
import type { Grade, ByTypeEntry, KpiStatus, EvalStatus } from '@/lib/types';
import { useMyResultDetail } from '../hooks';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ── 단계 라벨 ──────────────────────────────────────────────────
const PHASE_LABEL: Record<string, string> = {
  prep: '기준 설정',
  kpi: 'KPI 작성',
  self: '본인평가',
  downward1: '1차 평가 (팀장)',
  downward2: '2차 평가 (본부장)',
  downward3: '최종 평가 (그룹대표)',
  calibration: '캘리브레이션',
  done: '완료',
};

// ── 등급 타일(결과 공개 후) ───────────────────────────────────
function GradeTile({ grade }: { grade: Grade | null }) {
  return (
    <div className="flex h-10 w-10 items-center justify-center">
      <GradeChip grade={grade} variant="solid" />
    </div>
  );
}

function StatusChip({ state }: { state: 'done' | 'progress' | 'wait' | 'danger' }) {
  const cls =
    state === 'done'
      ? 'border-[#d9eadf] bg-[#f0faf3] text-[#166534]'
      : state === 'progress'
        ? 'border-[#e7dcfb] bg-[#f5f0ff] text-[var(--gx-primary)]'
        : state === 'danger'
          ? 'border-[#fde1e3] bg-[#fff4f5] text-danger-600'
          : 'border-[#e5e8eb] bg-[#f7f8fa] text-[#4e5968]';
  const text =
    state === 'done' ? '완료' : state === 'progress' ? '진행 중' : state === 'danger' ? '확인 필요' : '대기';
  return <span className={`inline-flex h-6 items-center rounded-[8px] border px-2 text-[12px] font-bold ${cls}`}>{text}</span>;
}

// ── 평가 단계 행 ───────────────────────────────────────────────
function ProcessStepRow({
  index,
  label,
  sub,
  done,
  inProgress,
}: {
  index: number;
  label: string;
  sub: string;
  done: boolean;
  inProgress: boolean;
}) {
  const state = done ? 'done' : inProgress ? 'progress' : 'wait';

  return (
    <div className="grid min-h-[54px] grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 border-b border-[#e5e8eb] py-3 last:border-0">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e8eb] bg-[#f7f8fa] text-[13px] font-bold text-[#191f28]">
          {index}
      </div>
      <div className="min-w-0">
        <p className="truncate text-[14px] font-bold text-[#191f28]">{label}</p>
        <p className="mt-0.5 truncate text-[12px] font-medium text-[#8b95a1]">{sub}</p>
      </div>
      <StatusChip state={state} />
    </div>
  );
}

export function MyEvaluationView() {
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

  const { data, loading: resultLoading, error } = useMyResultDetail(user?.id ?? null, cycleId);
  const { data: phase } = useCurrentPhase(cycleId, { enabled: !!cycleId });

  const { data: kpiRes, loading: kpiLoading } = useKpis(
    { cycleId: cycleId ?? undefined, userId: user?.id },
    { enabled: !!cycleId && !!user },
  );
  const myKpis = kpiRes?.data ?? [];

  const { data: evalRes, loading: evalLoading } = useEvaluations(
    { cycleId: cycleId ?? undefined, evaluateeId: user?.id },
    { enabled: !!cycleId && !!user },
  );
  const myEvals = evalRes?.data ?? [];

  const displayName = data?.userName ?? user?.name ?? '내 평가표';
  const displayDept = data?.departmentName ?? '';
  const displayTitle = user ? positionLabel[user.position] : '';

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

  const steps = useMemo(() => {
    const bt = data?.byType;
    const evalDone = (status: EvalStatus | undefined) =>
      status === 'submitted' || status === 'finalized';

    const selfEv = myEvals.find((e) => e.type === 'self');
    const selfDone = bt?.self?.score != null || evalDone(selfEv?.status);

    const downStage = (round: number, entry: ByTypeEntry | undefined) => {
      const ev = myEvals.find((e) => e.type === 'downward' && e.round === round);
      return {
        done: (entry?.score != null) || evalDone(ev?.status),
        inProgress: ev?.status === 'in_progress',
      };
    };
    const s1 = downStage(1, bt?.downward1);
    const s2 = downStage(2, bt?.downward2);
    const s3 = downStage(3, bt?.downward3);

    return [
      { label: '본인평가', sub: '본인 · 참고용', done: selfDone, inProgress: selfEv?.status === 'in_progress' },
      { label: '1차 평가', sub: '팀장', done: s1.done, inProgress: !s1.done && s1.inProgress },
      { label: '2차 평가', sub: '본부장', done: s2.done, inProgress: !s2.done && s2.inProgress },
      { label: '최종 평가', sub: '그룹대표', done: s3.done, inProgress: !s3.done && s3.inProgress },
    ];
  }, [data, myEvals]);

  const loading = authLoading || cycleLoading || resultLoading || kpiLoading || evalLoading;
  if (loading) return <MySkeleton />;

  if (error instanceof ApiError && error.isForbidden) {
    return <Forbidden message="평가표를 볼 권한이 없어요." />;
  }
  const resultUnavailable = error instanceof ApiError && error.status === 404;
  if (error && !resultUnavailable) {
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
  const currentStep = steps.find((step) => step.inProgress) ?? steps.find((step) => !step.done);
  const actionRows = [
    {
      label: kpiSummary.total === 0 ? 'KPI를 먼저 작성해야 합니다' : 'KPI 작성 상태를 확인하세요',
      detail: `${kpiSummary.total}개 등록 · 가중치 합 ${kpiSummary.weightTotal}%`,
      href: '/kpi',
      action: kpiSummary.total === 0 ? '작성하기' : '확인',
      state: kpiSummary.confirmed === kpiSummary.total && kpiSummary.total > 0 ? 'done' as const : 'progress' as const,
    },
    {
      label: currentStep ? `${currentStep.label} 단계가 남아 있습니다` : '모든 평가 단계가 완료되었습니다',
      detail: currentStep?.sub ?? '결과 공개를 기다리면 됩니다',
      href: '/eval/self',
      action: currentStep ? '이동' : '보기',
      state: currentStep ? 'progress' as const : 'done' as const,
    },
    {
      label: data ? '최종 평가 결과가 공개되었습니다' : '최종 평가 결과는 아직 공개 전입니다',
      detail: phase?.phase ? `현재 단계 ${PHASE_LABEL[phase.phase] ?? phase.phase}` : '평가 일정 확정 후 공개됩니다',
      href: data ? `/eval/result/${user!.id}` : '/eval/result',
      action: data ? '상세 보기' : '상태 보기',
      state: data ? 'done' as const : 'wait' as const,
    },
  ];

  // 사이클 선택기 — PageHeader right 슬롯
  const cycleSelector = cycles && cycles.length > 1 ? (
    <Select value={selectedId ?? ''} onValueChange={setSelectedId}>
      <SelectTrigger className="h-9 w-[190px] shrink-0 text-[13px] font-semibold sm:w-[210px]">
        <SelectValue placeholder="평가 주기 선택" />
      </SelectTrigger>
      <SelectContent>
        {cycles.map((c) => (
          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  ) : (
    <div className="flex h-9 w-[190px] shrink-0 items-center justify-between gap-2 rounded-md border border-border bg-card px-4 text-[13px] font-semibold text-foreground sm:w-[210px]">
      <span>{current?.name ?? '평가 주기'}</span>
    </div>
  );

  return (
    <PageContainer className="space-y-5">
      <PageHeader
        title="내 평가표"
        subtitle={current?.name ?? undefined}
        right={
          <div className="flex max-w-full items-center gap-2 overflow-x-auto">
            <HeaderMetrics
              className="shrink-0 flex-nowrap"
              items={[
                { label: '확정', value: kpiSummary.confirmed },
                { label: '제출·승인', value: kpiSummary.submitted },
                { label: '작성 중', value: kpiSummary.draft },
                {
                  label: '반려·수정요청',
                  value: kpiSummary.rejected,
                  accent: kpiSummary.rejected > 0 ? 'text-danger-600' : undefined,
                },
              ]}
            />
            {cycleSelector}
          </div>
        }
      />

      <section className="gx-panel overflow-hidden">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex items-center gap-4 border-b border-[#e5e8eb] px-5 py-5 lg:border-b-0 lg:border-r">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#0e0e14] text-[18px] font-bold text-white">
              {displayName.slice(0, 1)}
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-[18px] font-black text-[#191f28]">
                {displayName} <span className="text-[14px] font-semibold text-[#4e5968]">{displayTitle}</span>
              </h2>
              <p className="mt-1 truncate text-[13px] font-medium text-[#8b95a1]">
                {displayDept || '소속 정보 없음'} · {current?.name ?? '평가 주기 없음'}
              </p>
            </div>
          </div>
          <div className="px-5 py-5">
            <p className="text-[12px] font-bold text-[#4e5968]">현재 업무 컨텍스트</p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <div>
                <p className="text-[16px] font-black text-[#191f28]">
                  {phase?.phase ? PHASE_LABEL[phase.phase] ?? phase.phase : '단계 대기'}
                </p>
                {phase?.dueDate && (
                  <p className="mt-1 text-[12px] font-medium text-[#8b95a1]">
                    마감 {new Date(phase.dueDate).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
                  </p>
                )}
              </div>
              {data ? (
                <div className="inline-flex items-center gap-2 rounded-lg border border-[#d9eadf] bg-[#f0faf3] px-3 py-2 text-[13px] font-bold text-[#166534]">
                  <ClipboardCheck size={15} aria-hidden />
                  결과 공개
                  <HelpTooltip
                    label="평가 완료 설명 보기"
                    content="캘리브레이션이 완료되어 최종 평가 결과가 공개됐습니다."
                    className="text-[#166534] hover:text-[#14532d]"
                  />
                </div>
              ) : (
                <StatusChip state="wait" />
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="gx-panel overflow-hidden">
        <div className="gx-section-header">
          <div>
            <h2 className="text-[18px] font-black text-[#191f28]">즉시 할 일</h2>
            <p className="mt-1 text-[13px] font-medium text-[#8b95a1]">내 평가표에서 바로 확인해야 하는 항목입니다.</p>
          </div>
        </div>
        <div className="divide-y divide-[#e5e8eb] px-5">
          {actionRows.map((row) => (
            <div key={row.label} className="grid min-h-[58px] grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-[14px] font-bold text-[#191f28]">{row.label}</p>
                <p className="mt-0.5 truncate text-[12px] font-medium text-[#8b95a1]">{row.detail}</p>
              </div>
              <StatusChip state={row.state} />
              <Link href={row.href} className="gx-text-button inline-flex items-center gap-1">
                {row.action}
                <ChevronRight size={14} aria-hidden />
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="gx-panel overflow-hidden">
        <div className="gx-section-header">
          <div>
            <h2 className="text-[18px] font-black text-[#191f28]">주요 데이터</h2>
            <p className="mt-1 text-[13px] font-medium text-[#8b95a1]">KPI 등록 상태와 공개된 평가 결과를 함께 봅니다.</p>
          </div>
          {data && (
            <Button
              variant="primary"
              leftIcon={<FileText size={14} />}
              onClick={() => setShowReport(true)}
            >
              상세 평가표
            </Button>
          )}
        </div>
        <div className="grid gap-0 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="border-b border-[#e5e8eb] p-5 lg:border-b-0 lg:border-r">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ListChecks size={18} className="text-primary" />
                <h3 className="text-[15px] font-black text-[#191f28]">내 KPI</h3>
              </div>
              <Link href="/kpi" className="gx-text-button inline-flex items-center gap-1">
                KPI 작성 <ChevronRight size={14} aria-hidden />
              </Link>
            </div>
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[#e5e8eb] bg-[#e5e8eb]">
              {[
                ['전체', kpiSummary.total],
                ['확정', kpiSummary.confirmed],
                ['작성 중', kpiSummary.draft],
                ['가중치 합', `${kpiSummary.weightTotal}%`],
              ].map(([label, value]) => (
                <div key={label} className="bg-white px-4 py-3">
                  <dt className="text-[12px] font-bold text-[#8b95a1]">{label}</dt>
                  <dd className="mt-1 text-[20px] font-black tabular-nums text-[#191f28]">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="p-5">
            {data ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left">
                  <thead>
                    <tr className="border-b border-[#e5e8eb] text-[12px] font-bold text-[#4e5968]">
                      <th className="py-3">구분</th>
                      <th className="w-24 py-3">등급</th>
                      <th className="w-32 py-3 text-right">점수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summaryCards.map((item) => (
                      <tr key={item.label} className="border-b border-[#e5e8eb] last:border-0">
                        <td className="py-3 text-[14px] font-bold text-[#191f28]">{item.label}</td>
                        <td className="py-3"><GradeTile grade={item.grade} /></td>
                        <td className="py-3 text-right text-[14px] font-bold tabular-nums text-[#191f28]">{fmtScore(item.score)}점</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(data.percentile !== null || data.companyAvg !== null) && (
                  <div className="mt-4 flex flex-wrap gap-4 border-t border-[#e5e8eb] pt-4 text-[13px] font-medium text-[#4e5968]">
                    {data.percentile !== null && <span>전사 상위 <strong className="text-[#191f28]">{data.percentile}%</strong></span>}
                    {data.companyAvg !== null && <span>전사 평균 <strong className="text-[#191f28] tabular-nums">{fmtScore(data.companyAvg)}</strong></span>}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex min-h-[196px] items-center justify-center rounded-lg border border-dashed border-[#d1d6db] bg-[#f7f8fa] px-6 text-center">
                <div>
                  <p className="text-[15px] font-black text-[#191f28]">공개된 평가 결과가 없습니다.</p>
                  <p className="mt-2 text-[13px] font-medium text-[#8b95a1]">평가와 캘리브레이션이 완료되면 이 영역에 결과가 표시됩니다.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="gx-panel overflow-hidden">
        <div className="gx-section-header">
          <div>
            <h2 className="text-[18px] font-black text-[#191f28]">상세 진행 상태</h2>
            <p className="mt-1 text-[13px] font-medium text-[#8b95a1]">본인평가와 다단계 부서장 평가의 현재 상태입니다.</p>
          </div>
          <Info size={18} className="mt-1 text-[#8b95a1]" aria-hidden />
        </div>
        <div className="px-5">
          {steps.map((step, idx) => (
            <ProcessStepRow
              key={step.label}
              index={idx + 1}
              label={step.label}
              sub={step.sub}
              done={step.done}
              inProgress={step.inProgress}
            />
          ))}
        </div>
      </section>

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

function MySkeleton() {
  return (
    <PageContainer>
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-10 w-full rounded-lg" />
      <Skeleton className="h-72 w-full rounded-lg" />
    </PageContainer>
  );
}
