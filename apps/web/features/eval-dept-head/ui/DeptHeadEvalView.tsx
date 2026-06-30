'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  MessageSquare,
  UserCheck,
  ChevronLeft,
  Paperclip,
  Eye,
  Download,
} from 'lucide-react';
import { HeaderMetrics } from '@/components/HeaderMetrics';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { EvidencePreview, isEvidencePreviewable } from '@/components/EvidencePreview';
import { useKpis } from '@/hooks/useKpis';
import { useRuleSet } from '@/hooks/useRuleSets';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { EmptyState, ErrorState, Forbidden, Skeleton } from '@/components/States';
import { Button } from '@/components/Button';
import { GradeChip } from '@/components/GradeChip';
import { StatusBadge } from '@/components/StatusBadge';
import { EvaluationSubjectPanel } from '@/components/EvaluationSubjectPanel';
import { EvaluationDetailHeader } from '@/components/EvaluationDetailHeader';
import { EvaluationActionPanel } from '@/components/EvaluationActionPanel';
import { Card } from '@/components/Card';
import { DesignLabel } from '@/components/DesignLabel';
import { PageContainer } from '@/components/PageContainer';
import { PageHeader } from '@/components/PageHeader';
import { HelpTooltip } from '@/components/HelpTooltip';
import { InfoBanner } from '@/components/InfoBanner';

import {
  fmtScore,
  fmtAmount,
  measureTypeUnit,
  kpiCategoryLabel,
  kpiTypeLabel,
} from '@/lib/ui';
import { canEvaluateDownward } from '@/lib/nav';
import { Modal } from '@/components/Modal';
import { Collapsible } from '@/components/Collapsible';
import { GradeCriteriaPicker } from '@/components/GradeCriteriaPicker';
import { KpiGradingDisplay, RevenueGradeDisplay } from '@/components/KpiGradingDisplay';
import { gradeColor } from '@/lib/grade';
import type {
  Grade,
  Evaluation,
  Kpi,
  KpiScore,
  KpiGroup,
  EvalStatus,
  EvaluationEvidence,
  RuleSet,
} from '@/lib/types';
import {
  useEvaluations,
  useEvaluationDetail,
  useEvaluationEvidence,
} from '../hooks';
import { deptHeadCommands } from '../api';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const GRADES: Grade[] = ['S', 'A', 'B', 'C', 'D'];

// 다단계 평가 단계 라벨(round).
const ROUND_LABEL: Record<number, string> = {
  1: '1차 · 팀장',
  2: '2차 · 본부장',
  3: '최종 · 그룹대표',
};

// 갭 #2 — 실제 매출 절대금액으로 등급을 매기는 KPI 판정.
function isAbsoluteAmount(k: Kpi): boolean {
  return k.measureType === 'amount' && k.useAbsoluteAmount === true;
}

const GROUP_CFG: Record<KpiGroup, { label: string; accent: string }> = {
  performance_core: { label: '성과중심 지표', accent: 'bg-primary' },
  collaboration_growth: { label: '협업·성장 지표', accent: 'bg-neutral-500' },
};

// 사람이 읽기 쉬운 파일 크기.
function fmtBytes(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)}KB`;
  return `${(n / (1024 * 1024)).toFixed(1)}MB`;
}

export function DeptHeadEvalView() {
  const { user } = useAuth();
  const toast = useToast();
  const { current, loading: cyclesLoading } = useCurrentCycle();
  const cycleId = current?.id;

  const allowed = !!user && canEvaluateDownward(user.role);

  const { data: evals, loading, error, reload } = useEvaluations(
    { cycleId, evaluatorId: user?.id, type: 'downward' },
    { enabled: !!cycleId && allowed },
  );
  const targets: Evaluation[] = useMemo(() => evals?.data ?? [], [evals]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [mobileView, setMobileView] = useState<'list' | 'panel'>('list');
  const [kpiOpenMap, setKpiOpenMap] = useState<Record<string, boolean>>({});

  const activeEval = useMemo(
    () => targets.find((t) => t.id === selectedId) ?? targets[0] ?? null,
    [targets, selectedId],
  );

  const { data: detail, loading: detailLoading, reload: reloadDetail } =
    useEvaluationDetail(activeEval?.id ?? null);

  const { data: selfEvals, loading: selfListLoading } = useEvaluations(
    { cycleId, evaluateeId: activeEval?.evaluateeId, type: 'self' },
    { enabled: !!cycleId && !!activeEval?.evaluateeId },
  );
  const selfEval = selfEvals?.data[0] ?? null;
  const { data: selfDetail, loading: selfDetailLoading } = useEvaluationDetail(
    selfEval?.id ?? null,
  );
  const selfLoading = selfListLoading || selfDetailLoading;
  const selfSubmitted =
    selfEval?.status === 'submitted' || selfEval?.status === 'finalized';

  const selfScoreByKpi = useMemo(() => {
    const m = new Map<string, KpiScore>();
    for (const s of selfDetail?.kpiScores ?? []) m.set(s.kpiId, s);
    return m;
  }, [selfDetail?.kpiScores]);

  const { data: evidenceData } = useEvaluationEvidence(selfEval?.id ?? null);
  const evidenceByKpi = useMemo(() => {
    const m = new Map<string, EvaluationEvidence[]>();
    for (const e of evidenceData?.data ?? []) {
      const arr = m.get(e.kpiId) ?? [];
      arr.push(e);
      m.set(e.kpiId, arr);
    }
    return m;
  }, [evidenceData]);
  const [previewFile, setPreviewFile] = useState<EvaluationEvidence | null>(null);

  const { data: kpiData, loading: kpiLoading } = useKpis(
    { cycleId, userId: activeEval?.evaluateeId },
    { enabled: !!cycleId && !!activeEval },
  );
  const kpis: Kpi[] = useMemo(
    () => (kpiData?.data ?? []).filter((k) => k.status === 'confirmed'),
    [kpiData],
  );
  const coreKpis = kpis.filter((k) => k.group === 'performance_core');
  const growthKpis = kpis.filter((k) => k.group === 'collaboration_growth');

  const { data: ruleSet } = useRuleSet(current?.ruleSetId ?? null);
  const revenueGradeScale = ruleSet?.weightPolicy.revenueGradeScale;

  const readOnly =
    activeEval?.status === 'submitted' || activeEval?.status === 'finalized';

  const [directGrades, setDirectGrades] = useState<Record<string, Grade>>({});
  const [reviewerNotes, setReviewerNotes] = useState<Record<string, string>>({});
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
  const [overallGrade, setOverallGrade] = useState<Grade | null>(null);
  const [overallReason, setOverallReason] = useState('');

  useEffect(() => {
    const restored: Record<string, Grade> = {};
    const restoredNotes: Record<string, string> = {};
    for (const s of detail?.kpiScores ?? []) {
      restored[s.kpiId] = s.grade;
      if (s.reviewerNote) restoredNotes[s.kpiId] = s.reviewerNote;
    }
    setDirectGrades(restored);
    setReviewerNotes(restoredNotes);
    setComment('');
    setOverallGrade(activeEval?.overallGrade ?? null);
    setOverallReason(activeEval?.overallReason ?? '');
    // 피평가자 변경 시 KPI 펼침 상태 초기화.
    setKpiOpenMap({});
  }, [activeEval?.id, detail?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const qualitativeKpis = kpis.filter((k) => k.measureType === 'qualitative');
  const qualitativeComplete = qualitativeKpis.every((k) => directGrades[k.id]);
  const hasOverallComment = comment.trim().length > 0;
  const feedbackMissing = !hasOverallComment;
  const reviewerNotesComplete = kpis.every(
    (k) => (reviewerNotes[k.id] ?? '').trim().length > 0,
  );
  const reviewerNotesMissing = kpis.length > 0 && !reviewerNotesComplete;
  const overrideReasonMissing =
    overallGrade !== null && overallReason.trim().length === 0;
  const canSubmit =
    !readOnly &&
    !!activeEval &&
    selfSubmitted &&
    qualitativeComplete &&
    !feedbackMissing &&
    !reviewerNotesMissing &&
    !overrideReasonMissing;

  // KPI 카드 완료 판정: 정성=directGrade 있음, 수치/절대금액은 점수 자동연동.
  // 공통 조건: reviewerNote 작성됨.
  function isKpiDone(kpi: Kpi): boolean {
    const noteOk = (reviewerNotes[kpi.id] ?? '').trim().length > 0;
    if (kpi.measureType === 'qualitative') return !!directGrades[kpi.id] && noteOk;
    return noteOk;
  }
  function isKpiOpen(kpiId: string): boolean {
    if (kpiId in kpiOpenMap) return kpiOpenMap[kpiId];
    if (readOnly) return false;
    const kpi = kpis.find((k) => k.id === kpiId);
    return kpi ? !isKpiDone(kpi) : true;
  }
  function toggleKpi(kpiId: string) {
    setKpiOpenMap((prev) => ({ ...prev, [kpiId]: !isKpiOpen(kpiId) }));
  }

  function handleSubmit() {
    setConfirmSubmitOpen(true);
  }

  async function confirmSubmit() {
    if (!activeEval) return;
    setConfirmSubmitOpen(false);
    setSubmitting(true);
    try {
      const kpiScores = kpis.map((k) => {
        const note = reviewerNotes[k.id]?.trim();
        const reviewerNote = note ? note : undefined;
        if (k.measureType === 'qualitative') {
          return { kpiId: k.id, directGrade: directGrades[k.id], weight: k.weight, reviewerNote };
        }
        const selfScore = selfScoreByKpi.get(k.id);
        if (isAbsoluteAmount(k)) {
          return { kpiId: k.id, actualAmount: selfScore?.actualAmount, weight: k.weight, reviewerNote };
        }
        return { kpiId: k.id, achievementRate: selfScore?.achievementRate, weight: k.weight, reviewerNote };
      });
      await deptHeadCommands.patch(activeEval.id, {
        kpiScores: kpiScores as never,
        ...(overallGrade !== null
          ? { overallGrade: overallGrade as never, overallReason: overallReason.trim() }
          : {}),
      });
      await deptHeadCommands.addComment(activeEval.id, {
        quarter: activeEval.round ?? 1,
        content: comment.trim(),
      });
      await deptHeadCommands.submit(activeEval.id);
      toast.show({ variant: 'success', message: '부서장 평가를 제출했어요.' });
      setComment('');
      reload();
      reloadDetail();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.code === 'COMMENT_REQUIRED'
            ? '평가 코멘트를 작성해야 제출할 수 있어요.'
            : err.code === 'POOL_EXCEEDED'
              ? '전사 등급풀 상한을 초과했어요. 캘리브레이션이 필요해요.'
              : err.message
          : '제출에 실패했어요.';
      toast.show({ variant: 'danger', message: msg });
    } finally {
      setSubmitting(false);
    }
  }

  if (!allowed) return <Forbidden message="부서장 평가 권한이 없어요." />;
  if (cyclesLoading || (loading && !evals)) return <DeptHeadSkeleton />;
  if (error) return <ErrorState onRetry={reload} />;
  if (!current) return <EmptyState title="지금은 부서장 평가 기간이 아니에요." />;

  const filtered = targets.filter((t) => {
    if (!search) return true;
    return (t.userName ?? t.evaluateeId).includes(search);
  });
  const subjectItems = filtered.map((t) => {
    const name = t.userName ?? t.evaluateeId.slice(0, 8);
    return {
      id: t.id,
      name,
      description: t.departmentName ?? null,
      active: t.id === activeEval?.id,
      onSelect: () => selectTarget(t.id),
      accessory: (
        <>
          {t.finalGrade && <GradeChip grade={t.finalGrade} size="sm" />}
          <StatusBadge status={t.status} />
        </>
      ),
    };
  });

  const summary = {
    total: targets.length,
    done: targets.filter((t) => t.status === 'submitted' || t.status === 'finalized').length,
    inprog: targets.filter((t) => t.status === 'in_progress').length,
    waiting: targets.filter((t) => t.status === 'not_started').length,
  };

  function selectTarget(id: string) {
    setSelectedId(id);
    setMobileView('panel');
  }

  return (
    <PageContainer>
      <PageHeader
        title="부서장 평가"
        subtitle="팀원이 제출한 본인평가 실적을 확인하고, 정성 과제 등급과 평가 코멘트를 작성하세요."
        right={
          <>
            <HeaderMetrics
              items={[
                { label: '전체 팀원', value: summary.total },
                { label: '평가 완료', value: summary.done },
                { label: '평가중', value: summary.inprog },
                {
                  label: '평가 대기',
                  value: summary.waiting,
                  accent: summary.waiting > 0 ? 'text-danger-600' : undefined,
                },
              ]}
            />
            {activeEval && <StatusBadge status={activeEval.status} />}
          </>
        }
      />

      {targets.length === 0 ? (
        <EmptyState
          title="평가할 팀원이 없어요."
          description="아직 부서장 평가가 배정되지 않았어요. HR이 배정을 완료하면 팀원이 표시돼요."
        />
      ) : (
        <div className="gx-master-detail">
          {/* ── 팀원 목록 ── */}
          <EvaluationSubjectPanel
            title="팀원"
            count={targets.length}
            search={search}
            onSearch={setSearch}
            searchPlaceholder="이름 검색"
            emptyMessage="검색 결과가 없어요."
            items={subjectItems}
            className={mobileView === 'panel' ? 'hidden lg:block' : 'block'}
          />

          {/* ── 평가 패널 ── */}
          <div className={cn(mobileView === 'list' ? 'hidden lg:block' : 'block', 'space-y-4')}>
            {!activeEval ? (
              <Card>
                <p className="py-10 text-center text-[13px] text-muted-foreground">
                  좌측에서 팀원을 선택하세요.
                </p>
              </Card>
            ) : (
              <>
                {/* 모바일 뒤로 */}
                <div className="lg:hidden">
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<ChevronLeft size={14} />}
                    onClick={() => setMobileView('list')}
                  >
                    팀원 목록
                  </Button>
                </div>

                <EvaluationDetailHeader
                  name={activeEval.userName ?? activeEval.evaluateeId.slice(0, 8)}
                  description={activeEval.departmentName ?? '—'}
                  meta={
                    activeEval.round != null ? (
                      <span className="rounded bg-primary/[0.07] px-2 py-0.5 text-[10.5px] font-bold text-primary">
                        {ROUND_LABEL[activeEval.round] ?? `${activeEval.round}차`}
                      </span>
                    ) : null
                  }
                  metric={{
                    label: '종합 점수',
                    value: (
                      <span className="inline-flex items-center gap-2">
                        <span>{fmtScore(detail?.totalScore ?? activeEval.totalScore)}</span>
                        {(detail?.finalGrade ?? activeEval.finalGrade) && (
                          <GradeChip grade={(detail?.finalGrade ?? activeEval.finalGrade)!} />
                        )}
                      </span>
                    ),
                  }}
                />

                {/* 본인평가 상태 배너 */}
                <SelfStatusBanner loading={selfLoading} selfEval={selfEval} submitted={selfSubmitted} />

                {/* 과제별 성과 + 부서장 평가 */}
                {selfLoading || kpiLoading || detailLoading ? (
                  <Card><Skeleton className="h-48 w-full" /></Card>
                ) : kpis.length === 0 ? (
                  <Card>
                    <div className="px-5 py-10 text-center">
                      <p className="text-[13.5px] font-semibold text-foreground">확정된 KPI가 없어요.</p>
                      <p className="text-[12.5px] text-muted-foreground mt-1">
                        이 팀원의 KPI가 확정되면 과제별 성과가 표시돼요.
                      </p>
                    </div>
                  </Card>
                ) : (
                  <>
                    {(['performance_core', 'collaboration_growth'] as KpiGroup[]).map((group) => {
                      const rows = group === 'performance_core' ? coreKpis : growthKpis;
                      if (rows.length === 0) return null;
                      const cfg = GROUP_CFG[group];
                      return (
                        <div key={group} className="space-y-3">
                          <div className="flex items-center gap-2">
                            <span className={cn('w-1 h-4 inline-block rounded-sm flex-shrink-0', cfg.accent)} />
                            <span className="text-[14px] font-bold text-foreground">{cfg.label}</span>
                            <span className="text-[12px] text-muted-foreground">{rows.length}개 과제</span>
                            <HelpTooltip
                              label={`${cfg.label} 평가 방식 설명 보기`}
                              content="수치 과제의 실적·등급은 본인평가에서 자동 연동돼요(부서장이 바꾸지 않아요). 정성 과제는 본인 등급을 참고해 부서장 등급을 직접 부여하세요."
                            />
                          </div>

                          <div className="w-full space-y-4 bg-muted/40 p-4">
                          {rows.map((kpi) => {
                            const done = isKpiDone(kpi);
                            const selfScore = selfScoreByKpi.get(kpi.id) ?? null;
                            const displayGrade =
                              kpi.measureType === 'qualitative'
                                ? (directGrades[kpi.id] ?? selfScore?.grade ?? null)
                                : (selfScore?.grade ?? null);
                            const index = kpis.findIndex((item) => item.id === kpi.id) + 1;
                            return (
                              <Collapsible
                                key={kpi.id}
                                open={isKpiOpen(kpi.id)}
                                onToggle={() => toggleKpi(kpi.id)}
                                header={
                                  <div className="flex min-w-0 items-center gap-2">
                                    <span className="inline-flex h-5 min-w-5 items-center justify-center border border-border bg-foreground px-1 text-[10px] font-bold tabular-nums text-background">
                                      {index}
                                    </span>
                                    <DesignLabel tone={group === 'performance_core' ? 'primary' : 'darkgray'}>
                                      {kpiCategoryLabel[kpi.category]}
                                    </DesignLabel>
                                    <span className="min-w-0 flex-1 text-[15px] font-bold leading-snug text-foreground break-keep">
                                      {kpi.title}
                                    </span>
                                    <span className="shrink-0 rounded bg-primary/[0.07] px-2 py-0.5 text-[11.5px] font-bold tabular-nums text-primary">
                                      가중치 {kpi.weight}%
                                    </span>
                                    {displayGrade && (
                                      <GradeChip grade={displayGrade} size="sm" />
                                    )}
                                    {done ? (
                                      <DesignLabel tone="green">
                                        평가 완료
                                      </DesignLabel>
                                    ) : (
                                      <DesignLabel tone="amber">
                                        미완료
                                      </DesignLabel>
                                    )}
                                  </div>
                                }
                                headerClassName="bg-card px-4 py-4 hover:bg-accent/40"
                                className={[
                                  'w-full rounded-none border-[#d1cbc4] border-l-4 shadow-none',
                                  isKpiOpen(kpi.id) ? 'border-l-primary' : 'border-l-[#9a948e]',
                                ].join(' ')}
                                bodyClassName="bg-card p-0"
                              >
                                <KpiEvalCard
                                  kpi={kpi}
                                  selfScore={selfScore}
                                  directGrade={directGrades[kpi.id] ?? null}
                                  onGrade={(g) =>
                                    setDirectGrades((p) => ({ ...p, [kpi.id]: g }))
                                  }
                                  reviewerNote={reviewerNotes[kpi.id] ?? ''}
                                  onReviewerNote={(v) =>
                                    setReviewerNotes((p) => ({ ...p, [kpi.id]: v }))
                                  }
                                  noteMissing={
                                    !readOnly &&
                                    (reviewerNotes[kpi.id] ?? '').trim().length === 0
                                  }
                                  evidence={evidenceByKpi.get(kpi.id) ?? []}
                                  onPreview={setPreviewFile}
                                  readOnly={readOnly}
                                  gradingScales={ruleSet?.gradingScales}
                                  revenueGradeScale={revenueGradeScale}
                                />
                              </Collapsible>
                            );
                          })}
                          </div>
                        </div>
                      );
                    })}

                    {/* 종합 평가 코멘트 */}
                    {(!readOnly || comment.length > 0) && (
                      <Card title={
                        <span className="flex items-center gap-1.5">
                          <MessageSquare size={14} className="text-primary" />
                          종합 평가 코멘트
                          <span className="text-danger-500 font-bold">*</span>
                        </span>
                      }>
                        <Textarea
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                          readOnly={readOnly}
                          placeholder="제출 전 전체 평가에 대한 의견을 작성해 주세요. (필수)"
                          className={cn(
                            'min-h-[88px] resize-none',
                            !readOnly && feedbackMissing && 'border-danger-500',
                            readOnly && 'bg-muted',
                          )}
                        />
                        {!readOnly && feedbackMissing && (
                          <p className="text-[11.5px] text-danger-600 mt-1">
                            종합 평가 코멘트는 필수 항목이에요. (1차·2차·최종 모두)
                          </p>
                        )}
                      </Card>
                    )}

                    {/* 종합등급 직접 부여(선택) */}
                    <details className="rounded-none border border-border bg-card overflow-hidden">
                      <summary className="flex items-center justify-between cursor-pointer px-5 py-4 bg-muted border-b border-border text-[13px] font-semibold text-foreground list-none">
                        <span>종합등급 직접 부여 <span className="text-muted-foreground font-normal">(선택)</span></span>
                        {overallGrade && <GradeChip grade={overallGrade} />}
                      </summary>
                      <div className="space-y-3 px-5 py-4 bg-card">
                        <p className="text-[11.5px] text-muted-foreground">
                          자동 산정 등급 대신 부서장이 종합등급을 정할 수 있어요. 정하면 사유가 필요해요.
                        </p>
                        <div className="flex items-center gap-2">
                          <GradePicker value={overallGrade} onChange={(g) => setOverallGrade(g)} readOnly={readOnly} />
                          {overallGrade !== null && !readOnly && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setOverallGrade(null); setOverallReason(''); }}
                            >
                              자동 산정
                            </Button>
                          )}
                        </div>
                        {overallGrade !== null && (
                          <Textarea
                            value={overallReason}
                            onChange={(e) => setOverallReason(e.target.value)}
                            readOnly={readOnly}
                            placeholder="종합등급을 직접 정한 이유를 적어 주세요."
                            className={cn(
                              'min-h-[56px] resize-none text-[12.5px]',
                              !readOnly && overrideReasonMissing && 'border-danger-500',
                              readOnly && 'bg-muted',
                            )}
                          />
                        )}
                      </div>
                    </details>

                    {/* 제출 */}
                    {!readOnly ? (
                      <EvaluationActionPanel
                        message={
                          !selfSubmitted
                            ? '팀원 본인평가 제출 후 부서장 평가를 제출할 수 있어요.'
                            : !qualitativeComplete
                              ? '정성 과제 등급을 모두 부여해야 제출할 수 있어요.'
                              : reviewerNotesMissing
                                ? '모든 과제에 부서장 코멘트를 작성해야 제출할 수 있어요.'
                                : feedbackMissing
                                  ? '종합 평가 코멘트를 작성해야 제출할 수 있어요.'
                                  : '모든 필수 항목이 입력됐어요.'
                        }
                        actions={
                          <Button
                            variant="primary"
                            loading={submitting}
                            disabled={!canSubmit || submitting}
                            onClick={handleSubmit}
                            size="lg"
                            className="w-full sm:w-auto sm:min-w-[176px]"
                          >
                            {submitting
                              ? '제출 중…'
                              : !selfSubmitted
                                ? '본인평가 제출 후 평가할 수 있어요'
                                : !qualitativeComplete
                                  ? '정성 과제 등급을 모두 부여해 주세요'
                                  : reviewerNotesMissing
                                    ? '모든 과제에 부서장 코멘트를 작성해 주세요'
                                    : feedbackMissing
                                      ? '종합 평가 코멘트를 작성해 주세요'
                                      : '부서장 평가 제출'}
                          </Button>
                        }
                      />
                    ) : null}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <EvidencePreview
        evaluationId={previewFile?.evaluationId ?? ''}
        file={previewFile}
        onClose={() => setPreviewFile(null)}
      />

      <Modal
        open={confirmSubmitOpen}
        onClose={() => setConfirmSubmitOpen(false)}
        title="부서장 평가를 제출할까요?"
        primaryAction={{ label: '제출', variant: 'primary', onClick: () => void confirmSubmit() }}
        secondaryAction={{ label: '취소', onClick: () => setConfirmSubmitOpen(false) }}
        size="sm"
      >
        <p className="text-[13px] text-muted-foreground leading-relaxed">
          제출하면 내용을 수정할 수 없어요.<br />
          <span className="text-primary font-semibold">{activeEval?.userName ?? '팀원'}</span>의 평가가 다음 단계로 넘어갑니다.
        </p>
      </Modal>
    </PageContainer>
  );
}

// ── 본인평가 연동 + 부서장 등급 부여를 한 카드에서 ──
function KpiEvalCard({
  kpi,
  selfScore,
  directGrade,
  onGrade,
  reviewerNote,
  onReviewerNote,
  noteMissing,
  evidence,
  onPreview,
  readOnly,
  gradingScales,
  revenueGradeScale,
}: {
  kpi: Kpi;
  selfScore: KpiScore | null;
  directGrade: Grade | null;
  onGrade: (g: Grade) => void;
  reviewerNote: string;
  onReviewerNote: (v: string) => void;
  noteMissing: boolean;
  evidence: EvaluationEvidence[];
  onPreview: (f: EvaluationEvidence) => void;
  readOnly?: boolean;
  gradingScales?: RuleSet['gradingScales'];
  revenueGradeScale?: { grade: Grade; minAmount: number }[];
}) {
  const isQual = kpi.measureType === 'qualitative';
  const isCount = kpi.measureType === 'count';
  const isAbsAmount = isAbsoluteAmount(kpi);
  const unit = measureTypeUnit[kpi.measureType];
  const targetStr = kpi.targetText?.trim()
    ? kpi.targetText
    : kpi.targetValue !== null
      ? `${kpi.targetValue.toLocaleString('ko-KR')}${unit}`
      : null;

  return (
    <div className="overflow-hidden bg-card">
      {(kpi.csf || targetStr || kpi.measureMethod) && (
        <div className="border-b border-border bg-[#faf9f7] px-5 py-3">
          <div className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-[12px] leading-relaxed text-muted-foreground md:grid-cols-3">
            <KpiInfoCell label="CSF(전략목표)" value={kpi.csf || '—'} />
            <KpiInfoCell label="목표" value={targetStr || '—'} />
            <KpiInfoCell label="평가 방식" value={kpi.measureMethod || kpiTypeLabel(kpi)} />
          </div>
        </div>
      )}

      {/* 본인평가 연동 실적 */}
      <div className={cn('flex items-center gap-2 px-5 py-3.5', isQual && !readOnly ? 'border-b border-border' : 'border-b border-border/40')}>
        <UserCheck size={13} className="text-muted-foreground flex-shrink-0" />
        <span className="text-[11.5px] font-bold text-muted-foreground">본인평가</span>
        {selfScore ? (
          isQual ? (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-[12px] text-muted-foreground">선택 등급</span>
              <GradeChip grade={selfScore.grade} size="sm" />
              {selfScore.selfNote && (
                <span className="truncate text-[12px] text-muted-foreground" title={selfScore.selfNote}>
                  · {selfScore.selfNote}
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-1">
              <span className="tabular-nums text-[13px] font-semibold text-foreground">
                {isAbsAmount
                  ? `매출 ${fmtAmount(selfScore.actualAmount)}`
                  : `실적 ${fmtScore(selfScore.achievementRate)}${isCount ? '건' : unit}`}
              </span>
              <span className="text-[11.5px] text-muted-foreground">자동 등급</span>
              <GradeChip grade={selfScore.grade} size="sm" />
              <span className="tabular-nums text-[11.5px] text-primary ml-auto">
                {fmtScore(selfScore.score)}점
              </span>
            </div>
          )
        ) : (
          <span className="text-[12px] text-warning-600">아직 입력되지 않았어요</span>
        )}
      </div>

      {/* 절대금액 모드 */}
      {isAbsAmount && (
        <div className="border-b border-border/40 bg-[#faf9f7] px-5 py-4">
          <RevenueGradeDisplay
            scale={revenueGradeScale}
            inputAmount={selfScore?.actualAmount ?? undefined}
          />
        </div>
      )}

      {!isQual && !isAbsAmount && (
        <div className="border-b border-border/40 bg-[#faf9f7] px-5 py-4">
          <KpiGradingDisplay
            kpi={kpi}
            scales={gradingScales}
            highlightGrade={selfScore?.grade ?? undefined}
          />
        </div>
      )}

      {/* 부서장 등급 부여 (정성만) */}
      {isQual && (
        <div className="space-y-2 border-b border-border/40 px-5 py-4">
          <span className="text-[11.5px] font-semibold text-muted-foreground">부서장 등급 부여</span>
          <GradeCriteriaPicker kpi={kpi} value={directGrade ?? undefined} onSelect={onGrade} readOnly={readOnly} />
        </div>
      )}

      {/* 증빙 자료 */}
      {evidence.length > 0 && (
        <div className="space-y-1.5 border-b border-border/40 px-5 py-4">
          <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-muted-foreground">
            <Paperclip size={12} aria-hidden /> 증빙 자료{' '}
            <span className="font-normal text-muted-foreground/60">{evidence.length}개</span>
          </div>
          <ul className="space-y-1">
            {evidence.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => onPreview(f)}
                  className="flex items-center gap-1.5 w-full text-left px-2.5 py-1.5 rounded-none border border-border bg-muted transition-colors hover:bg-muted/70"
                  title={isEvidencePreviewable(f.mimeType) ? '사이트에서 바로 보기' : '다운로드'}
                >
                  {isEvidencePreviewable(f.mimeType) ? (
                    <Eye size={13} className="text-primary flex-shrink-0" />
                  ) : (
                    <Download size={13} className="text-primary flex-shrink-0" />
                  )}
                  <span className="truncate flex-1 text-[12px] text-foreground">{f.filename}</span>
                  <span className="text-[10.5px] text-muted-foreground flex-shrink-0 tabular-nums">
                    {fmtBytes(f.size)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 부서장 문항별 코멘트 (필수) */}
      {(!readOnly || reviewerNote.trim().length > 0) && (
        <div className="space-y-1.5 px-5 py-4">
          <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-muted-foreground">
            <MessageSquare size={12} className="text-primary" aria-hidden /> 부서장 코멘트{' '}
            <span className="text-danger-500 font-bold">*</span>
          </div>
          <Textarea
            value={reviewerNote}
            onChange={(e) => onReviewerNote(e.target.value)}
            readOnly={readOnly}
            placeholder="이 과제에 대한 평가 의견을 작성해 주세요. (필수)"
            className={cn(
              'min-h-[56px] resize-none text-[12.5px]',
              noteMissing && 'border-danger-500',
              readOnly && 'bg-muted',
            )}
          />
          {noteMissing && (
            <p className="text-[11.5px] text-danger-600">
              부서장 코멘트는 필수 항목이에요.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function KpiInfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <span className="font-bold text-foreground">{label}</span>
      <span className="mx-1 text-border">|</span>
      <span className="break-keep">{value}</span>
    </div>
  );
}

function SelfStatusBanner({
  loading,
  selfEval,
  submitted,
}: {
  loading: boolean;
  selfEval: Evaluation | null;
  submitted: boolean;
}) {
  if (loading) return <Skeleton className="h-12 w-full" />;
  if (submitted) {
    return (
      <div className="inline-flex w-fit items-center gap-2 rounded-none border border-success-100 bg-muted px-3 py-2 text-[13px] font-semibold text-foreground">
        <span>본인평가 제출됨</span>
        <HelpTooltip
          label="본인평가 연동 설명 보기"
          content="팀원이 본인평가를 제출했어요. 실적이 아래에 연동돼요."
          className="text-foreground hover:text-success-900"
        />
      </div>
    );
  }
  return (
    <InfoBanner tone="warning">
      {selfEval
        ? '팀원이 본인평가를 아직 제출하지 않았어요(작성 중). 제출되면 실적이 연동되고 부서장 평가를 제출할 수 있어요.'
        : '팀원이 아직 본인평가를 시작하지 않았어요. 제출 후 부서장 평가를 진행할 수 있어요.'}
    </InfoBanner>
  );
}

function GradePicker({
  value,
  onChange,
  readOnly,
}: {
  value: Grade | null;
  onChange: (g: Grade) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="flex gap-2 flex-1">
      {GRADES.map((g) => {
        const selected = value === g;
        return (
          <button
            key={g}
            type="button"
            disabled={readOnly}
            onClick={() => onChange(g)}
            className={cn(
              'flex-1 min-h-[40px] text-[14px] font-bold rounded-none border-2 transition-all',
              'disabled:opacity-40 disabled:cursor-not-allowed',
              selected
                ? 'border-current'
                : 'border-border bg-card text-muted-foreground hover:border-border-strong',
            )}
            style={
              selected
                ? { background: gradeColor(g).fg, color: '#fff', borderColor: gradeColor(g).fg }
                : undefined
            }
          >
            {g}
          </button>
        );
      })}
    </div>
  );
}

function DeptHeadSkeleton() {
  return (
    <PageContainer>
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-20 w-full" />
      <div className="gx-master-detail">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </PageContainer>
  );
}
