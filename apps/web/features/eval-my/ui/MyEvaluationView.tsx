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
import { Card } from '@/components/Card';

import { Button } from '@/components/Button';
import { InfoBanner } from '@/components/InfoBanner';
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
    <div className="flex items-center justify-center mx-auto mb-2.5 w-16 h-16">
      <GradeChip grade={grade} variant="solid" />
    </div>
  );
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

  const chipCls =
    state === 'done'
      ? 'bg-info-50 text-info-700 border border-info-50/40'
      : state === 'progress'
        ? 'bg-purple-50 text-purple-700'
        : 'bg-muted text-muted-foreground';

  const chipText = state === 'done' ? '완료' : state === 'progress' ? '진행 중' : '대기';

  return (
    <div className="flex items-center justify-between p-3.5 bg-muted rounded-lg border border-border/20 hover:border-primary/30 transition-colors">
      <div className="flex items-center gap-3.5">
        <div className="w-7 h-7 rounded-md bg-primary text-white flex items-center justify-center font-bold text-[13px]">
          {index}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-foreground font-semibold text-[14px] leading-[1.5]">{label}</span>
          <span className="text-[12.5px] text-muted-foreground">({sub})</span>
        </div>
      </div>
      <span className={`px-3 py-1 text-[12.5px] font-semibold rounded-md ${chipCls}`}>
        {chipText}
      </span>
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

  // 사이클 선택기 — PageHeader right 슬롯
  const cycleSelector = cycles && cycles.length > 1 ? (
    <Select value={selectedId ?? ''} onValueChange={setSelectedId}>
      <SelectTrigger className="min-w-[240px] h-9 text-[13px] font-semibold">
        <SelectValue placeholder="평가 주기 선택" />
      </SelectTrigger>
      <SelectContent>
        {cycles.map((c) => (
          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  ) : (
    <div className="flex min-w-[240px] items-center justify-between gap-2 px-4 py-2 bg-card border border-border rounded-md text-[13px] font-semibold text-foreground">
      <span>{current?.name ?? '평가 주기'}</span>
    </div>
  );

  return (
    <PageContainer>
      <PageHeader
        title="내 평가표"
        subtitle={current?.name ?? undefined}
        right={
          <div className="flex items-center gap-2 flex-wrap">
            <HeaderMetrics
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

      {/* 평가 완료 배너 */}
      {data && (
        <InfoBanner tone="success" title="평가가 완료됐어요">
          캘리브레이션이 완료되어 최종 평가 결과가 공개됐습니다. 아래에서 내 결과를 확인하세요.
        </InfoBanner>
      )}

      {/* 결과 공개 후 — 피평가자 정보 + 평가 결과 요약 */}
      {data && (
        <Card>
          {/* 피평가자 정보 */}
          <div className="flex items-center gap-4 pb-5 border-b border-border">
            <div className="w-14 h-14 rounded-full flex items-center justify-center text-[20px] font-bold text-white flex-shrink-0 bg-primary">
              {displayName.slice(0, 1)}
            </div>
            <div>
              <div className="text-[18px] font-bold text-foreground">
                {displayName}{' '}
                <span className="text-[14px] font-normal text-muted-foreground">{displayTitle}</span>
              </div>
              {displayDept && (
                <div className="text-[13px] text-muted-foreground mt-0.5">{displayDept}</div>
              )}
            </div>
          </div>

          {/* 평가 결과 요약 */}
          <div className="pt-5">
            <div className="text-[13px] font-bold text-foreground mb-5">평가 결과 요약</div>
            <div className="grid grid-cols-3 gap-4">
              {summaryCards.map((item) => (
                <div key={item.label} className="bg-muted border border-border p-5 rounded-lg text-center shadow-elev-1">
                  <div className="text-[12px] text-muted-foreground mb-3">{item.label}</div>
                  <GradeTile grade={item.grade} />
                  <div className="text-[13px] text-muted-foreground">
                    ({fmtScore(item.score)}점 / 100점)
                  </div>
                </div>
              ))}
            </div>
            {(data.percentile !== null || data.companyAvg !== null) && (
              <div className="flex gap-5 mt-4 text-[12.5px] text-muted-foreground">
                {data.percentile !== null && (
                  <span>
                    전사 상위 <strong className="text-foreground">{data.percentile}%</strong>
                  </span>
                )}
                {data.companyAvg !== null && (
                  <span>
                    전사 평균 <strong className="text-foreground tabular-nums">{fmtScore(data.companyAvg)}</strong>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* 상세 평가표 보기 */}
          <div className="flex gap-3 pt-5 border-t border-border mt-5">
            <Button
              variant="primary"
              leftIcon={<FileText size={14} />}
              className="flex-1"
              onClick={() => setShowReport(true)}
            >
              상세 평가표 보기
            </Button>
            <Link
              href={`/eval/result/${user!.id}`}
              className="flex shrink-0 items-center justify-center gap-2 whitespace-nowrap px-5 py-2.5 rounded-md text-[13px] font-semibold border border-border bg-card text-foreground hover:bg-muted transition-colors"
            >
              평가결과 상세
            </Link>
          </div>
        </Card>
      )}

      {/* KPI 요약 헤더 */}
      <div className="flex items-center justify-between border-b border-border/30 pb-4">
        <div className="flex items-center gap-2.5">
          <ListChecks size={18} className="text-primary" />
          <span className="text-[16px] font-semibold leading-[1.4] text-foreground">내 KPI</span>
          <span className="text-[13px] text-muted-foreground">
            {kpiSummary.total}개 · 가중치 합 {kpiSummary.weightTotal}%
          </span>
        </div>
        <Link
          href="/kpi"
          className="flex items-center gap-1 text-primary text-[13px] font-semibold hover:underline transition-colors"
        >
          KPI 작성 <ChevronRight size={15} />
        </Link>
      </div>

      {/* 평가 진행 현황 */}
      <Card title={<span className="flex items-center gap-2"><ClipboardCheck size={18} className="text-primary" />평가 진행 현황</span>}>
        <p className="text-[12px] font-bold tracking-[0.04em] text-muted-foreground mb-3 uppercase">
          평가 프로세스
        </p>
        <div className="space-y-3">
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

        <div className="mt-6 p-5 bg-muted/50 rounded-lg border border-dashed border-border flex items-center gap-3">
          <Info size={20} className="text-border flex-shrink-0" />
          <p className="text-[13px] leading-[1.5] text-muted-foreground italic">
            확정된 평가 결과는 캘리브레이션이 끝나면 이 화면에서 공개돼요.
          </p>
        </div>
      </Card>

      {/* 현재 단계 안내 배너 */}
      {phase?.phase && (
        <Card>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[12.5px] text-primary">
              <span className="font-semibold">현재 단계</span>
              <span className="font-bold">{PHASE_LABEL[phase.phase] ?? phase.phase}</span>
              {phase.dueDate && (
                <span className="text-muted-foreground">
                  · 마감 {new Date(phase.dueDate).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
                </span>
              )}
            </div>
            {(() => {
              if (!phase.dueDate) return null;
              const diff = Math.ceil(
                (new Date(phase.dueDate).getTime() - Date.now()) / 86_400_000,
              );
              if (diff < 0) return null;
              return (
                <span className="text-[11.5px] font-semibold text-primary">
                  {diff === 0 ? 'D-day' : `D-${diff}`}
                </span>
              );
            })()}
          </div>
        </Card>
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
